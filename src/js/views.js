'use strict';

/* =========================================================
   Shared helpers
   ========================================================= */
function escapeHtml(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sortBooks(books, sortKey) {
  const arr = [...books];
  switch (sortKey) {
    case 'oldest': return arr.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    case 'newest':
    default: return arr.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

function statusBadgeHtml(book) {
  const status = RaffBook.bookStatus(book);
  const cls = status === RaffBook.STATUS_AVAILABLE ? 'badge-available'
    : status === RaffBook.STATUS_PARTIAL ? 'badge-partial'
    : 'badge-borrowed';
  return `<span class="badge ${cls}">${status}</span>`;
}

function copiesMeterHtml(book) {
  const total = RaffBook.totalCopies(book);
  const avail = RaffBook.availableFullCopies(book);
  const pct = total ? (avail / total) * 100 : 0;
  const suffix = RaffBook.isMultiVolume(book) ? ' مجموعة' : '';
  return `
    <div class="copies-cell" title="${avail} متاحة من ${total}${suffix}">
      <div class="copies-text"><strong>${avail}</strong> / ${total}</div>
      <div class="copies-track"><div class="copies-fill" style="width:${pct}%;"></div></div>
    </div>`;
}

function renderBookRow(book) {
  const spine = spineColorFor(book.category || book.author);
  return `
    <div class="book-row" data-id="${book.id}" data-action="details" role="button" tabindex="0">
      <div class="spine" style="background:${spine};"></div>
      <div class="book-title-cell">
        <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title) || 'بدون عنوان'}</div>
        <div class="book-ref">${icon('hash')}<span>${escapeHtml(book.referenceNumber)}</span></div>
      </div>
      <div class="book-meta-cell">
        <span class="book-meta-label">المؤلف</span>
        <span class="book-meta-value">${escapeHtml(book.author) || '—'}</span>
      </div>
      <div class="book-meta-cell hide-narrow">
        <span class="book-meta-label">دار النشر</span>
        <span class="book-meta-value">${escapeHtml(book.publisher) || '—'}</span>
      </div>
      <div class="book-meta-cell hide-narrow hide-md">
        <span class="book-meta-label">المجال</span>
        <span class="book-meta-value">${escapeHtml(book.category) || '—'}</span>
      </div>
      ${copiesMeterHtml(book)}
      <div class="book-status-cell">${statusBadgeHtml(book)}</div>
      <div class="row-actions">
        <button class="btn btn-outline btn-icon" data-action="edit" data-id="${book.id}" title="تعديل" aria-label="تعديل">${icon('edit')}</button>
        <button class="btn btn-outline btn-icon" data-action="delete" data-id="${book.id}" title="حذف" aria-label="حذف">${icon('trash')}</button>
      </div>
    </div>`;
}

/**
 * Confirms, deletes, then offers a real undo. Deleting a catalogued book is
 * destructive and easy to do by mistake, so the record is kept in memory and
 * restored verbatim (same id and reference number) if the user undoes.
 */
async function deleteBookWithUndo(book) {
  const ok = await confirmModal({
    title: 'حذف هذا الكتاب؟',
    message: `سيتم حذف "${escapeHtml(book.title)}" من سجل المكتبة. يمكنك التراجع مباشرة بعد الحذف.`,
    confirmLabel: 'حذف',
  });
  if (!ok) return false;

  const snapshot = { ...book };
  await window.raff.removeBook(book.id);
  await refreshState();
  renderNavCounts();
  renderRoute();

  toast('تم حذف الكتاب', 'success', 6000, {
    label: 'تراجع',
    onClick: async () => {
      await window.raff.restoreBook(snapshot);
      await refreshState();
      renderNavCounts();
      renderRoute();
      toast('تمت استعادة الكتاب', 'success', 2200);
    },
  });
  return true;
}

/* =========================================================
   Book details modal
   ========================================================= */
function showBookDetails(bookId) {
  const book = RAFF_STATE.books.find((b) => b.id === bookId);
  if (!book) return;

  const spine = spineColorFor(book.category || book.author);
  const total = RaffBook.totalCopies(book);
  const volCount = RaffBook.totalVolumes(book);
  const multi = RaffBook.isMultiVolume(book);
  const fullAvail = RaffBook.availableFullCopies(book);
  const loans = [...(book.loans || [])].sort(
    (a, b) => Date.parse(b.borrowedAt) - Date.parse(a.borrowedAt)
  );
  const openLoans = loans.filter((l) => !l.returnedAt);
  const canBorrowFull = RaffBook.canBorrow(book);
  // For a multi-volume book, borrowing is possible if any single volume is free.
  const anyVolumeFree = multi && Array.from({ length: volCount }, (_, i) => i + 1)
    .some((v) => RaffBook.canBorrowVolume(book, v));
  const canBorrowAny = canBorrowFull || anyVolumeFree;
  const today = new Date().toISOString().slice(0, 10);
  const dueDefault = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const loanRow = (l) => {
    const days = RaffBook.loanDurationDays(l);
    const overdue = RaffBook.isOverdue(l, 30);
    const dueSoon = !overdue && RaffBook.isDueSoon(l, 7);
    const scope = RaffBook.loanScopeLabel(l);
    const isVol = RaffBook.isVolumeLoan(l);
    const dLeft = RaffBook.daysUntilDue(l);
    let dueBadge = '';
    if (!l.returnedAt) {
      if (overdue) dueBadge = `<span class="due-badge over">متأخر ${dLeft !== null ? Math.abs(dLeft) + ' يوم' : ''}</span>`;
      else if (dueSoon) dueBadge = `<span class="due-badge soon">يستحق خلال ${dLeft} يوم</span>`;
      else if (l.dueAt) dueBadge = `<span class="due-badge ok">يستحق ${reportFormatDate(l.dueAt)}</span>`;
    }
    const extra = (l.contact || l.note)
      ? `<div class="loan-extra">${l.contact ? `<span class="loan-contact">${icon('user', 11)} ${escapeHtml(l.contact)}</span>` : ''}${l.note ? `<span class="loan-note">${escapeHtml(l.note)}</span>` : ''}</div>`
      : '';
    return `
      <div class="loan-row ${l.returnedAt ? 'is-returned' : overdue ? 'is-overdue' : dueSoon ? 'is-duesoon' : ''}">
        <div class="loan-main">
          <div class="loan-who">
            <span class="loan-name">${escapeHtml(l.borrowerName)}
              <span class="loan-scope ${isVol ? 'scope-vol' : 'scope-full'}">${scope}</span>
            </span>
            <span class="loan-dates">${reportFormatDate(l.borrowedAt)}${l.returnedAt ? ` ← ${reportFormatDate(l.returnedAt)}` : ''} ${dueBadge}</span>
          </div>
          <span class="loan-days ${overdue ? 'overdue' : ''}">${days} يوم</span>
          ${l.returnedAt
            ? `<span class="loan-state returned">أُرجع</span>`
            : `<button class="btn btn-outline btn-sm" data-return-loan="${l.id}">${icon('refresh')} إرجاع</button>`}
        </div>
        ${extra}
      </div>`;
  };

  const metaChip = (label, value, iconName) => value
    ? `<div class="meta-chip"><span class="meta-chip-label">${icon(iconName, 12)} ${label}</span><span class="meta-chip-value">${escapeHtml(value)}</span></div>`
    : '';

  const priceStr = typeof book.price === 'number' ? formatPrice(book.price) : null;

  // Per-volume availability strip (multi-volume only).
  const volumeStrip = multi ? `
    <div class="volume-strip">
      <div class="volume-strip-label">إتاحة الأجزاء</div>
      <div class="volume-chips">
        ${Array.from({ length: volCount }, (_, i) => i + 1).map((v) => {
          const va = RaffBook.availableOfVolume(book, v);
          const cls = va === 0 ? 'vc-none' : va < total ? 'vc-partial' : 'vc-full';
          return `<span class="volume-chip ${cls}" title="الجزء ${v}: ${va} متاح من ${total}">ج${v}<b>${va}/${total}</b></span>`;
        }).join('')}
      </div>
    </div>` : '';

  const html = `
    <div class="detail-header" style="border-top: 4px solid ${spine};">
      <div class="detail-title-wrap">
        <h3 class="detail-title">${escapeHtml(book.title) || 'بدون عنوان'}</h3>
        <p class="detail-author">${escapeHtml(book.author) || 'مؤلف غير محدد'}</p>
      </div>
      <button class="btn btn-ghost btn-icon" id="detailClose" aria-label="إغلاق">${icon('x')}</button>
    </div>
    <div class="modal-body detail-body-2col">
      <div class="detail-col detail-col-info">
        <div class="detail-ref">
          <div class="detail-ref-main">
            <span class="detail-ref-label">الرقم المرجعي</span>
            <span class="detail-ref-value" id="detailRefValue">${escapeHtml(book.referenceNumber)}</span>
          </div>
          <button class="ref-inline-edit" id="detailRefEdit" title="تغيير الرقم المرجعي">${icon('edit', 13)}</button>
          <div class="ref-edit-row hidden" id="detailRefEditRow">
            <input type="text" id="detailRefInput" value="${escapeHtml(book.referenceNumber)}" />
            <button class="btn btn-primary btn-sm" id="detailRefSave">${icon('check', 13)}</button>
            <button class="btn btn-ghost btn-sm" id="detailRefCancel">${icon('x', 13)}</button>
          </div>
        </div>

        <div class="availability-card ${fullAvail === 0 ? 'is-none' : fullAvail < total ? 'is-partial' : 'is-full'}">
          <div class="availability-head">
            <span class="availability-count"><strong>${fullAvail}</strong> ${multi ? 'مجموعة كاملة' : 'نسخة'} من ${total}</span>
            ${statusBadgeHtml(book)}
          </div>
          <div class="copies-track"><div class="copies-fill" style="width:${total ? (fullAvail / total) * 100 : 0}%;"></div></div>
        </div>

        ${volumeStrip}

        <div class="meta-chips">
          ${metaChip('دار النشر', book.publisher, 'building')}
          ${metaChip('المجال', book.category, 'tag')}
          ${metaChip('الطبعة', book.edition, 'layers')}
          ${metaChip('سنة النشر', book.publishYear, 'calendar')}
          ${multi ? metaChip('الأجزاء', String(volCount), 'layers') : ''}
          ${priceStr ? metaChip('السعر', priceStr, 'tag') : ''}
        </div>

        ${book.notes ? `<div class="detail-notes"><p>${escapeHtml(book.notes)}</p></div>` : ''}

        <div class="form-actions detail-actions">
          <button class="btn btn-outline btn-sm" id="detailEdit">${icon('edit')} تعديل</button>
          <button class="btn btn-outline btn-sm" id="detailCopyRef">${icon('hash')} نسخ الرقم</button>
          <button class="btn btn-danger btn-sm" id="detailDelete">${icon('trash')} حذف</button>
        </div>
      </div>

      <div class="detail-col detail-col-loans">
        <div class="loans-head">
          <h4 class="loans-title">${icon('user')} سجل الإعارة</h4>
          <span class="loans-count">${openLoans.length} مفتوحة من ${loans.length}</span>
        </div>

        <div class="borrow-form ${canBorrowAny ? '' : 'disabled'}">
          <div class="ac-anchor borrow-name-wrap">
            <input type="text" id="borrowName" placeholder="اسم المستعير" ${canBorrowAny ? '' : 'disabled'} />
          </div>
          ${multi ? `
          <div class="borrow-scope-row">
            <div class="chip-toggle borrow-scope" id="borrowScope">
              <button type="button" data-scope="full" class="active" ${canBorrowFull ? '' : 'disabled'}>مجموعة كاملة</button>
              <button type="button" data-scope="volume">جزء محدد</button>
            </div>
            <select id="borrowVolume" class="borrow-volume hidden">
              ${Array.from({ length: volCount }, (_, i) => i + 1).map((v) => {
                const va = RaffBook.availableOfVolume(book, v);
                return `<option value="${v}" ${va === 0 ? 'disabled' : ''}>الجزء ${v}${va === 0 ? ' (غير متاح)' : ` (${va})`}</option>`;
              }).join('')}
            </select>
          </div>` : ''}
          <div class="borrow-dates-row">
            <label class="borrow-field">
              <span class="borrow-field-label">تاريخ الإعارة</span>
              <input type="date" id="borrowDate" value="${today}" max="${today}" ${canBorrowAny ? '' : 'disabled'} />
            </label>
            <label class="borrow-field">
              <span class="borrow-field-label">تاريخ الإرجاع</span>
              <input type="date" id="borrowDue" value="${dueDefault}" ${canBorrowAny ? '' : 'disabled'} />
            </label>
          </div>
          <input type="text" id="borrowContact" class="borrow-extra" placeholder="وسيلة التواصل (هاتف/بريد) — اختياري" ${canBorrowAny ? '' : 'disabled'} />
          <input type="text" id="borrowNote" class="borrow-extra" placeholder="ملاحظة قصيرة عن الإعارة — اختياري" ${canBorrowAny ? '' : 'disabled'} />
          <div class="borrow-action-row">
            <button class="btn btn-primary btn-sm" id="borrowBtn" ${canBorrowAny ? '' : 'disabled'}>${icon('plus')} إعارة</button>
          </div>
        </div>
        ${canBorrowAny ? '' : '<p class="borrow-blocked">لا توجد نسخ متاحة. أرجِع نسخة أو زد عدد النسخ.</p>'}

        <div class="loans-list">
          ${loans.length ? loans.map(loanRow).join('') : '<p class="loans-empty">لم تُسجَّل أي إعارة بعد.</p>'}
        </div>
      </div>
    </div>`;

  openModal(html, {
    onMount: (overlay) => {
      overlay.querySelector('#detailClose').addEventListener('click', closeModal);

      // Inline reference-number editing.
      const refValue = overlay.querySelector('#detailRefValue');
      const refEditBtn = overlay.querySelector('#detailRefEdit');
      const refRow = overlay.querySelector('#detailRefEditRow');
      const refInput = overlay.querySelector('#detailRefInput');
      const openRefEdit = () => {
        refValue.classList.add('hidden');
        refEditBtn.classList.add('hidden');
        refRow.classList.remove('hidden');
        refInput.value = book.referenceNumber;
        refInput.focus(); refInput.select();
      };
      const closeRefEdit = () => {
        refRow.classList.add('hidden');
        refValue.classList.remove('hidden');
        refEditBtn.classList.remove('hidden');
      };
      const saveRefEdit = async () => {
        const next = refInput.value.trim();
        if (!next || next === book.referenceNumber) { closeRefEdit(); return; }
        const res = await window.raff.setReferenceNumber(book.id, next);
        if (!res.ok) { toast(res.error, 'error'); refInput.focus(); return; }
        await refreshState();
        renderNavCounts();
        refreshCurrentView();
        toast('تم تحديث الرقم المرجعي', 'success', 1800);
        showBookDetails(book.id);
      };
      refEditBtn.addEventListener('click', openRefEdit);
      overlay.querySelector('#detailRefSave').addEventListener('click', saveRefEdit);
      overlay.querySelector('#detailRefCancel').addEventListener('click', closeRefEdit);
      refInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveRefEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); closeRefEdit(); }
      });

      const nameInput = overlay.querySelector('#borrowName');
      if (nameInput && !nameInput.disabled) {
        // Suggest people who have borrowed before, so names stay consistent.
        createAutocomplete(nameInput, {
          getPool: () => RAFF_STATE.suggestions.filter((s) => s.type === 'borrower'),
          onSelect: () => {},
          typeLabels: SUGGESTION_TYPE_LABELS,
        });
        nameInput.focus();
      }

      // Scope toggle (multi-volume only): switch between whole-set and single volume.
      let borrowScope = 'full';
      const scopeToggle = overlay.querySelector('#borrowScope');
      const volumeSelect = overlay.querySelector('#borrowVolume');
      if (scopeToggle) {
        scopeToggle.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-scope]');
          if (!btn || btn.disabled) return;
          borrowScope = btn.dataset.scope;
          scopeToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
          volumeSelect.classList.toggle('hidden', borrowScope !== 'volume');
        });
      }

      const doBorrow = async () => {
        const name = nameInput.value.trim();
        const date = overlay.querySelector('#borrowDate').value;
        const dueVal = overlay.querySelector('#borrowDue')?.value;
        const contact = overlay.querySelector('#borrowContact')?.value.trim() || '';
        const note = overlay.querySelector('#borrowNote')?.value.trim() || '';
        if (!name) { toast('اسم المستعير مطلوب', 'error'); nameInput.focus(); return; }
        const payload = {
          borrowerName: name,
          borrowedAt: date ? new Date(date + 'T12:00:00').toISOString() : undefined,
          dueAt: dueVal ? new Date(dueVal + 'T12:00:00').toISOString() : undefined,
          contact,
          note,
          scope: borrowScope,
        };
        if (borrowScope === 'volume' && volumeSelect) payload.volume = Number(volumeSelect.value);
        const res = await window.raff.borrowCopy(book.id, payload);
        if (!res.ok) { toast(res.error, 'error'); return; }
        await refreshState();
        renderNavCounts();
        refreshCurrentView();
        const what = borrowScope === 'volume' ? `الجزء ${payload.volume}` : 'مجموعة كاملة';
        toast(`تمت إعارة ${what} إلى ${name}`, 'success');
        showBookDetails(book.id);
      };

      overlay.querySelector('#borrowBtn')?.addEventListener('click', doBorrow);
      nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doBorrow(); }
      });

      overlay.querySelectorAll('[data-return-loan]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const res = await window.raff.returnLoan(book.id, btn.dataset.returnLoan);
          if (!res.ok) { toast(res.error, 'error'); return; }
          await refreshState();
          renderNavCounts();
          refreshCurrentView();
          toast('تم تسجيل الإرجاع', 'success');
          showBookDetails(book.id);
        });
      });

      overlay.querySelector('#detailEdit').addEventListener('click', () => {
        closeModal();
        navigateTo('edit', { book });
      });
      overlay.querySelector('#detailCopyRef').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(book.referenceNumber);
          toast('تم نسخ الرقم المرجعي', 'success', 1800);
        } catch (_) { toast('تعذّر نسخ الرقم', 'error'); }
      });
      overlay.querySelector('#detailDelete').addEventListener('click', async () => {
        closeModal();
        await deleteBookWithUndo(book);
      });
    },
  });
}

function reportFormatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Formats a price with a thin-space thousands grouping; unit-agnostic. */
function formatPrice(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* =========================================================
   Dashboard
   ========================================================= */
/** A dismissable-feeling alert listing the most overdue loans, if any. */
function overdueBannerHtml() {
  const overdue = collectOverdue(RAFF_STATE.books, 30);
  if (!overdue.length) return '';
  const top = overdue.slice(0, 4);
  return `
    <div class="overdue-banner">
      <div class="overdue-head">
        <span class="overdue-title">${icon('alert', 16)} ${overdue.length} إعارة متأخرة (أكثر من 30 يوماً)</span>
        <button class="btn btn-outline btn-sm" data-nav="reports">عرض في الاستدعاء</button>
      </div>
      <div class="overdue-list">
        ${top.map((o) => `
          <button class="overdue-item" data-book="${o.book.id}">
            <span class="overdue-name">${escapeHtml(o.loan.borrowerName)}</span>
            <span class="overdue-book">${escapeHtml(o.book.title)}</span>
            <span class="overdue-days">${o.days} يوم</span>
          </button>`).join('')}
        ${overdue.length > top.length ? `<span class="overdue-more">و${overdue.length - top.length} أخرى…</span>` : ''}
      </div>
    </div>`;
}

function renderDashboard(root) {
  const { stats, books } = RAFF_STATE;
  const recent = sortBooks(books, 'newest').slice(0, 6);
  const topCategories = Object.entries(stats.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = Math.max(1, ...topCategories.map((c) => c[1]));
  const isEmpty = books.length === 0;

  const statCard = (value, label, iconName, variant = '') => `
    <div class="stat-card ${variant}">
      <div class="stat-icon">${icon(iconName, 18)}</div>
      <div>
        <div class="stat-value">${value ?? 0}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;

  if (isEmpty) {
    root.innerHTML = `
      <div class="welcome-panel">
        <div class="welcome-mark">${icon('stack', 44)}</div>
        <h2 class="welcome-title">أهلاً بك في رَفّ</h2>
        <p class="welcome-desc">
          مكتبتك فارغة حتى الآن. أضف أول كتاب وسيمنحه النظام رقماً مرجعياً تلقائياً
          لتدوّنه عليه، ثم يمكنك البحث في مكتبتك كاملة في أي وقت.
        </p>
        <div class="welcome-actions">
          <button class="btn btn-primary" data-nav="add">${icon('plus')} إضافة أول كتاب</button>
          <button class="btn btn-outline" data-nav="settings">${icon('upload')} استيراد نسخة احتياطية</button>
        </div>
        <div class="welcome-tips">
          <div class="welcome-tip">${icon('hash', 14)}<span>رقم مرجعي تلقائي لكل كتاب</span></div>
          <div class="welcome-tip">${icon('search', 14)}<span>بحث لا يتأثر باختلاف الهمزات</span></div>
          <div class="welcome-tip">${icon('download', 14)}<span>تصدير PDF وExcel وJSON</span></div>
        </div>
      </div>`;
    return;
  }

  const smartCard = (value, label, iconName, variant = '', nav = '') => `
    <div class="smart-card ${variant}" ${nav ? `data-nav="${nav}"` : ''}>
      <div class="smart-icon">${icon(iconName, 16)}</div>
      <div class="smart-body">
        <div class="smart-value">${value}</div>
        <div class="smart-label">${label}</div>
      </div>
    </div>`;

  const priceFmt = (n) => (typeof n === 'number' ? formatPrice(n) : '—');
  const topPricedLabel = stats.topPriced
    ? `${escapeHtml(stats.topPriced.title || '—')} · ${priceFmt(stats.topPriced.price)}`
    : 'لا يوجد';

  root.innerHTML = `
    <div class="stat-grid">
      ${statCard(stats.totalBooks, 'إجمالي العناوين', 'book')}
      ${statCard(stats.availableCopies, 'نسخ متاحة', 'check', 'stat-success')}
      ${statCard(stats.borrowedCopies, 'نسخ معارة', 'copies', 'stat-danger')}
      ${statCard(stats.activeBorrowers, 'مستعيرون حالياً', 'user')}
    </div>

    <div class="smart-grid">
      ${smartCard(stats.overdueLoans || 0, 'إعارات متأخرة', 'alert', (stats.overdueLoans ? 'danger' : ''), 'reports')}
      ${smartCard(stats.dueSoonLoans || 0, 'تستحق خلال 7 أيام', 'calendar', (stats.dueSoonLoans ? 'warn' : ''))}
      ${smartCard((stats.completeness ?? 100) + '%', 'اكتمال بيانات الجرد', 'check', '')}
      ${smartCard(priceFmt(stats.totalValue), 'قيمة الكتب المسعّرة', 'tag', '')}
      ${smartCard(stats.multiVolumeTitles || 0, 'عناوين متعددة الأجزاء', 'layers', '')}
      ${smartCard(topPricedLabel, 'أعلى كتاب سعراً', 'tag', 'wide', stats.topPriced ? '' : '')}
    </div>

    ${overdueBannerHtml()}

    <div class="dash-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">أحدث الإضافات</h2>
            <p class="panel-desc">اضغط على أي كتاب لعرض بياناته كاملة</p>
          </div>
          <button class="btn btn-outline btn-sm" data-nav="library">عرض الكل</button>
        </div>
        <div class="book-list">
          ${recent.map(renderBookRow).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">توزيع المجالات</h2>
            <p class="panel-desc">أكثر التصنيفات عدداً</p>
          </div>
        </div>
        ${topCategories.length ? `
        <div class="bar-chart">
          ${topCategories.map(([cat, count]) => `
            <div class="bar-row">
              <div class="bar-row-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${(count / maxCat) * 100}%;"></div></div>
              <div class="bar-row-value">${count}</div>
            </div>`).join('')}
        </div>` : `<p class="text-muted" style="font-size:12.5px;">لم تُضف مجالات بعد.</p>`}
      </div>
    </div>
  `;
}

/* =========================================================
   Browse / Search
   ========================================================= */
let _browserFilters = { query: '', field: 'all', status: 'all', sort: 'newest' };

// Must match the CSS in .vlist-rows .book-row
const ROW_HEIGHT = 62;
const ROW_GAP = 8;
const ROW_STEP = ROW_HEIGHT + ROW_GAP;

let _vlist = null;
let _queryDebounce = null;

/**
 * Rebuilding the whole panel on every keystroke destroyed the input element,
 * which is why focus was lost after each character. The shell is now rendered
 * once; typing only feeds new items into the virtual list.
 */
function renderBookBrowser(root, { presetQuery } = {}) {
  if (presetQuery !== undefined) _browserFilters.query = presetQuery;
  const f = _browserFilters;

  if (_vlist) { _vlist.destroy(); _vlist = null; }

  root.innerHTML = `
    <div class="panel browser-panel">
      <div class="filters-row">
        <select id="filterField">
          <option value="all">كل الحقول</option>
          <option value="title">العنوان</option>
          <option value="author">المؤلف</option>
          <option value="publisher">دار النشر</option>
          <option value="referenceNumber">الرقم المرجعي</option>
          <option value="category">المجال</option>
          <option value="series">السلسلة</option>
          <option value="shelf">الرف</option>
          <option value="keywords">الكلمات المفتاحية</option>
          <option value="borrowers">المستعير</option>
        </select>
        <div class="ac-anchor filter-query-wrap">
          <input type="text" id="filterQuery" placeholder="اكتب كلمة البحث..." autocomplete="off" />
        </div>
        <div class="chip-toggle" id="statusToggle">
          <button data-val="all">الكل</button>
          <button data-val="${RaffBook.STATUS_AVAILABLE}">متاح</button>
          <button data-val="${RaffBook.STATUS_PARTIAL}">معار جزئياً</button>
          <button data-val="${RaffBook.STATUS_FULL}">معار بالكامل</button>
        </div>
        <select id="filterSort">
          <option value="newest">الأحدث أولاً</option>
          <option value="oldest">الأقدم أولاً</option>
          <option value="title-asc">ترتيب حسب العنوان</option>
          <option value="author-asc">ترتيب حسب المؤلف</option>
        </select>
        <span class="result-count" id="resultCount"></span>
      </div>

      <div class="vlist-scroll" id="bookScroll"></div>
    </div>
  `;

  const fieldSel = root.querySelector('#filterField');
  const queryInput = root.querySelector('#filterQuery');
  const sortSel = root.querySelector('#filterSort');
  const statusToggle = root.querySelector('#statusToggle');
  const scrollEl = root.querySelector('#bookScroll');

  // Set values via properties, never by re-rendering markup.
  fieldSel.value = f.field;
  queryInput.value = f.query;
  sortSel.value = f.sort;
  syncStatusToggle(statusToggle, f.status);

  _vlist = createVirtualList(scrollEl, {
    rowStep: ROW_STEP,
    rowHeight: ROW_HEIGHT,
    renderRow: (book) => renderBookRow(book),
    emptyHtml: `
      <div class="empty-state">
        ${icon('book')}
        <h3>لا توجد نتائج مطابقة</h3>
        <p>جرّب كلمة بحث مختلفة أو غيّر الفلاتر المستخدمة.</p>
      </div>`,
  });

  fieldSel.addEventListener('change', () => {
    _browserFilters.field = fieldSel.value;
    updateBookResults({ resetScroll: true });
  });
  sortSel.addEventListener('change', () => {
    _browserFilters.sort = sortSel.value;
    updateBookResults({ resetScroll: true });
  });
  statusToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    _browserFilters.status = btn.dataset.val;
    syncStatusToggle(statusToggle, _browserFilters.status);
    updateBookResults({ resetScroll: true });
  });
  queryInput.addEventListener('input', () => {
    _browserFilters.query = queryInput.value;
    syncQuickSearchValue(queryInput.value);
    scheduleBookResults();
  });

  // Suggestions narrow to whichever field the user is filtering on.
  createAutocomplete(queryInput, {
    getPool: () => suggestionPoolForField(_browserFilters.field),
    onSelect: (label) => {
      _browserFilters.query = label;
      syncQuickSearchValue(label);
      updateBookResults({ resetScroll: true });
    },
    typeLabels: SUGGESTION_TYPE_LABELS,
  });

  updateBookResults({ resetScroll: true });
}

/** Maps a search field onto the suggestion types worth offering for it. */
function suggestionPoolForField(field) {
  const map = {
    all: null,
    title: 'title',
    author: 'author',
    publisher: 'publisher',
    referenceNumber: 'reference',
    category: 'category',
    borrowers: 'borrower',
  };
  const type = map[field];
  if (!type) return RAFF_STATE.suggestions;
  return RAFF_STATE.suggestions.filter((s) => s.type === type);
}

function syncStatusToggle(toggleEl, status) {
  toggleEl.querySelectorAll('button[data-val]').forEach((b) => {
    b.classList.toggle('active', b.dataset.val === status);
  });
}

/** Keeps the topbar field and the in-view field showing the same text
 *  without either one stealing focus from the other. */
function syncQuickSearchValue(value) {
  const quick = document.getElementById('quickSearchInput');
  if (quick && quick.value !== value && document.activeElement !== quick) quick.value = value;
}
function syncFilterInputValue(value) {
  const inView = document.getElementById('filterQuery');
  if (inView && inView.value !== value && document.activeElement !== inView) inView.value = value;
}

/** Coalesces bursts of keystrokes into a single filter pass per frame. */
function scheduleBookResults() {
  if (_queryDebounce) clearTimeout(_queryDebounce);
  _queryDebounce = setTimeout(() => {
    _queryDebounce = null;
    updateBookResults({ resetScroll: true });
  }, 50);
}

function updateBookResults({ resetScroll = false } = {}) {
  if (!_vlist) return;
  const results = queryBooks(RAFF_STATE.index, _browserFilters);
  _vlist.setItems(results, { resetScroll });
  const counter = document.getElementById('resultCount');
  if (counter) {
    counter.textContent = results.length === RAFF_STATE.books.length
      ? `${results.length} كتاب`
      : `${results.length} نتيجة من ${RAFF_STATE.books.length}`;
  }
}

function showSavedBookModal(record, { andNew = false } = {}) {
  let currentRef = record.referenceNumber;

  const html = `
    <div class="modal-body">
      <div class="ref-modal-icon">${icon('check')}</div>
      <p class="ref-book-title">${escapeHtml(record.title)}</p>
      <p class="ref-book-author">${escapeHtml(record.author) || 'بدون مؤلف محدد'}</p>

      <div class="ref-number-box">
        <div class="ref-number-label">الرقم المرجعي للكتاب</div>
        <div class="ref-number-value" id="refNumberValue">${escapeHtml(currentRef)}</div>
        <div class="ref-edit-row hidden" id="refEditRow">
          <input type="text" id="refEditInput" value="${escapeHtml(currentRef)}" />
          <button class="btn btn-primary btn-sm" id="refSaveBtn">${icon('check')}</button>
          <button class="btn btn-ghost btn-sm" id="refCancelBtn">${icon('x')}</button>
        </div>
        <button class="ref-edit-toggle" id="refEditToggle">${icon('edit', 12)} تغيير الرقم</button>
      </div>
      <p class="ref-hint">دوّن هذا الرقم على الكتاب لتحديد موقعه على الرف لاحقاً</p>

      <div class="form-actions" style="justify-content:center;">
        <button class="btn btn-outline" id="copyRefBtn">${icon('hash')} نسخ الرقم</button>
        <button class="btn btn-primary" id="closeRefModal">${icon('check')} تم</button>
      </div>
    </div>`;

  openModal(html, {
    onMount: (overlay) => {
      const valueEl = overlay.querySelector('#refNumberValue');
      const editRow = overlay.querySelector('#refEditRow');
      const editInput = overlay.querySelector('#refEditInput');
      const toggle = overlay.querySelector('#refEditToggle');

      const openEdit = () => {
        valueEl.classList.add('hidden');
        toggle.classList.add('hidden');
        editRow.classList.remove('hidden');
        editInput.value = currentRef;
        editInput.focus();
        editInput.select();
      };
      const closeEdit = () => {
        editRow.classList.add('hidden');
        valueEl.classList.remove('hidden');
        toggle.classList.remove('hidden');
      };
      const saveEdit = async () => {
        const next = editInput.value.trim();
        if (!next || next === currentRef) { closeEdit(); return; }
        const res = await window.raff.setReferenceNumber(record.id, next);
        if (!res.ok) { toast(res.error, 'error'); editInput.focus(); return; }
        currentRef = next;
        valueEl.textContent = next;
        closeEdit();
        await refreshState();
        refreshCurrentView();
        toast('تم تحديث الرقم المرجعي', 'success', 1800);
      };

      toggle.addEventListener('click', openEdit);
      overlay.querySelector('#refSaveBtn').addEventListener('click', saveEdit);
      overlay.querySelector('#refCancelBtn').addEventListener('click', closeEdit);
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); closeEdit(); }
      });

      overlay.querySelector('#copyRefBtn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(currentRef);
          toast('تم نسخ الرقم المرجعي', 'success', 1800);
        } catch (_) {
          toast('تعذّر نسخ الرقم', 'error');
        }
      });
      overlay.querySelector('#closeRefModal').addEventListener('click', closeModal);
    },
  });
}

/* =========================================================
   Add / Edit form
   ========================================================= */
function renderAddForm(root, editingBook) {
  const b = editingBook || {};
  const isEdit = !!editingBook;
  const meta = RAFF_STATE.meta;

  root.innerHTML = `
    <div class="panel form-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${isEdit ? 'تعديل بيانات الكتاب' : 'إضافة كتاب جديد'}</h2>
          <p class="panel-desc">الحقول المميزة بعلامة <span class="required">*</span> إلزامية، وبقية الحقول اختيارية</p>
        </div>
      </div>

      <form id="bookForm" novalidate>
        <div class="form-grid">
          <div class="field span-2" id="field-title">
            <label>${icon('book')} اسم الكتاب <span class="required">*</span></label>
            <input type="text" name="title" value="${escapeHtml(b.title)}" placeholder="مثال: مقدمة ابن خلدون" autofocus />
            <span class="error-msg hidden">هذا الحقل مطلوب</span>
          </div>

          <div class="field" id="field-author">
            <label>${icon('user')} المؤلف <span class="required">*</span></label>
            <div class="ac-anchor"><input type="text" name="author" value="${escapeHtml(b.author)}" placeholder="اسم المؤلف" /></div>
            <span class="error-msg hidden">هذا الحقل مطلوب</span>
          </div>

          <div class="field">
            <label>${icon('building')} دار النشر</label>
            <div class="ac-anchor"><input type="text" name="publisher" value="${escapeHtml(b.publisher)}" placeholder="اسم دار النشر" /></div>
          </div>

          <div class="field">
            <label>${icon('tag')} المجال / التصنيف</label>
            <div class="ac-anchor"><input type="text" name="category" value="${escapeHtml(b.category)}" placeholder="مثال: أدب، تفسير، فقه" /></div>
          </div>

          ${isEdit ? `
          <div class="field">
            <label>${icon('hash')} الرقم المرجعي</label>
            <input type="text" name="referenceNumber" value="${escapeHtml(b.referenceNumber)}" />
          </div>` : `
          <div class="field">
            <label>${icon('hash')} الرقم المرجعي</label>
            <input type="text" value="يُنشأ تلقائياً بعد الحفظ" disabled />
          </div>`}

          <div class="field">
            <label>${icon('layers')} الطبعة</label>
            <input type="text" name="edition" value="${escapeHtml(b.edition)}" placeholder="مثال: الطبعة الثالثة" />
          </div>

          <div class="field">
            <label>${icon('calendar')} سنة النشر</label>
            <input type="text" name="publishYear" value="${escapeHtml(b.publishYear)}" placeholder="مثال: 1432هـ" />
          </div>

          <div class="field">
            <label>${icon('layers')} عدد الأجزاء</label>
            <input type="number" name="volumes" min="1" value="${b.volumes || 1}" />
          </div>

          <div class="field">
            <label>${icon('tag')} السعر <span class="optional">(اختياري)</span></label>
            <input type="number" name="price" min="0" step="0.01" value="${b.price ?? ''}" placeholder="مثال: 150" />
          </div>

          <div class="field">
            <label>${icon('copies')} عدد النسخ</label>
            <input type="number" name="copiesTotal" min="${isEdit ? Math.max(1, RaffBook.borrowedCopies(b)) : 1}" value="${b.copiesTotal || 1}" />
            ${isEdit && RaffBook.borrowedCopies(b) > 0
              ? `<span class="hint">لا يمكن أن يقل عن ${RaffBook.borrowedCopies(b)} (نسخ معارة حالياً)</span>`
              : ''}
          </div>

          <div class="field">
            <label>${icon('layers')} السلسلة <span class="optional">(اختياري)</span></label>
            <div class="ac-anchor"><input type="text" name="series" value="${escapeHtml(b.series || '')}" placeholder="مثال: سلسلة أعلام" /></div>
          </div>

          <div class="field">
            <label>${icon('hash')} الترتيب في السلسلة</label>
            <input type="text" name="seriesOrder" value="${escapeHtml(b.seriesOrder || '')}" placeholder="مثال: 4" />
          </div>

          <div class="field">
            <label>${icon('book')} الرف</label>
            <div class="ac-anchor"><input type="text" name="shelf" value="${escapeHtml(b.shelf || '')}" placeholder="مثال: A-12" /></div>
          </div>

          <div class="field">
            <label>${icon('check')} حالة النسخة</label>
            <select name="condition">
              ${['جيدة', 'مقبولة', 'تالفة', 'مفقودة'].map((c) => `<option value="${c}" ${(b.condition || 'جيدة') === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>

          <div class="field">
            <label>${icon('building')} جهة الاقتناء</label>
            <input type="text" name="acquisition" value="${escapeHtml(b.acquisition || '')}" placeholder="مثال: شراء، هدية، وقف" />
          </div>

          <div class="field span-3">
            <label>${icon('tag')} الكلمات المفتاحية <span class="optional">(افصل بينها بفاصلة)</span></label>
            <input type="text" name="keywords" value="${escapeHtml((b.keywords || []).join('، '))}" placeholder="مثال: عقيدة، توحيد، أسماء وصفات" />
          </div>

          <div class="field span-3">
            <label>${icon('note')} ملاحظات</label>
            <input type="text" name="notes" value="${escapeHtml(b.notes)}" placeholder="أي تفاصيل إضافية عن الكتاب أو نسخته..." />
          </div>
        </div>

        ${isEdit ? '' : `<p class="form-note">${icon('info', 13)} تُسجَّل الإعارات لاحقاً من نافذة تفاصيل الكتاب، وتُحتسب حالة الكتاب تلقائياً حسب النسخ المتاحة.</p>`}

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${icon('check')} ${isEdit ? 'حفظ التعديلات' : 'حفظ الكتاب'}</button>
          ${!isEdit ? `<button type="button" class="btn btn-outline" id="saveAndNew">${icon('plus')} حفظ وإضافة آخر</button>` : ''}
          <button type="button" class="btn btn-ghost" id="cancelForm">إلغاء</button>
          <span class="form-hint-inline">${isEdit ? '' : 'سيظهر الرقم المرجعي في نافذة بعد الحفظ'}</span>
        </div>
      </form>
    </div>
  `;

  const form = root.querySelector('#bookForm');

  // Predictive suggestions on the fields where consistency matters most.
  [['author', 'author'], ['publisher', 'publisher'], ['category', 'category']].forEach(([name, type]) => {
    const input = form.querySelector(`[name=${name}]`);
    if (!input) return;
    createAutocomplete(input, {
      getPool: () => (type === 'category' ? categoryPool() : RAFF_STATE.suggestions.filter((s) => s.type === type)),
      onSelect: () => {},
      typeLabels: SUGGESTION_TYPE_LABELS,
    });
  });

  // Series and shelf suggest from what's already in use.
  [['series', 'series'], ['shelf', 'shelves']].forEach(([name, metaKey]) => {
    const input = form.querySelector(`[name=${name}]`);
    if (!input) return;
    createAutocomplete(input, {
      getPool: () => (RAFF_STATE.meta[metaKey] || []).map((v) => ({ label: v, type: name, norm: normalizeArabic(v) })),
      onSelect: () => {},
      typeLabels: SUGGESTION_TYPE_LABELS,
    });
  });

  function validate(data) {
    let valid = true;
    [['title', 'field-title'], ['author', 'field-author']].forEach(([key, id]) => {
      const fieldEl = root.querySelector('#' + id);
      const ok = (data[key] || '').trim().length > 0;
      fieldEl.classList.toggle('invalid', !ok);
      fieldEl.querySelector('.error-msg')?.classList.toggle('hidden', ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  async function submitHandler(andNew) {
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!validate(data)) {
      toast('الرجاء إكمال الحقول الإلزامية', 'error');
      return;
    }
    try {
      if (isEdit) {
        const newRef = (data.referenceNumber || '').trim();
        if (newRef && newRef !== editingBook.referenceNumber) {
          const refRes = await window.raff.setReferenceNumber(editingBook.id, newRef);
          if (!refRes.ok) { toast(refRes.error, 'error'); return; }
        }
        await window.raff.updateBook(editingBook.id, data);
        toast('تم تحديث بيانات الكتاب بنجاح', 'success');
        await refreshState();
        renderNavCounts();
        navigateTo('library');
      } else {
        const record = await window.raff.addBook(data);
        await refreshState();
        renderNavCounts();
        navigateTo(andNew ? 'add' : 'library');
        showSavedBookModal(record, { andNew });
      }
    } catch (err) {
      toast('حدث خطأ أثناء الحفظ: ' + err.message, 'error');
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); submitHandler(false); });
  root.querySelector('#cancelForm').addEventListener('click', () => navigateTo(isEdit ? 'library' : 'dashboard'));
  root.querySelector('#saveAndNew')?.addEventListener('click', () => submitHandler(true));
}

/** Common categories, offered even before any book uses them. */
const DEFAULT_CATEGORIES = [
  'تفسير', 'حديث', 'فقه', 'أصول الفقه', 'عقيدة',
  'سيرة', 'تاريخ', 'أدب', 'لغة عربية', 'تزكية وأخلاق',
];

function categoryPool() {
  const used = RAFF_STATE.suggestions.filter((s) => s.type === 'category');
  const seen = new Set(used.map((s) => s.label));
  const defaults = DEFAULT_CATEGORIES
    .filter((c) => !seen.has(c))
    .map((c) => ({ label: c, type: 'category', norm: normalizeArabic(c) }));
  // Categories already in the library rank first; defaults fill the rest.
  return used.concat(defaults);
}

/* =========================================================
   Library table (distinct from search: columnar, sortable, dense)
   ========================================================= */
const LIBRARY_COLUMNS = [
  { key: 'title', label: 'العنوان', align: 'start', grow: 1.6 },
  { key: 'author', label: 'المؤلف', align: 'start', grow: 1.1 },
  { key: 'publisher', label: 'دار النشر', align: 'start', grow: 1.1, hide: 'md' },
  { key: 'category', label: 'المجال', align: 'start', grow: 0.9, hide: 'narrow' },
  { key: 'publishYear', label: 'السنة', align: 'center', grow: 0.6, hide: 'narrow' },
  { key: 'volumes', label: 'أجزاء', align: 'center', grow: 0.5, hide: 'md' },
  { key: 'price', label: 'السعر', align: 'center', grow: 0.7, hide: 'narrow' },
  { key: 'availableCopies', label: 'متاح/الكل', align: 'center', grow: 0.7 },
  { key: 'status', label: 'الحالة', align: 'center', grow: 0.9 },
  { key: 'referenceNumber', label: 'الرقم المرجعي', align: 'center', grow: 0.9, ltr: true },
];

const LIB_ROW_HEIGHT = 44;
const LIB_ROW_GAP = 0;
const LIB_ROW_STEP = LIB_ROW_HEIGHT + LIB_ROW_GAP;

let _libSort = { key: 'title', dir: 'asc' };
let _libFilters = { query: '', status: 'all', priceMin: '', priceMax: '' };
let _libVlist = null;
let _libDebounce = null;

function libCellValue(book, key) {
  switch (key) {
    case 'availableCopies': return RaffBook.availableFullCopies(book);
    case 'status': return RaffBook.bookStatus(book);
    case 'price': return typeof book.price === 'number' ? book.price : -1;
    case 'volumes': return book.volumes || 1;
    default: return book[key];
  }
}

const LIB_COLLATOR = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

function sortLibrary(books, { key, dir }) {
  const d = dir === 'asc' ? 1 : -1;
  const numeric = new Set(['availableCopies', 'price', 'volumes']);
  const arr = [...books];
  if (numeric.has(key)) {
    arr.sort((a, b) => ((libCellValue(a, key) ?? 0) - (libCellValue(b, key) ?? 0)) * d);
  } else {
    arr.sort((a, b) => LIB_COLLATOR.compare(
      (libCellValue(a, key) || '').toString(),
      (libCellValue(b, key) || '').toString()
    ) * d);
  }
  return arr;
}

function renderLibraryTable(root) {
  if (_libVlist) { _libVlist.destroy(); _libVlist = null; }

  const gridTemplate = LIBRARY_COLUMNS.map((c) => `minmax(0, ${c.grow}fr)`).join(' ');

  root.innerHTML = `
    <div class="panel library-panel">
      <div class="filters-row">
        <div class="ac-anchor lib-query-wrap">
          <input type="text" id="libQuery" placeholder="تصفية سريعة في الجدول..." autocomplete="off" />
        </div>
        <div class="chip-toggle" id="libStatusToggle">
          <button data-val="all">الكل</button>
          <button data-val="${RaffBook.STATUS_AVAILABLE}">متاح</button>
          <button data-val="${RaffBook.STATUS_PARTIAL}">جزئي</button>
          <button data-val="${RaffBook.STATUS_FULL}">معار</button>
          <button data-val="overdue">متأخر</button>
          <button data-val="duesoon">يستحق قريبًا</button>
        </div>
        <div class="price-range">
          <input type="number" id="libPriceMin" placeholder="سعر من" min="0" />
          <span class="price-range-sep">—</span>
          <input type="number" id="libPriceMax" placeholder="إلى" min="0" />
        </div>
        <span class="result-count" id="libCount"></span>
      </div>

      <div class="lib-table" style="--lib-cols:${gridTemplate};">
        <div class="lib-head" id="libHead">
          ${LIBRARY_COLUMNS.map((c) => `
            <button class="lib-th sortable ${c.hide ? 'hide-' + c.hide : ''} ${c.key === _libSort.key ? 'sorted' : ''}"
              data-sort="${c.key}" style="text-align:${c.align === 'start' ? 'right' : 'center'};">
              ${escapeHtml(c.label)}<span class="sort-arrow">${c.key === _libSort.key ? (_libSort.dir === 'asc' ? '▲' : '▼') : ''}</span>
            </button>`).join('')}
        </div>
        <div class="lib-scroll" id="libScroll"></div>
      </div>
    </div>`;

  const scrollEl = root.querySelector('#libScroll');
  const queryInput = root.querySelector('#libQuery');
  queryInput.value = _libFilters.query;
  root.querySelector('#libPriceMin').value = _libFilters.priceMin;
  root.querySelector('#libPriceMax').value = _libFilters.priceMax;
  syncStatusToggle(root.querySelector('#libStatusToggle'), _libFilters.status);

  _libVlist = createVirtualList(scrollEl, {
    rowStep: LIB_ROW_STEP,
    rowHeight: LIB_ROW_HEIGHT,
    renderRow: (book) => renderLibraryRow(book),
    emptyHtml: `<div class="empty-state">${icon('book')}<h3>لا توجد نتائج</h3><p>غيّر معايير التصفية.</p></div>`,
  });

  root.querySelector('#libHead').addEventListener('click', (e) => {
    const th = e.target.closest('.lib-th[data-sort]');
    if (!th) return;
    const key = th.dataset.sort;
    if (_libSort.key === key) _libSort.dir = _libSort.dir === 'asc' ? 'desc' : 'asc';
    else { _libSort.key = key; _libSort.dir = (key === 'price' || key === 'availableCopies' || key === 'volumes') ? 'desc' : 'asc'; }
    renderLibraryTable(root);
  });

  const applyFilters = () => {
    if (_libDebounce) clearTimeout(_libDebounce);
    _libDebounce = setTimeout(() => { _libDebounce = null; updateLibraryResults(); }, 60);
  };
  queryInput.addEventListener('input', () => { _libFilters.query = queryInput.value; applyFilters(); });
  root.querySelector('#libPriceMin').addEventListener('input', (e) => { _libFilters.priceMin = e.target.value; applyFilters(); });
  root.querySelector('#libPriceMax').addEventListener('input', (e) => { _libFilters.priceMax = e.target.value; applyFilters(); });
  root.querySelector('#libStatusToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    _libFilters.status = btn.dataset.val;
    syncStatusToggle(root.querySelector('#libStatusToggle'), _libFilters.status);
    applyFilters();
  });

  createAutocomplete(queryInput, {
    getPool: () => RAFF_STATE.suggestions,
    onSelect: (label) => { _libFilters.query = label; updateLibraryResults(); },
    typeLabels: SUGGESTION_TYPE_LABELS,
  });

  updateLibraryResults();
}

/** True if the book has an open loan that is overdue / due within 7 days. */
function bookHasLoanState(book, state) {
  for (const l of book.loans || []) {
    if (l.returnedAt) continue;
    if (state === 'overdue' && RaffBook.isOverdue(l, 30)) return true;
    if (state === 'duesoon' && !RaffBook.isOverdue(l, 30) && RaffBook.isDueSoon(l, 7)) return true;
  }
  return false;
}

function updateLibraryResults() {
  if (!_libVlist) return;
  const q = normalizeArabic(_libFilters.query);
  const min = _libFilters.priceMin === '' ? null : Number(_libFilters.priceMin);
  const max = _libFilters.priceMax === '' ? null : Number(_libFilters.priceMax);

  const status = _libFilters.status;
  const loanFilter = status === 'overdue' || status === 'duesoon';
  let rows = RAFF_STATE.index;
  let filtered = [];
  for (let i = 0; i < rows.length; i++) {
    const entry = rows[i];
    if (!loanFilter && status !== 'all' && entry.status !== status) continue;
    if (loanFilter && !bookHasLoanState(entry.book, status)) continue;
    if (q && entry.all.indexOf(q) === -1) continue;
    if (min !== null || max !== null) {
      const p = entry.book.price;
      if (typeof p !== 'number') continue;
      if (min !== null && p < min) continue;
      if (max !== null && p > max) continue;
    }
    filtered.push(entry.book);
  }

  const sorted = sortLibrary(filtered, _libSort);
  _libVlist.setItems(sorted, { resetScroll: true });

  const counter = document.getElementById('libCount');
  if (counter) {
    counter.textContent = sorted.length === RAFF_STATE.books.length
      ? `${sorted.length} كتاب`
      : `${sorted.length} من ${RAFF_STATE.books.length}`;
  }
}

function renderLibraryRow(book) {
  const status = RaffBook.bookStatus(book);
  const statusCls = status === RaffBook.STATUS_AVAILABLE ? 'st-avail'
    : status === RaffBook.STATUS_PARTIAL ? 'st-partial' : 'st-full';
  const avail = RaffBook.availableFullCopies(book);
  const total = RaffBook.totalCopies(book);
  const price = typeof book.price === 'number' ? formatPrice(book.price) : '—';
  const spine = spineColorFor(book.category || book.author);

  const cell = (c, content) => `<div class="lib-td ${c.hide ? 'hide-' + c.hide : ''} ${c.ltr ? 'ltr' : ''}" style="text-align:${c.align === 'start' ? 'right' : 'center'};">${content}</div>`;

  return `<div class="lib-row" data-id="${book.id}" role="button" tabindex="0" style="--spine:${spine};">
    ${cell(LIBRARY_COLUMNS[0], `<span class="lib-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title) || 'بدون عنوان'}</span>`)}
    ${cell(LIBRARY_COLUMNS[1], escapeHtml(book.author) || '—')}
    ${cell(LIBRARY_COLUMNS[2], escapeHtml(book.publisher) || '—')}
    ${cell(LIBRARY_COLUMNS[3], escapeHtml(book.category) || '—')}
    ${cell(LIBRARY_COLUMNS[4], escapeHtml(book.publishYear) || '—')}
    ${cell(LIBRARY_COLUMNS[5], book.volumes || 1)}
    ${cell(LIBRARY_COLUMNS[6], price)}
    ${cell(LIBRARY_COLUMNS[7], `<span class="${avail === 0 ? 'num-warn' : 'num-ok'}">${avail}</span><span class="lib-total">/${total}</span>`)}
    ${cell(LIBRARY_COLUMNS[8], `<span class="lib-status ${statusCls}">${status}</span>`)}
    ${cell(LIBRARY_COLUMNS[9], escapeHtml(book.referenceNumber))}
  </div>`;
}

/* =========================================================
   Reports / lookup console
   ========================================================= */
let _reportState = { dim: 'borrower', value: '', sortKey: null, sortDir: 'desc' };
let _reportAc = null;

function renderReports(root) {
  const { dim, value } = _reportState;
  const dimDef = DIMENSIONS[dim];

  root.innerHTML = `
    <div class="panel reports-panel">
      <div class="reports-toolbar">
        <div class="dim-chips" id="dimChips">
          ${Object.values(DIMENSIONS).map((d) => `
            <button class="dim-chip ${d.key === dim ? 'active' : ''}" data-dim="${d.key}">
              ${icon(d.icon, 14)}<span>${d.label}</span>
            </button>`).join('')}
        </div>

        <div class="reports-lookup ac-anchor">
          ${icon('search', 15)}
          <input type="text" id="reportLookup" placeholder="اكتب ${escapeHtml(dimDef.singular)} للاستدعاء..." />
          ${value ? `<button class="lookup-clear" id="lookupClear" aria-label="مسح">${icon('x', 13)}</button>` : ''}
        </div>
      </div>

      <div class="reports-body" id="reportsBody"></div>
    </div>`;

  const chips = root.querySelector('#dimChips');
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dim]');
    if (!btn) return;
    _reportState = { dim: btn.dataset.dim, value: '', sortKey: null, sortDir: 'desc' };
    renderReports(root);
  });

  const lookup = root.querySelector('#reportLookup');
  lookup.value = value;

  if (_reportAc) { _reportAc.destroy(); _reportAc = null; }
  _reportAc = createAutocomplete(lookup, {
    getPool: () => reportPoolFor(dim),
    onSelect: (label) => {
      _reportState.value = label;
      renderReports(root);
    },
    typeLabels: SUGGESTION_TYPE_LABELS,
    minChars: 1,
  });

  lookup.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && lookup.value.trim()) {
      _reportState.value = lookup.value.trim();
      renderReports(root);
    }
  });

  root.querySelector('#lookupClear')?.addEventListener('click', () => {
    _reportState.value = '';
    renderReports(root);
  });

  renderReportsBody(root.querySelector('#reportsBody'), root);
}

/** The suggestion pool for the currently selected dimension. */
function reportPoolFor(dim) {
  const typeByDim = {
    borrower: 'borrower', publisher: 'publisher',
    author: 'author', category: 'category',
  };
  const metaByDim = {
    year: 'years', shelf: 'shelves', series: 'series',
  };
  if (metaByDim[dim]) {
    return (RAFF_STATE.meta[metaByDim[dim]] || []).map((v) => ({ label: v, type: dim, norm: normalizeArabic(v) }));
  }
  if (dim === 'condition') {
    return ['جيدة', 'مقبولة', 'تالفة', 'مفقودة'].map((v) => ({ label: v, type: 'condition', norm: normalizeArabic(v) }));
  }
  const type = typeByDim[dim];
  return RAFF_STATE.suggestions.filter((s) => s.type === type);
}

function renderReportsBody(body, root) {
  const { dim, value } = _reportState;
  const index = RAFF_STATE.reportIndex;
  const dimDef = DIMENSIONS[dim];

  if (!value) {
    // Clone the column set and relabel the first column with this dimension's
    // name so the header always matches the data beneath it.
    const baseCols = dim === 'borrower' ? RANK_COLUMNS.borrower : RANK_COLUMNS.other;
    const cols = baseCols.map((c) => (c.key === 'value' ? { ...c, label: dimDef.singular } : c));
    const sortKey = _reportState.sortKey || cols[1].key;
    const sortDir = _reportState.sortDir;
    const ranked = rankDimension(index, dim, { limit: 500, sortKey, sortDir });
    if (!ranked.length) {
      body.innerHTML = `<div class="empty-state">${icon('stack')}<h3>لا توجد بيانات</h3>
        <p>لم تُسجَّل بعد أي ${escapeHtml(dimDef.label)} في المكتبة.</p></div>`;
      return;
    }

    const isBorrower = dim === 'borrower';
    const fmt = (r, c) => {
      let v = r[c.key];
      if (c.key === 'worth') v = v ? formatPrice(v) : '—';
      const cls = c.key === 'available' ? 'num num-ok'
        : (c.key === 'borrowed' && r[c.key]) ? 'num num-warn'
        : (c.key === 'activeLoans' && r[c.key]) ? 'num num-warn' : '';
      const text = c.suffix && v ? `${v}${c.suffix}` : (v === 0 && c.key !== 'value' ? '0' : (v || (c.key === 'value' ? 'غير محدد' : '—')));
      return cls ? `<span class="${cls}">${escapeHtml(String(text))}</span>` : escapeHtml(String(text));
    };

    const arrow = (key) => key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

    body.innerHTML = `
      <div class="report-summary">
        <span class="report-summary-title">${icon(dimDef.icon, 15)} ترتيب ${escapeHtml(dimDef.label)}</span>
        <span class="report-summary-meta">${ranked.length} ${isBorrower ? 'مستعيراً' : 'قيمة'} · اضغط رأس أي عمود للترتيب</span>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              ${cols.map((c) => `<th class="sortable ${c.key === sortKey ? 'sorted' : ''}" data-sort="${c.key}" style="text-align:${c.align === 'start' ? 'right' : 'center'};">${escapeHtml(c.label)}${arrow(c.key)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${ranked.map((r, i) => `
              <tr class="report-clickable" data-value="${escapeHtml(r.value)}">
                <td class="rank-num">${i + 1}</td>
                ${cols.map((c, ci) => `<td class="${ci === 0 ? 'rank-value' : ''}" style="text-align:${c.align === 'start' ? 'right' : 'center'};">${fmt(r, c)}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    body.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (_reportState.sortKey === key) {
          _reportState.sortDir = _reportState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _reportState.sortKey = key;
          // Names default to A→Z; numeric columns default to highest-first.
          _reportState.sortDir = key === 'value' ? 'asc' : 'desc';
        }
        renderReportsBody(body, root);
      });
    });

    body.querySelectorAll('.report-clickable').forEach((tr) => {
      tr.addEventListener('click', () => {
        _reportState.value = tr.dataset.value;
        renderReports(root);
      });
    });
    return;
  }

  const report = reportFor(index, dim, value);
  if (!report) {
    body.innerHTML = `<div class="empty-state">${icon('search')}<h3>لا توجد نتائج</h3>
      <p>لم يُعثر على "${escapeHtml(value)}" ضمن ${escapeHtml(dimDef.label)}.</p></div>`;
    return;
  }

  body.innerHTML = `
    <div class="report-header">
      <div>
        <span class="report-eyebrow">${icon(dimDef.icon, 13)} ${escapeHtml(dimDef.singular)}</span>
        <h3 class="report-value">${escapeHtml(report.value) || 'غير محدد'}</h3>
      </div>
      <button class="btn btn-ghost btn-sm" id="backToRank">${icon('refresh')} عرض الترتيب الكامل</button>
    </div>

    <div class="kpi-grid">
      ${report.kpis.map((k) => `
        <div class="kpi-card ${k.tone ? 'kpi-' + k.tone : ''}">
          <div class="kpi-value">${k.value}${k.suffix ? `<span class="kpi-suffix">${k.suffix}</span>` : ''}</div>
          <div class="kpi-label">${k.label}</div>
        </div>`).join('')}
    </div>

    <div class="report-table-wrap">
      <table class="report-table">
        <thead><tr>${report.columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>
          ${report.rows.map((r) => `
            <tr class="report-row-${r.state} report-book" data-book="${r.bookId}">
              ${r.cells.map((c, i) => `<td class="${i === 0 ? 'cell-title' : ''} ${i === 1 ? 'cell-ref' : ''}">${escapeHtml(String(c))}</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  body.querySelector('#backToRank').addEventListener('click', () => {
    _reportState.value = '';
    renderReports(root);
  });
  body.querySelectorAll('.report-book').forEach((tr) => {
    tr.addEventListener('click', () => showBookDetails(tr.dataset.book));
  });
}

/* =========================================================
   Statistics
   ========================================================= */
function renderStats(root) {
  const { stats } = RAFF_STATE;
  const cats = Object.entries(stats.byCategory || {}).sort((a, b) => b[1] - a[1]);
  const pubs = Object.entries(stats.byPublisher || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCat = Math.max(1, ...cats.map((c) => c[1]));
  const maxPub = Math.max(1, ...pubs.map((c) => c[1]));

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon">${icon('book', 18)}</div><div><div class="stat-value">${stats.totalBooks ?? 0}</div><div class="stat-label">إجمالي العناوين</div></div></div>
      <div class="stat-card"><div class="stat-icon">${icon('copies', 18)}</div><div><div class="stat-value">${stats.totalCopies ?? 0}</div><div class="stat-label">إجمالي النسخ</div></div></div>
      <div class="stat-card stat-success"><div class="stat-icon">${icon('check', 18)}</div><div><div class="stat-value">${stats.availableCopies ?? 0}</div><div class="stat-label">نسخ متاحة</div></div></div>
      <div class="stat-card stat-danger"><div class="stat-icon">${icon('user', 18)}</div><div><div class="stat-value">${stats.borrowedCopies ?? 0}</div><div class="stat-label">نسخ معارة</div></div></div>
    </div>

    <div class="settings-grid">
      <div class="panel">
        <div class="panel-header"><h2 class="panel-title">حسب المجال</h2></div>
        ${cats.length ? `<div class="bar-chart">${cats.map(([k, v]) => `
          <div class="bar-row">
            <div class="bar-row-label">${escapeHtml(k)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(v / maxCat) * 100}%;"></div></div>
            <div class="bar-row-value">${v}</div>
          </div>`).join('')}</div>` : `<p class="text-muted">لا توجد بيانات كافية بعد.</p>`}
      </div>

      <div class="panel">
        <div class="panel-header"><h2 class="panel-title">أكثر دور النشر</h2></div>
        ${pubs.length ? `<div class="bar-chart">${pubs.map(([k, v]) => `
          <div class="bar-row">
            <div class="bar-row-label">${escapeHtml(k)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(v / maxPub) * 100}%;"></div></div>
            <div class="bar-row-value">${v}</div>
          </div>`).join('')}</div>` : `<p class="text-muted">لا توجد بيانات كافية بعد.</p>`}
      </div>
    </div>
  `;
}

/* =========================================================
   Settings / Backup
   ========================================================= */
/** Shows the result of a data integrity check in a modal. */
function showIntegrityReport(report) {
  const section = (title, items, render, tone) => `
    <div class="integrity-section">
      <div class="integrity-head ${items.length ? 'has-' + tone : 'ok'}">
        ${icon(items.length ? 'alert' : 'check', 14)}
        <span>${title}</span>
        <span class="integrity-count">${items.length}</span>
      </div>
      ${items.length ? `<div class="integrity-items">${items.slice(0, 12).map(render).join('')}${items.length > 12 ? `<div class="integrity-more">و${items.length - 12} أخرى…</div>` : ''}</div>` : ''}
    </div>`;

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${icon('check')} فحص سلامة البيانات</h3>
      <button class="btn btn-ghost btn-icon" id="integClose" aria-label="إغلاق">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="integrity-summary ${report.healthy ? 'is-healthy' : 'has-issues'}">
        ${report.healthy
          ? `${icon('check', 20)} <span>البيانات سليمة — لا مشاكل في ${report.totalBooks} كتاب</span>`
          : `${icon('alert', 20)} <span>تم رصد بعض النقاط في ${report.totalBooks} كتاب</span>`}
      </div>
      ${section('إعارات متأخرة', report.overdue, (o) => `<button class="integrity-item" data-book="${o.bookId}"><span>${escapeHtml(o.borrower)} — ${escapeHtml(o.title)}</span><span class="integrity-tag danger">${o.days} يوم</span></button>`, 'danger')}
      ${section('أرقام مرجعية مكررة', report.duplicateRefs, (d) => `<div class="integrity-item"><span>${escapeHtml(d.ref)}</span><span class="integrity-tag danger">${d.count} كتب</span></div>`, 'danger')}
      ${section('بيانات ناقصة', report.missing, (m) => `<button class="integrity-item" data-book="${m.bookId}"><span>${escapeHtml(m.title)}</span><span class="integrity-tag warn">${m.gaps.join('، ')}</span></button>`, 'warn')}
      ${section('عناوين مكررة محتملة', report.possibleDuplicates, (p) => `<div class="integrity-item"><span>${escapeHtml(p.title)} — ${escapeHtml(p.author || '؟')}</span><span class="integrity-tag warn">${p.count} نسخ</span></div>`, 'warn')}
    </div>`;

  openModal(html, {
    onMount: (overlay) => {
      overlay.querySelector('#integClose').addEventListener('click', closeModal);
      overlay.querySelectorAll('.integrity-item[data-book]').forEach((el) => {
        el.addEventListener('click', () => { closeModal(); showBookDetails(el.dataset.book); });
      });
    },
  });
}

function renderSettings(root) {
  const meta = RAFF_STATE.meta;
  const exportRow = (title, desc, id) => `
    <div class="setting-action">
      <div>
        <div class="setting-action-title">${title}</div>
        <div class="setting-action-desc">${desc}</div>
      </div>
      <button class="btn btn-outline btn-sm" id="${id}">${icon('download')} تصدير</button>
    </div>`;

  root.innerHTML = `
    <div class="settings-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">تصدير المكتبة</h2>
            <p class="panel-desc">احفظ فهرسك بالصيغة التي تناسبك</p>
          </div>
        </div>
        ${exportRow('نسخة احتياطية كاملة (JSON)', 'قابلة للاستيراد لاحقاً على أي جهاز', 'exportJsonBtn')}
        ${exportRow('جدول بيانات (CSV)', 'لفتحه في Excel', 'exportCsvBtn')}
        ${exportRow('ملف نصي (TXT)', 'قائمة مقروءة بجميع الكتب', 'exportTxtBtn')}
        ${exportRow('تقرير (PDF)', 'جدول منسّق جاهز للطباعة', 'exportPdfBtn')}
        ${exportRow('الإعارات المتأخرة (CSV)', 'المتأخرة فقط مع وسيلة التواصل', 'exportOverdueBtn')}
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">الصيانة والأمان</h2>
            <p class="panel-desc">النسخ الاحتياطية وفحص سلامة البيانات</p>
          </div>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">نسخة أمان فورية</div>
            <div class="setting-action-desc">حفظ لقطة داخلية يمكن الرجوع إليها</div>
          </div>
          <button class="btn btn-outline btn-sm" id="backupBtn">${icon('copies')} إنشاء نسخة</button>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">فحص سلامة البيانات</div>
            <div class="setting-action-desc">كشف المتأخرات والنواقص والتكرار المحتمل</div>
          </div>
          <button class="btn btn-outline btn-sm" id="integrityBtn">${icon('check')} فحص الآن</button>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">مجلد بيانات البرنامج</div>
            <div class="setting-action-desc">يحوي قاعدة البيانات والنسخ الاحتياطية</div>
          </div>
          <button class="btn btn-outline btn-sm" id="openFolderBtn">${icon('building')} فتح المجلد</button>
        </div>
        <div class="setting-action">
          <div>
            <div class="setting-action-title">استيراد نسخة احتياطية</div>
            <div class="setting-action-desc">تُنشأ نسخة أمان تلقائياً قبل الاستيراد</div>
          </div>
          <button class="btn btn-outline btn-sm" id="importJsonBtn">${icon('upload')} استيراد</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">معلومات النظام</h2>
            <p class="panel-desc">نظرة سريعة على المكتبة</p>
          </div>
        </div>
        <div class="system-stats">
          <div class="system-stat"><span class="system-stat-value">${RAFF_STATE.books.length}</span><span class="system-stat-label">كتاب</span></div>
          <div class="system-stat"><span class="system-stat-value">${meta.authors.length}</span><span class="system-stat-label">مؤلف</span></div>
          <div class="system-stat"><span class="system-stat-value">${meta.publishers.length}</span><span class="system-stat-label">دار نشر</span></div>
          <div class="system-stat"><span class="system-stat-value">${meta.series.length}</span><span class="system-stat-label">سلسلة</span></div>
        </div>

        <div class="db-path">
          <span class="setting-action-desc">مسار ملف البيانات</span>
          <code title="${escapeHtml(meta.filePath)}">${escapeHtml(meta.filePath)}</code>
        </div>

        <div class="danger-zone">
          <div>
            <div class="setting-action-title" style="color:var(--danger);">حذف جميع بيانات المكتبة</div>
            <div class="setting-action-desc">تُنشأ نسخة أمان تلقائياً قبل الحذف</div>
          </div>
          <button class="btn btn-danger btn-sm" id="resetAllBtn">${icon('trash')} حذف الكل</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#exportJsonBtn').addEventListener('click', async () => {
    const res = await window.raff.exportJson();
    if (res.ok) toast('تم حفظ النسخة الاحتياطية بنجاح', 'success');
  });
  root.querySelector('#exportCsvBtn').addEventListener('click', async () => {
    const res = await window.raff.exportCsv();
    if (res.ok) toast('تم تصدير الملف بصيغة CSV', 'success');
  });
  root.querySelector('#exportTxtBtn').addEventListener('click', async () => {
    const res = await window.raff.exportTxt();
    if (res.ok) toast('تم تصدير الملف النصي بنجاح', 'success');
  });
  root.querySelector('#exportPdfBtn').addEventListener('click', async () => {
    const btn = root.querySelector('#exportPdfBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'جارٍ التصدير...';
    try {
      const res = await window.raff.exportPdf();
      if (res.ok) toast('تم تصدير ملف PDF بنجاح', 'success');
      else if (res.error) toast('فشل تصدير PDF: ' + res.error, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
  root.querySelector('#exportOverdueBtn').addEventListener('click', async () => {
    const res = await window.raff.exportOverdueCsv();
    if (res.ok) toast(`تم تصدير ${res.count} إعارة متأخرة`, 'success');
  });
  root.querySelector('#backupBtn').addEventListener('click', async () => {
    const res = await window.raff.backup();
    if (res.ok) toast('تم إنشاء نسخة أمان', 'success');
    else toast('تعذّر إنشاء النسخة', 'error');
  });
  root.querySelector('#openFolderBtn').addEventListener('click', async () => {
    const res = await window.raff.openDataFolder();
    if (!res.ok) toast('تعذّر فتح المجلد', 'error');
  });
  root.querySelector('#integrityBtn').addEventListener('click', async () => {
    const res = await window.raff.integrityCheck();
    if (res.ok) showIntegrityReport(res.report);
    else toast('تعذّر إجراء الفحص', 'error');
  });
  root.querySelector('#importJsonBtn').addEventListener('click', async () => {
    const res = await window.raff.importJson();
    if (res.ok) {
      toast(`تم استيراد ${res.added} كتاب${res.skipped ? ` (تم تجاهل ${res.skipped} مكرر)` : ''}`, 'success');
      await refreshState();
      renderNavCounts();
      renderRoute();
    } else if (res.error) {
      toast('فشل الاستيراد: ' + res.error, 'error');
    }
  });
  root.querySelector('#resetAllBtn').addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'حذف جميع بيانات المكتبة؟',
      message: 'ستُنشأ نسخة أمان تلقائياً قبل الحذف يمكن الرجوع إليها من مجلد البيانات. هل تريد المتابعة؟',
      confirmLabel: 'حذف كل شيء',
    });
    if (!ok) return;
    const res = await window.raff.resetAll();
    await refreshState();
    renderNavCounts();
    toast('تم حذف جميع البيانات (مع حفظ نسخة أمان)', 'success');
    navigateTo('dashboard');
    void res;
  });
}
