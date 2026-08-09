'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_CHECK_CONSENT_VERSION = 1;
const MAX_API_BYTES = 2 * 1024 * 1024;
const MAX_CHECKSUM_BYTES = 128 * 1024;

function normalizeVersion(value) {
  const raw = String(value || '').trim().replace(/^v/i, '');
  const match = raw.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return [0, 0, 0, 0];
  return [match[1], match[2], match[3], match[4]].map((part) => Number(part || 0));
}

function compareVersions(a, b) {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function archLabel(arch) {
  if (arch === 'ia32') return 'x86';
  if (arch === 'x64') return 'x64';
  if (arch === 'arm64') return 'ARM64';
  return arch || 'unknown';
}

function isInstallerName(name) {
  const value = String(name || '').toLowerCase();
  return value.endsWith('.exe') && /(setup|installer|windows|win)/.test(value) && !/blockmap/.test(value);
}

function pickInstallerAsset(assets, arch = process.arch) {
  const list = Array.isArray(assets) ? assets.filter((asset) => isInstallerName(asset?.name)) : [];
  if (!list.length) return null;

  const patterns = arch === 'ia32'
    ? [/(^|[-_. ])ia32($|[-_. ])/i, /(^|[-_. ])x86($|[-_. ])/i, /(^|[-_. ])32(?:bit)?($|[-_. ])/i]
    : arch === 'x64'
      ? [/(^|[-_. ])x64($|[-_. ])/i, /(^|[-_. ])amd64($|[-_. ])/i, /(^|[-_. ])64(?:bit)?($|[-_. ])/i]
      : arch === 'arm64'
        ? [/(^|[-_. ])arm64($|[-_. ])/i, /(^|[-_. ])aarch64($|[-_. ])/i]
        : [];

  for (const pattern of patterns) {
    const exact = list.find((asset) => pattern.test(asset.name));
    if (exact) return exact;
  }

  // A single architecture-neutral installer is safe as a fallback. When a
  // release contains multiple installers we deliberately refuse to guess.
  return list.length === 1 ? list[0] : null;
}

function parseDigest(value) {
  const match = String(value || '').trim().match(/^sha256:([a-f0-9]{64})$/i);
  return match ? match[1].toLowerCase() : '';
}

function safeFileName(value) {
  return String(value || 'Raff-Update.exe')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 180) || 'Raff-Update.exe';
}

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    const fd = fs.openSync(tmp, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch (_) {}
  fs.renameSync(tmp, filePath);
}

function readJson(filePath, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) { return fallback; }
}

class RaffUpdateManager {
  constructor({ app, getWindow, owner, repo, intervalMs = DAY_MS }) {
    this.app = app;
    this.getWindow = getWindow;
    this.owner = owner;
    this.repo = repo;
    this.intervalMs = Math.max(DAY_MS, Number(intervalMs) || DAY_MS);
    this.statePath = path.join(app.getPath('userData'), 'raff-update-state.json');
    this.downloadDir = path.join(app.getPath('userData'), 'updates');
    this.state = {
      autoCheckEnabled: false,
      autoCheckEnabledAt: 0,
      autoCheckConsentVersion: 0,
      autoCheckConsentChoice: '',
      autoCheckConsentAt: 0,
      lastAutoCheckAt: 0,
      lastManualCheckAt: 0,
      lastSuccessfulCheckAt: 0,
      lastError: '',
      latest: null,
      downloaded: null,
      postponedVersion: '',
      postponedUntil: 0,
      ...readJson(this.statePath, {}),
    };
    this._timer = null;
    this._checkPromise = null;
    this._downloadPromise = null;
    this._downloadRequest = null;
    this._cancelDownload = false;
    this._runtimeDownload = null;

    // Consent is versioned separately from the updater itself. Existing Raff
    // 3.0.0 profiles and fresh installs have no decision recorded, so they
    // remain strictly offline until the administrator answers the one-time
    // onboarding dialog (or changes the setting manually).
    if (Number(this.state.autoCheckConsentVersion) < AUTO_CHECK_CONSENT_VERSION) {
      this.state.autoCheckEnabled = false;
      this.state.autoCheckEnabledAt = 0;
    }

    fs.mkdirSync(this.downloadDir, { recursive: true });
    this._validatePersistedDownload();
  }

  _save() {
    try { atomicWriteJson(this.statePath, this.state); } catch (_) {}
  }

  _validatePersistedDownload() {
    const item = this.state.downloaded;
    if (item?.version && compareVersions(item.version, this.app.getVersion()) <= 0) {
      try { if (item.filePath) fs.rmSync(item.filePath, { force: true }); } catch (_) {}
      this.state.downloaded = null;
    } else if (!item?.filePath || !fs.existsSync(item.filePath)) {
      this.state.downloaded = null;
    } else {
      try {
        const stat = fs.statSync(item.filePath);
        if (!stat.isFile() || (item.size && stat.size !== item.size)) this.state.downloaded = null;
      } catch (_) { this.state.downloaded = null; }
    }

    // The updater owns this directory. Clear interrupted downloads and old
    // installers so a successful upgrade does not leave tens of megabytes
    // behind in the user's profile.
    const keep = this.state.downloaded?.filePath ? path.resolve(this.state.downloaded.filePath) : '';
    try {
      for (const name of fs.readdirSync(this.downloadDir)) {
        const candidate = path.resolve(this.downloadDir, name);
        if (candidate === keep) continue;
        if (/\.(download|exe)$/i.test(name)) fs.rmSync(candidate, { force: true });
      }
    } catch (_) {}
    this._save();
  }

  _send(type, payload = {}) {
    const win = this.getWindow?.();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('update:event', { type, ...payload });
  }

  _githubHeaders(binary = false) {
    return {
      'User-Agent': `Raff/${this.app.getVersion()} (${process.platform}; ${process.arch})`,
      Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  _requestBuffer(url, { maxBytes = MAX_API_BYTES, binary = false, redirects = 5 } = {}) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, { headers: this._githubHeaders(binary), timeout: 15000 }, (response) => {
        const status = response.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && redirects > 0) {
          response.resume();
          const next = new URL(response.headers.location, url).toString();
          this._requestBuffer(next, { maxBytes, binary, redirects: redirects - 1 }).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(status === 404 ? 'لم يُعثر على إصدار منشور في GitHub Releases' : `تعذر الاتصال بـ GitHub (HTTP ${status})`));
          return;
        }
        const chunks = [];
        let length = 0;
        response.on('data', (chunk) => {
          length += chunk.length;
          if (length > maxBytes) {
            request.destroy(new Error('استجابة GitHub أكبر من الحد المسموح'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks)));
      });
      request.on('timeout', () => request.destroy(new Error('انتهت مهلة الاتصال بـ GitHub')));
      request.on('error', reject);
    });
  }

  async _fetchLatestRelease() {
    const url = `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/releases/latest`;
    const buffer = await this._requestBuffer(url);
    let release;
    try { release = JSON.parse(buffer.toString('utf8')); }
    catch (_) { throw new Error('استجابة GitHub غير صالحة'); }
    if (!release?.tag_name) throw new Error('الإصدار المنشور لا يحتوي رقم إصدار صالحًا');
    return release;
  }

  _latestFromRelease(release) {
    const version = String(release.tag_name || '').replace(/^v/i, '').trim();
    const asset = pickInstallerAsset(release.assets, process.arch);
    return {
      version,
      tag: release.tag_name || version,
      name: release.name || release.tag_name || `Raff ${version}`,
      notes: String(release.body || '').slice(0, 24000),
      publishedAt: release.published_at || release.created_at || '',
      htmlUrl: release.html_url || `https://github.com/${this.owner}/${this.repo}/releases/latest`,
      asset: asset ? {
        id: asset.id,
        name: asset.name,
        size: Number(asset.size) || 0,
        digest: asset.digest || '',
        downloadUrl: asset.browser_download_url || '',
      } : null,
      checksumAssets: (release.assets || [])
        .filter((item) => /sha256|checksums?/i.test(item?.name || ''))
        .slice(0, 8)
        .map((item) => ({ name: item.name, size: Number(item.size) || 0, downloadUrl: item.browser_download_url || '' })),
    };
  }

  getStatus() {
    const latest = this.state.latest;
    const currentVersion = this.app.getVersion();
    const available = !!latest?.version && compareVersions(latest.version, currentVersion) > 0;
    const postponed = available && this.state.postponedVersion === latest.version && Number(this.state.postponedUntil) > Date.now();
    const downloaded = this.state.downloaded && this.state.downloaded.version === latest?.version ? this.state.downloaded : null;
    return {
      ok: true,
      currentVersion,
      arch: process.arch,
      archLabel: archLabel(process.arch),
      repository: `${this.owner}/${this.repo}`,
      checkIntervalHours: Math.round(this.intervalMs / 3600000),
      autoCheckEnabled: this.state.autoCheckEnabled === true && Number(this.state.autoCheckConsentVersion) >= AUTO_CHECK_CONSENT_VERSION,
      autoCheckEnabledAt: Number(this.state.autoCheckEnabledAt) || 0,
      autoCheckConsentVersion: Number(this.state.autoCheckConsentVersion) || 0,
      autoCheckConsentChoice: this.state.autoCheckConsentChoice || '',
      autoCheckConsentAt: Number(this.state.autoCheckConsentAt) || 0,
      needsAutoCheckChoice: Number(this.state.autoCheckConsentVersion) < AUTO_CHECK_CONSENT_VERSION,
      lastAutoCheckAt: Number(this.state.lastAutoCheckAt) || 0,
      lastManualCheckAt: Number(this.state.lastManualCheckAt) || 0,
      lastSuccessfulCheckAt: Number(this.state.lastSuccessfulCheckAt) || 0,
      lastError: this.state.lastError || '',
      available,
      postponed,
      latest: available ? latest : null,
      compatible: !available || !!latest?.asset,
      downloaded,
      downloading: this._runtimeDownload ? { ...this._runtimeDownload } : null,
    };
  }

  async check({ manual = false } = {}) {
    if (this._checkPromise) return this._checkPromise;
    // Offline-first contract: no background network request is allowed unless
    // the administrator explicitly opted in. Manual checks are intentional
    // user actions and therefore remain available while automation is off.
    if (!manual && (this.state.autoCheckEnabled !== true || Number(this.state.autoCheckConsentVersion) < AUTO_CHECK_CONSENT_VERSION)) {
      return { ...this.getStatus(), skipped: true, reason: 'auto-check-disabled' };
    }
    const now = Date.now();
    if (!manual && this.state.lastAutoCheckAt && now - this.state.lastAutoCheckAt < this.intervalMs) {
      return { ...this.getStatus(), skipped: true };
    }

    if (manual) this.state.lastManualCheckAt = now;
    else this.state.lastAutoCheckAt = now;
    this.state.lastError = '';
    this._save();
    this._send('checking', { manual });

    this._checkPromise = (async () => {
      try {
        const release = await this._fetchLatestRelease();
        const latest = this._latestFromRelease(release);
        const previousVersion = this.state.latest?.version || '';
        if (compareVersions(latest.version, this.app.getVersion()) > 0) {
          this.state.latest = latest;
          if (previousVersion && previousVersion !== latest.version) {
            this.state.downloaded = null;
            this.state.postponedVersion = '';
            this.state.postponedUntil = 0;
          }
        } else {
          this.state.latest = null;
          this.state.downloaded = null;
          this.state.postponedVersion = '';
          this.state.postponedUntil = 0;
        }
        this.state.lastSuccessfulCheckAt = Date.now();
        this.state.lastError = '';
        this._save();
        const status = this.getStatus();
        this._send(status.available ? 'available' : 'up-to-date', { status, manual });
        return status;
      } catch (error) {
        this.state.lastError = error?.message || 'تعذر البحث عن تحديثات';
        this._save();
        const result = { ...this.getStatus(), ok: false, error: this.state.lastError };
        this._send('check-error', { error: this.state.lastError, manual, status: result });
        return result;
      } finally {
        this._checkPromise = null;
        if (!manual) this._scheduleNext();
      }
    })();
    return this._checkPromise;
  }


  setAutoCheckEnabled(enabled) {
    const next = enabled === true;
    const changed = this.state.autoCheckEnabled !== next;
    this.state.autoCheckEnabled = next;
    this.state.autoCheckConsentVersion = AUTO_CHECK_CONSENT_VERSION;
    this.state.autoCheckConsentChoice = next ? 'enabled' : 'disabled';
    this.state.autoCheckConsentAt = Date.now();
    if (changed && next) {
      this.state.autoCheckEnabledAt = Date.now();
      // Treat opt-in as the start of the 24-hour cadence. This preserves the
      // promise that enabling automation itself does not make a surprise
      // network request; the administrator can still press “Check now”.
      this.state.lastAutoCheckAt = Date.now();
    }
    if (!next) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._save();
    if (next) this._scheduleNext();
    const status = this.getStatus();
    this._send('auto-check-setting-changed', { status });
    return status;
  }

  postpone(hours = 24) {
    const latest = this.state.latest;
    if (!latest?.version) return { ok: true, ...this.getStatus() };
    const safeHours = Math.max(1, Math.min(168, Number(hours) || 24));
    this.state.postponedVersion = latest.version;
    this.state.postponedUntil = Date.now() + safeHours * 3600000;
    this._save();
    return this.getStatus();
  }

  async _expectedDigest(latest) {
    const direct = parseDigest(latest?.asset?.digest);
    if (direct) return { digest: direct, source: 'github-asset-digest' };

    const candidates = Array.isArray(latest?.checksumAssets) ? latest.checksumAssets : [];
    const targetName = latest?.asset?.name || '';
    for (const item of candidates) {
      if (!item.downloadUrl || item.size > MAX_CHECKSUM_BYTES) continue;
      try {
        const content = (await this._requestBuffer(item.downloadUrl, { maxBytes: MAX_CHECKSUM_BYTES, binary: true })).toString('utf8');
        const lines = content.split(/\r?\n/);
        const named = lines.find((line) => targetName && line.includes(targetName));
        const match = (named || content).match(/\b([a-f0-9]{64})\b/i);
        if (match) return { digest: match[1].toLowerCase(), source: item.name };
      } catch (_) {}
    }
    return { digest: '', source: '' };
  }

  _downloadFile(url, partPath, totalBytes, hash) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      let received = 0;
      let lastEmit = 0;
      const file = fs.createWriteStream(partPath, { flags: 'w' });

      const fail = (error) => {
        try { file.destroy(); } catch (_) {}
        reject(error);
      };

      const requestUrl = (target, redirects = 6) => {
        if (this._cancelDownload) return fail(new Error('تم إلغاء تنزيل التحديث'));
        const request = https.get(target, { headers: this._githubHeaders(true), timeout: 30000 }, (response) => {
          const status = response.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && redirects > 0) {
            response.resume();
            requestUrl(new URL(response.headers.location, target).toString(), redirects - 1);
            return;
          }
          if (status < 200 || status >= 300) {
            response.resume();
            fail(new Error(`تعذر تنزيل ملف التحديث (HTTP ${status})`));
            return;
          }
          response.on('data', (chunk) => {
            if (this._cancelDownload) {
              request.destroy(new Error('تم إلغاء تنزيل التحديث'));
              return;
            }
            received += chunk.length;
            hash.update(chunk);
            file.write(chunk);
            const now = Date.now();
            if (now - lastEmit >= 140) {
              lastEmit = now;
              const elapsedSeconds = Math.max(0.25, (now - started) / 1000);
              const speed = Math.round(received / elapsedSeconds);
              const percent = totalBytes > 0 ? Math.min(100, (received / totalBytes) * 100) : 0;
              this._runtimeDownload = { received, total: totalBytes, speed, percent, version: this.state.latest?.version || '' };
              this._send('download-progress', { progress: { ...this._runtimeDownload } });
            }
          });
          response.on('end', () => {
            file.end(() => resolve({ received, durationMs: Date.now() - started }));
          });
          response.on('error', fail);
        });
        this._downloadRequest = request;
        request.on('timeout', () => request.destroy(new Error('انتهت مهلة تنزيل التحديث')));
        request.on('error', fail);
      };

      file.on('error', fail);
      requestUrl(url);
    });
  }

  async download() {
    if (this._downloadPromise) return this._downloadPromise;
    const status = this.getStatus();
    if (!status.available) return { ok: false, error: 'لا يوجد تحديث أحدث متاح حاليًا' };
    if (!status.compatible || !status.latest?.asset?.downloadUrl) {
      return { ok: false, error: `لا يوجد مثبت متوافق مع معمارية ${status.archLabel} في هذا الإصدار` };
    }
    if (status.downloaded?.filePath && fs.existsSync(status.downloaded.filePath)) {
      return { ok: true, reused: true, downloaded: status.downloaded, status: this.getStatus() };
    }

    this._cancelDownload = false;
    const latest = status.latest;
    const asset = latest.asset;
    const fileName = safeFileName(asset.name);
    const finalPath = path.join(this.downloadDir, fileName);
    const partPath = `${finalPath}.download`;
    try { fs.rmSync(partPath, { force: true }); } catch (_) {}
    this._runtimeDownload = { received: 0, total: asset.size || 0, speed: 0, percent: 0, version: latest.version };
    this._send('download-started', { status: this.getStatus() });

    this._downloadPromise = (async () => {
      try {
        const expected = await this._expectedDigest(latest);
        const hash = crypto.createHash('sha256');
        const result = await this._downloadFile(asset.downloadUrl, partPath, asset.size || 0, hash);
        if (this._cancelDownload) throw new Error('تم إلغاء تنزيل التحديث');
        if (asset.size && result.received !== asset.size) throw new Error('حجم ملف التحديث غير مطابق للملف المنشور');
        const actualDigest = hash.digest('hex').toLowerCase();
        if (expected.digest && actualDigest !== expected.digest) {
          throw new Error('فشل التحقق من SHA-256؛ تم حذف ملف التحديث لحمايتك');
        }
        fs.renameSync(partPath, finalPath);
        this.state.downloaded = {
          version: latest.version,
          filePath: finalPath,
          fileName,
          size: result.received,
          sha256: actualDigest,
          verified: !!expected.digest,
          verificationSource: expected.source || 'computed-only',
          downloadedAt: Date.now(),
        };
        this._save();
        this._runtimeDownload = null;
        const ready = { ok: true, downloaded: this.state.downloaded, status: this.getStatus() };
        this._send('downloaded', ready);
        return ready;
      } catch (error) {
        try { fs.rmSync(partPath, { force: true }); } catch (_) {}
        this._runtimeDownload = null;
        const cancelled = this._cancelDownload || /إلغاء/.test(error?.message || '');
        const result = { ok: false, cancelled, error: error?.message || 'تعذر تنزيل التحديث', status: this.getStatus() };
        this._send(cancelled ? 'download-cancelled' : 'download-error', result);
        return result;
      } finally {
        this._downloadRequest = null;
        this._downloadPromise = null;
        this._cancelDownload = false;
      }
    })();
    return this._downloadPromise;
  }

  cancelDownload() {
    if (!this._downloadPromise) return { ok: true, active: false };
    this._cancelDownload = true;
    try { this._downloadRequest?.destroy(new Error('تم إلغاء تنزيل التحديث')); } catch (_) {}
    return { ok: true, active: true };
  }

  install() {
    const downloaded = this.state.downloaded;
    const latest = this.state.latest;
    if (process.platform !== 'win32') return { ok: false, error: 'التثبيت التلقائي متاح لنسخة Windows فقط' };
    if (!downloaded?.filePath || downloaded.version !== latest?.version || !fs.existsSync(downloaded.filePath)) {
      return { ok: false, error: 'ملف التحديث غير جاهز للتثبيت' };
    }
    try {
      const child = spawn(downloaded.filePath, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();
      setTimeout(() => this.app.quit(), 500);
      return { ok: true, launching: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'تعذر تشغيل مثبت التحديث' };
    }
  }

  _scheduleNext() {
    clearTimeout(this._timer);
    this._timer = null;
    if (this.state.autoCheckEnabled !== true || Number(this.state.autoCheckConsentVersion) < AUTO_CHECK_CONSENT_VERSION) return;
    const last = Number(this.state.lastAutoCheckAt) || 0;
    const remaining = last ? Math.max(0, this.intervalMs - (Date.now() - last)) : 0;
    const delay = remaining > 0 ? remaining : 8000;
    this._timer = setTimeout(() => {
      void this.check({ manual: false });
    }, Math.min(delay, 0x7fffffff));
    this._timer.unref?.();
  }

  start() {
    // Offline-first: automatic network access is opt-in and disabled by
    // default. When disabled, start() deliberately creates no network timer.
    if (this.state.autoCheckEnabled !== true || Number(this.state.autoCheckConsentVersion) < AUTO_CHECK_CONSENT_VERSION) return;
    // Development sessions should never surprise the developer by launching a
    // production installer. Set RAFF_ENABLE_DEV_UPDATES=1 only when explicitly
    // testing the automatic scheduler. Manual checks remain available.
    if (!this.app.isPackaged && process.env.RAFF_ENABLE_DEV_UPDATES !== '1') return;
    this._scheduleNext();
  }

  stop() {
    clearTimeout(this._timer);
    this._timer = null;
    this.cancelDownload();
  }
}

module.exports = {
  RaffUpdateManager,
  compareVersions,
  pickInstallerAsset,
  parseDigest,
  archLabel,
  AUTO_CHECK_CONSENT_VERSION,
};
