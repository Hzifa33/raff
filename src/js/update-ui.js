'use strict';

/* Raff 3.0 — GitHub Releases update experience. The network/download work is
   intentionally isolated in the Electron main process. This file renders only
   trusted local UI and receives serializable status/progress events. */

const RAFF_UPDATE_UI = {
  status: null,
  shownVersion: '',
  initialized: false,
  removeEventListener: null,
  removeAuthListener: null,
  consentShown: false,
  consentPromptTimer: null,
};

function updateEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateFormatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} بايت`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} ك.ب`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value < 100 * 1024 * 1024 ? 1 : 0)} م.ب`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} ج.ب`;
}

function updateFormatSpeed(bytesPerSecond) {
  const speed = Number(bytesPerSecond) || 0;
  return speed ? `${updateFormatBytes(speed)}/ث` : 'جارٍ حساب السرعة…';
}

function updateFormatDate(timestamp) {
  const value = Number(timestamp) || 0;
  if (!value) return 'لم يتم الفحص بعد';
  try { return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (_) { return new Date(value).toLocaleString('ar-EG'); }
}

function updateNotesHtml(notes) {
  const lines = String(notes || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 16)
    .map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^[-*+]\s*/, '').replace(/^\d+[.)]\s*/, ''));
  if (!lines.length) return '<p class="update-notes-empty">لا توجد ملاحظات إصدار مرفقة.</p>';
  return `<ul class="update-notes-list">${lines.map((line) => `<li>${updateEscape(line)}</li>`).join('')}</ul>`;
}


function raffUpdateConsentHtml(status) {
  const titleId = `raffUpdateConsentTitle-${Date.now()}`;
  return {
    titleId,
    html: `
      <div class="update-consent-dialog">
        <div class="update-consent-hero">
          <div class="update-consent-orbit" aria-hidden="true">
            <span class="update-consent-ring"></span>
            <span class="update-consent-mark">${icon('refresh', 24)}</span>
          </div>
          <div class="update-consent-copy">
            <span class="update-consent-kicker">إعداد سريع · مرة واحدة</span>
            <h3 class="modal-title" id="${titleId}">ابقَ على أحدث إصدار من رَفّ</h3>
            <p>هل تسمح لرَفّ بالتحقق من GitHub Releases مرة كل 24 ساعة لمعرفة وجود إصدار جديد؟</p>
          </div>
        </div>

        <div class="update-consent-trust">
          <div>${icon('check', 15)}<span><b>لا تُرسل بيانات المكتبة</b><small>الطلب يقتصر على رقم أحدث إصدار وملفات التحديث المنشورة.</small></span></div>
          <div>${icon('check', 15)}<span><b>لا تنزيل دون موافقتك</b><small>سيظهر إشعار أولًا، وأنت تقرر متى يبدأ التنزيل والتثبيت.</small></span></div>
          <div>${icon('check', 15)}<span><b>يمكن تعطيله في أي وقت</b><small>من الإعدادات ← النظام، ويعود رَفّ إلى عدم الاتصال التلقائي فورًا.</small></span></div>
        </div>

        <div class="update-consent-recommendation">
          <span class="update-consent-recommended-badge">موصى به</span>
          <div><b>تشغيل التحقق التلقائي</b><span>يساعدك على الحصول على إصلاحات الأخطاء وتحسينات رَفّ دون الحاجة إلى متابعة صفحة الإصدارات يدويًا.</span></div>
        </div>

        <div class="update-consent-actions">
          <button class="btn btn-primary update-consent-accept" id="updateConsentAccept" autofocus>${icon('check', 15)} تشغيل التحقق كل 24 ساعة</button>
          <button class="update-consent-decline" id="updateConsentDecline" type="button">لا، أبقِ رَفّ دون اتصال تلقائي</button>
        </div>
        <p class="update-consent-footnote">لن يجري أي اتصال تلقائي قبل اختيارك. ويمكنك تغيير هذا القرار لاحقًا من الإعدادات.</p>
      </div>`,
  };
}

function queueRaffUpdateConsent(status, delay = 850) {
  if (!status?.needsAutoCheckChoice || !isAdminMode()) return;
  clearTimeout(RAFF_UPDATE_UI.consentPromptTimer);
  RAFF_UPDATE_UI.consentPromptTimer = setTimeout(() => {
    RAFF_UPDATE_UI.consentPromptTimer = null;
    if (!isAdminMode() || !RAFF_UPDATE_UI.status?.needsAutoCheckChoice) return;
    if (document.getElementById('activeModalOverlay')) {
      queueRaffUpdateConsent(RAFF_UPDATE_UI.status, 1200);
      return;
    }
    showRaffUpdateConsentDialog(RAFF_UPDATE_UI.status);
  }, delay);
}

function showRaffUpdateConsentDialog(status, { force = false } = {}) {
  if (!status?.needsAutoCheckChoice || !isAdminMode()) return;
  if (RAFF_UPDATE_UI.consentShown && !force) return;
  if (document.getElementById('activeModalOverlay') && !force) {
    queueRaffUpdateConsent(status, 1000);
    return;
  }
  RAFF_UPDATE_UI.consentShown = true;
  let decided = false;
  const shell = raffUpdateConsentHtml(status);
  openModal(shell.html, {
    labelledBy: shell.titleId,
    modalClass: 'modal-update-consent',
    onClose: () => {
      // Escape/backdrop means “not now”, not consent. Keep the offline default
      // and ask again on a later launch/admin session until a real choice is made.
      if (!decided) RAFF_UPDATE_UI.consentShown = true;
    },
    onMount: (overlay) => {
      const accept = overlay.querySelector('#updateConsentAccept');
      const decline = overlay.querySelector('#updateConsentDecline');
      const finish = async (enabled, button) => {
        if (decided) return;
        button.disabled = true;
        const other = enabled ? decline : accept;
        if (other) other.disabled = true;
        if (enabled) button.innerHTML = `${icon('refresh', 15)} جارٍ الحفظ…`;
        try {
          const next = await window.raff.updateSetAutoCheckEnabled(enabled);
          decided = true;
          RAFF_UPDATE_UI.status = next;
          refreshRaffUpdateSettingsCard(document);
          closeModal(enabled ? 'update-consent-accepted' : 'update-consent-declined');
          toast(enabled ? 'تم تفعيل التحقق من التحديثات كل 24 ساعة' : 'سيبقى رَفّ دون اتصال تلقائي', enabled ? 'success' : 'info', 3000);
          if (enabled && next?.available && !next?.postponed) {
            setTimeout(() => showRaffUpdateDialog(next), 500);
          }
        } catch (error) {
          button.disabled = false;
          if (other) other.disabled = false;
          if (enabled) button.innerHTML = `${icon('check', 15)} تشغيل التحقق كل 24 ساعة`;
          toast(error?.message || 'تعذر حفظ إعداد التحديثات', 'error', 3600);
        }
      };
      accept?.addEventListener('click', () => finish(true, accept));
      decline?.addEventListener('click', () => finish(false, decline));
    },
  });
}

function raffUpdateSettingsCardHtml() {
  return `
    <section class="update-settings-card" id="updateSettingsCard">
      <div class="update-settings-icon">${icon('refresh', 18)}</div>
      <div class="update-settings-copy">
        <div class="setting-action-title">تحديثات رَفّ</div>
        <div class="setting-action-desc" id="updateSettingsSummary">رَفّ لا يتصل بالإنترنت تلقائيًا ما لم تفعّل التحقق الدوري.</div>
        <div class="update-settings-meta">
          <span id="updateSettingsVersion">الإصدار الحالي: —</span>
          <span class="update-meta-dot" aria-hidden="true"></span>
          <span id="updateSettingsLastCheck">آخر فحص: —</span>
        </div>
        <label class="update-auto-row" for="autoUpdateCheckToggle">
          <span class="update-auto-copy"><b>البحث تلقائيًا عن التحديثات</b><small>اتصال واحد بـ GitHub Releases كل 24 ساعة عند تفعيل هذا الخيار.</small></span>
          <span class="update-switch"><input type="checkbox" id="autoUpdateCheckToggle" aria-label="البحث تلقائيًا عن التحديثات"><span aria-hidden="true"></span></span>
        </label>
      </div>
      <button class="btn btn-outline btn-sm update-check-btn" id="checkUpdatesBtn">${icon('refresh', 14)} <span>البحث عن تحديثات</span></button>
    </section>`;
}

function refreshRaffUpdateSettingsCard(root = document) {
  const card = root.querySelector?.('#updateSettingsCard');
  if (!card) return;
  const status = RAFF_UPDATE_UI.status;
  const summary = card.querySelector('#updateSettingsSummary');
  const version = card.querySelector('#updateSettingsVersion');
  const lastCheck = card.querySelector('#updateSettingsLastCheck');
  const btn = card.querySelector('#checkUpdatesBtn');
  const autoToggle = card.querySelector('#autoUpdateCheckToggle');
  if (!status) {
    if (summary) summary.textContent = 'رَفّ لا يتصل بالإنترنت تلقائيًا ما لم تفعّل التحقق الدوري.';
    return;
  }

  if (version) version.textContent = `الإصدار الحالي: ${status.currentVersion || '—'} · ${status.archLabel || ''}`;
  if (lastCheck) lastCheck.textContent = `آخر فحص ناجح: ${updateFormatDate(status.lastSuccessfulCheckAt)}`;
  if (autoToggle) autoToggle.checked = status.autoCheckEnabled === true;
  card.classList.toggle('has-update', !!status.available);
  card.classList.toggle('has-error', !!status.lastError && !status.lastSuccessfulCheckAt);
  card.classList.toggle('auto-enabled', status.autoCheckEnabled === true);

  if (summary) {
    if (status.needsAutoCheckChoice) summary.textContent = 'لم تحدد بعد ما إذا كان رَفّ سيتحقق من التحديثات تلقائيًا. الوضع الحالي دون اتصال تلقائي.';
    else if (status.available && status.compatible) summary.textContent = `يتوفر الإصدار ${status.latest.version} لمعمارية ${status.archLabel}.`;
    else if (status.available && !status.compatible) summary.textContent = `يتوفر ${status.latest.version}، لكن لا يوجد مثبت ${status.archLabel} ضمن ملفات الإصدار.`;
    else if (status.lastError) summary.textContent = status.lastError;
    else if (status.autoCheckEnabled) summary.textContent = 'أنت تستخدم أحدث إصدار متاح. التحقق التلقائي مفعّل مرة كل 24 ساعة.';
    else summary.textContent = 'التحديثات التلقائية معطّلة؛ رَفّ يبقى أوفلاين حتى تطلب الفحص يدويًا.';
  }
  if (btn && status.available && status.compatible) btn.innerHTML = `${icon('download', 14)} <span>عرض التحديث</span>`;
}

async function raffBindUpdateSettingsCard(root = document) {
  const card = root.querySelector?.('#updateSettingsCard');
  if (!card || card.dataset.bound === '1') return;
  card.dataset.bound = '1';
  try {
    RAFF_UPDATE_UI.status = await window.raff.updateGetStatus();
    refreshRaffUpdateSettingsCard(root);
  } catch (_) {}

  const autoToggle = card.querySelector('#autoUpdateCheckToggle');
  autoToggle?.addEventListener('change', async () => {
    const intended = autoToggle.checked;
    autoToggle.disabled = true;
    try {
      const status = await window.raff.updateSetAutoCheckEnabled(intended);
      RAFF_UPDATE_UI.status = status;
      refreshRaffUpdateSettingsCard(root);
      toast(intended ? 'تم تفعيل التحقق التلقائي كل 24 ساعة' : 'تم إيقاف الاتصال التلقائي بالتحديثات', intended ? 'success' : 'info', 2600);
    } catch (error) {
      autoToggle.checked = !intended;
      toast(error?.message || 'تعذر حفظ إعداد التحديثات', 'error', 3500);
    } finally {
      autoToggle.disabled = false;
    }
  });

  const btn = card.querySelector('#checkUpdatesBtn');
  btn?.addEventListener('click', async () => {
    if (RAFF_UPDATE_UI.status?.available && RAFF_UPDATE_UI.status?.compatible) {
      showRaffUpdateDialog(RAFF_UPDATE_UI.status, { force: true });
      return;
    }
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-checking');
    btn.innerHTML = `${icon('refresh', 14)} <span>جارٍ التحقق…</span>`;
    try {
      const result = await window.raff.updateCheck();
      RAFF_UPDATE_UI.status = result?.status || result;
      refreshRaffUpdateSettingsCard(root);
      if (!result?.ok) {
        toast(result?.error || 'تعذر البحث عن تحديثات', 'error', 4200);
      } else if (result.available) {
        showRaffUpdateDialog(result, { force: true });
      } else {
        toast('أنت تستخدم أحدث إصدار من رَفّ', 'success', 2600);
      }
    } catch (error) {
      toast(error?.message || 'تعذر البحث عن تحديثات', 'error', 4200);
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-checking');
      if (!RAFF_UPDATE_UI.status?.available) btn.innerHTML = original;
      refreshRaffUpdateSettingsCard(root);
    }
  });
}

function updateDialogShell(status, body, footer = '') {
  const latest = status?.latest || {};
  const titleId = `raffUpdateTitle-${Date.now()}`;
  return {
    titleId,
    html: `
      <div class="update-dialog" data-update-version="${updateEscape(latest.version || '')}">
        <div class="update-dialog-hero">
          <div class="update-dialog-mark">${icon('download', 24)}</div>
          <div class="update-dialog-heading">
            <span class="update-dialog-eyebrow">تحديث رَفّ</span>
            <h3 class="modal-title" id="${titleId}">${latest.version ? `الإصدار ${updateEscape(latest.version)}` : 'التحديثات'}</h3>
            <p>${latest.name ? updateEscape(latest.name) : 'يتوفر إصدار جديد جاهز لجهازك.'}</p>
          </div>
          <span class="update-arch-pill">Windows ${updateEscape(status?.archLabel || '')}</span>
        </div>
        <div class="update-version-flow" aria-label="انتقال الإصدار">
          <span><small>الحالي</small><b>${updateEscape(status?.currentVersion || '—')}</b></span>
          <span class="update-flow-arrow" aria-hidden="true">←</span>
          <span class="is-new"><small>الجديد</small><b>${updateEscape(latest.version || '—')}</b></span>
        </div>
        <div class="update-dialog-body">${body}</div>
        <div class="update-dialog-footer">${footer}</div>
      </div>`,
  };
}

function updateAvailableBody(status) {
  const latest = status.latest;
  const asset = latest?.asset;
  const published = latest?.publishedAt ? new Date(latest.publishedAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : '—';
  if (!status.compatible || !asset) {
    return `
      <div class="update-callout is-warning">${icon('alert', 17)}<div><b>لا يوجد مثبت متوافق مع ${updateEscape(status.archLabel)}</b><span>انشر ملف التثبيت الخاص بهذه المعمارية ضمن GitHub Release ثم أعد الفحص.</span></div></div>
      <div class="update-notes"><div class="update-section-label">ما الجديد</div>${updateNotesHtml(latest?.notes)}</div>`;
  }
  return `
    <div class="update-facts">
      <div><span>حجم التنزيل</span><b>${updateFormatBytes(asset.size)}</b></div>
      <div><span>تاريخ النشر</span><b>${updateEscape(published)}</b></div>
      <div><span>المعمارية</span><b>${updateEscape(status.archLabel)}</b></div>
    </div>
    <div class="update-notes"><div class="update-section-label">ما الجديد في هذا الإصدار</div>${updateNotesHtml(latest.notes)}</div>`;
}

function updateAvailableFooter(status) {
  if (!status.compatible) {
    return `<button class="btn btn-outline" id="updateOpenRelease">فتح صفحة الإصدار</button><button class="btn btn-ghost" id="updateLater">إغلاق</button>`;
  }
  if (status.downloaded) {
    return `<button class="btn btn-primary" id="updateInstallNow">${icon('refresh', 15)} تثبيت الآن</button><button class="btn btn-ghost" id="updateLater">لاحقًا</button>`;
  }
  return `<button class="btn btn-primary" id="updateDownloadNow">${icon('download', 15)} تنزيل التحديث</button><button class="btn btn-ghost" id="updateLater">لاحقًا</button>`;
}

function renderUpdateProgress(overlay, progress) {
  if (!overlay?.isConnected) return;
  const bar = overlay.querySelector('#updateProgressBar');
  const pct = overlay.querySelector('#updateProgressPercent');
  const amount = overlay.querySelector('#updateProgressAmount');
  const speed = overlay.querySelector('#updateProgressSpeed');
  const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  if (bar) bar.style.width = `${percent.toFixed(1)}%`;
  if (pct) pct.textContent = `${Math.floor(percent)}%`;
  if (amount) amount.textContent = `${updateFormatBytes(progress?.received)} / ${updateFormatBytes(progress?.total)}`;
  if (speed) speed.textContent = updateFormatSpeed(progress?.speed);
}

function switchUpdateModalToDownloading(overlay, status) {
  const latest = status.latest;
  const dialog = overlay.querySelector('.update-dialog');
  if (!dialog) return;
  dialog.querySelector('.update-dialog-body').innerHTML = `
    <div class="update-download-stage">
      <div class="update-download-glyph">${icon('download', 25)}</div>
      <div class="update-download-title"><b>جارٍ تنزيل Raff ${updateEscape(latest.version)}</b><span>يمكنك متابعة العمل، وسيُتحقق من الملف قبل السماح بالتثبيت.</span></div>
      <div class="update-progress-row"><b id="updateProgressPercent">0%</b><span id="updateProgressAmount">0 / ${updateFormatBytes(latest.asset?.size)}</span></div>
      <div class="update-progress-track" role="progressbar" aria-label="تنزيل التحديث"><span id="updateProgressBar" style="width:0%"></span></div>
      <div class="update-progress-bottom"><span id="updateProgressSpeed">جارٍ بدء التنزيل…</span><span>${updateEscape(latest.asset?.name || '')}</span></div>
    </div>`;
  dialog.querySelector('.update-dialog-footer').innerHTML = `<button class="btn btn-ghost" id="updateHideDownload">إخفاء</button><button class="btn btn-outline" id="updateCancelDownload">إلغاء التنزيل</button>`;
  dialog.querySelector('#updateHideDownload')?.addEventListener('click', () => closeModal('hide-update-download'));
  dialog.querySelector('#updateCancelDownload')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'جارٍ الإلغاء…';
    await window.raff.updateCancelDownload();
  });
}

function switchUpdateModalToReady(overlay, result) {
  if (!overlay?.isConnected) return;
  const status = result?.status || RAFF_UPDATE_UI.status;
  const downloaded = result?.downloaded || status?.downloaded;
  const dialog = overlay.querySelector('.update-dialog');
  if (!dialog || !downloaded) return;
  dialog.querySelector('.update-dialog-body').innerHTML = `
    <div class="update-ready-stage">
      <div class="update-ready-mark">${icon('check', 26)}</div>
      <div><b>التحديث جاهز للتثبيت</b><span>${downloaded.verified ? 'تم التحقق من بصمة SHA-256 بنجاح.' : 'اكتمل الملف وحُسبت بصمة SHA-256 المحلية.'}</span></div>
    </div>
    <div class="update-verification-grid">
      <div><span>الملف</span><b>${updateEscape(downloaded.fileName)}</b></div>
      <div><span>الحجم</span><b>${updateFormatBytes(downloaded.size)}</b></div>
      <div class="span-2"><span>SHA-256</span><code>${updateEscape(downloaded.sha256)}</code></div>
    </div>`;
  dialog.querySelector('.update-dialog-footer').innerHTML = `<button class="btn btn-primary" id="updateInstallNow">${icon('refresh', 15)} تثبيت الآن</button><button class="btn btn-ghost" id="updateLater">لاحقًا</button>`;
  wireUpdateReadyActions(overlay, status);
}

function switchUpdateModalToError(overlay, message, status) {
  if (!overlay?.isConnected) return;
  const dialog = overlay.querySelector('.update-dialog');
  if (!dialog) return;
  dialog.querySelector('.update-dialog-body').innerHTML = `
    <div class="update-error-stage">
      <div class="update-error-mark">${icon('alert', 24)}</div>
      <div><b>لم يكتمل تنزيل التحديث</b><span>${updateEscape(message || 'حدث خطأ غير متوقع')}</span></div>
    </div>`;
  dialog.querySelector('.update-dialog-footer').innerHTML = `<button class="btn btn-primary" id="updateRetry">إعادة المحاولة</button><button class="btn btn-ghost" id="updateLater">إغلاق</button>`;
  dialog.querySelector('#updateRetry')?.addEventListener('click', () => startRaffUpdateDownload(overlay, status));
  dialog.querySelector('#updateLater')?.addEventListener('click', () => closeModal('update-error-close'));
}

function wireUpdateReadyActions(overlay, status) {
  overlay.querySelector('#updateInstallNow')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh', 15)} تشغيل المثبت…`;
    const result = await window.raff.updateInstall();
    if (!result?.ok) {
      btn.disabled = false;
      btn.innerHTML = `${icon('refresh', 15)} تثبيت الآن`;
      toast(result?.error || 'تعذر تشغيل مثبت التحديث', 'error', 4500);
    }
  });
  overlay.querySelector('#updateLater')?.addEventListener('click', async () => {
    await window.raff.updatePostpone(24);
    closeModal('update-postponed');
  });
}

async function startRaffUpdateDownload(overlay, status) {
  switchUpdateModalToDownloading(overlay, status);
  try {
    const result = await window.raff.updateDownload();
    RAFF_UPDATE_UI.status = result?.status || await window.raff.updateGetStatus();
    refreshRaffUpdateSettingsCard(document);
    if (result?.ok) switchUpdateModalToReady(overlay, result);
    else if (result?.cancelled) {
      if (overlay?.isConnected) closeModal('download-cancelled');
      toast('تم إلغاء تنزيل التحديث', 'info', 2200);
    } else switchUpdateModalToError(overlay, result?.error, status);
  } catch (error) {
    switchUpdateModalToError(overlay, error?.message, status);
  }
}

function showRaffUpdateDialog(status, { force = false } = {}) {
  if (!status?.available || !status.latest) return;
  if (!isAdminMode()) return;
  if (status.postponed && !force) return;
  const version = status.latest.version;
  if (RAFF_UPDATE_UI.shownVersion === version && !force) return;
  RAFF_UPDATE_UI.shownVersion = version;

  if (document.getElementById('activeModalOverlay') && !force) {
    toast(`يتوفر تحديث رَفّ ${version}`, 'info', 6000, {
      label: 'عرض',
      onClick: () => showRaffUpdateDialog(status, { force: true }),
    });
    return;
  }

  const shell = updateDialogShell(status, updateAvailableBody(status), updateAvailableFooter(status));
  const overlay = openModal(shell.html, {
    labelledBy: shell.titleId,
    modalClass: 'modal-update-center',
    onMount: (node) => {
      node.querySelector('#updateDownloadNow')?.addEventListener('click', () => startRaffUpdateDownload(node, status));
      node.querySelector('#updateOpenRelease')?.addEventListener('click', () => window.raff.openExternal(status.latest.htmlUrl));
      node.querySelector('#updateLater')?.addEventListener('click', async () => {
        await window.raff.updatePostpone(24);
        closeModal('update-postponed');
      });
      if (status.downloaded) wireUpdateReadyActions(node, status);
    },
  });
  if (status.downloading) {
    switchUpdateModalToDownloading(overlay, status);
    renderUpdateProgress(overlay, status.downloading);
  } else if (status.downloaded) {
    switchUpdateModalToReady(overlay, { status, downloaded: status.downloaded });
  }
}

function activeUpdateOverlay() {
  const overlay = document.getElementById('activeModalOverlay');
  return overlay?.querySelector('.update-dialog') ? overlay : null;
}

async function handleRaffUpdateEvent(event) {
  if (!event?.type) return;
  if (event.status) RAFF_UPDATE_UI.status = event.status;
  const overlay = activeUpdateOverlay();

  if (event.type === 'available') {
    const status = event.status || await window.raff.updateGetStatus();
    RAFF_UPDATE_UI.status = status;
    refreshRaffUpdateSettingsCard(document);
    // A manual check owns its own result UI; suppressing the parallel event
    // avoids closing/reopening the same dialog once the invoke resolves.
    if (!event.manual) showRaffUpdateDialog(status);
    return;
  }
  if (event.type === 'auto-check-setting-changed') {
    RAFF_UPDATE_UI.status = event.status || await window.raff.updateGetStatus();
    refreshRaffUpdateSettingsCard(document);
    return;
  }
  if (event.type === 'up-to-date') {
    RAFF_UPDATE_UI.status = event.status || await window.raff.updateGetStatus();
    refreshRaffUpdateSettingsCard(document);
    return;
  }
  if (event.type === 'download-progress') {
    renderUpdateProgress(overlay, event.progress);
    return;
  }
  if (event.type === 'downloaded') {
    RAFF_UPDATE_UI.status = event.status || await window.raff.updateGetStatus();
    refreshRaffUpdateSettingsCard(document);
    if (overlay) switchUpdateModalToReady(overlay, event);
    else if (isAdminMode()) toast('اكتمل تنزيل تحديث رَفّ', 'success', 7000, { label: 'تثبيت', onClick: () => showRaffUpdateDialog(RAFF_UPDATE_UI.status, { force: true }) });
    return;
  }
  if (event.type === 'download-error') {
    if (overlay) switchUpdateModalToError(overlay, event.error, RAFF_UPDATE_UI.status);
    else toast(event.error || 'تعذر تنزيل التحديث', 'error', 4500);
    return;
  }
  if (event.type === 'download-cancelled') {
    if (overlay) closeModal('download-cancelled');
    return;
  }
  if (event.type === 'check-error') {
    RAFF_UPDATE_UI.status = event.status || RAFF_UPDATE_UI.status;
    refreshRaffUpdateSettingsCard(document);
  }
}

async function initRaffUpdaterUi() {
  if (RAFF_UPDATE_UI.initialized || !window.raff?.updateGetStatus) return;
  RAFF_UPDATE_UI.initialized = true;
  RAFF_UPDATE_UI.removeEventListener = window.raff.onUpdateEvent(handleRaffUpdateEvent);
  RAFF_UPDATE_UI.removeAuthListener = window.raff.onAuthStateChange(async (state) => {
    if (state?.mode !== 'admin') {
      clearTimeout(RAFF_UPDATE_UI.consentPromptTimer);
      RAFF_UPDATE_UI.consentPromptTimer = null;
      const overlay = activeUpdateOverlay();
      const consentOverlay = document.getElementById('activeModalOverlay')?.querySelector('.update-consent-dialog');
      if (overlay || consentOverlay) closeModal('left-admin-mode');
      return;
    }
    try {
      const status = await window.raff.updateGetStatus();
      RAFF_UPDATE_UI.status = status;
      refreshRaffUpdateSettingsCard(document);
      if (status.needsAutoCheckChoice) queueRaffUpdateConsent(status, 450);
      else if (status.available && !status.postponed) setTimeout(() => showRaffUpdateDialog(status), 350);
    } catch (_) {}
  });
  try {
    const status = await window.raff.updateGetStatus();
    RAFF_UPDATE_UI.status = status;
    refreshRaffUpdateSettingsCard(document);
    if (status.needsAutoCheckChoice && isAdminMode()) queueRaffUpdateConsent(status, 950);
    else if (status.available && !status.postponed && isAdminMode()) setTimeout(() => showRaffUpdateDialog(status), 900);
  } catch (_) {}
}
