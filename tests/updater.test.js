'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { RaffUpdateManager, compareVersions, pickInstallerAsset, parseDigest, archLabel, AUTO_CHECK_CONSENT_VERSION } = require('../src/main/update-manager');

function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

console.log('\nRaff updater contract tests');

test('semantic version comparison handles v-prefix and patch releases', () => {
  assert.strictEqual(compareVersions('v3.1.0', '3.0.0'), 1);
  assert.strictEqual(compareVersions('3.0.0', 'v3.0.0'), 0);
  assert.strictEqual(compareVersions('3.0.9', '3.1.0'), -1);
});

test('x64 build selects only the x64 Windows installer', () => {
  const assets = [
    { name: 'Raff-3.1.0-Windows-x64-Setup.exe' },
    { name: 'Raff-3.1.0-Windows-ia32-Setup.exe' },
  ];
  assert.strictEqual(pickInstallerAsset(assets, 'x64').name, assets[0].name);
});

test('32-bit build accepts ia32/x86 naming and never chooses x64', () => {
  const assets = [
    { name: 'Raff-3.1.0-Windows-x64-Setup.exe' },
    { name: 'Raff-3.1.0-Windows-ia32-Setup.exe' },
  ];
  assert.strictEqual(pickInstallerAsset(assets, 'ia32').name, assets[1].name);
  assert.strictEqual(archLabel('ia32'), 'x86');
});

test('ambiguous multi-installer release is not guessed', () => {
  const assets = [
    { name: 'Raff-3.1.0-Windows-A-Setup.exe' },
    { name: 'Raff-3.1.0-Windows-B-Setup.exe' },
  ];
  assert.strictEqual(pickInstallerAsset(assets, 'x64'), null);
});

test('GitHub sha256 digest is parsed strictly', () => {
  const digest = 'a'.repeat(64);
  assert.strictEqual(parseDigest(`sha256:${digest}`), digest);
  assert.strictEqual(parseDigest(`md5:${digest}`), '');
  assert.strictEqual(parseDigest('sha256:abc'), '');
});

test('renderer exposes manual check, progress events and install actions', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  for (const token of ['updateGetStatus', 'updateCheck', 'updateSetAutoCheckEnabled', 'updateDownload', 'updateCancelDownload', 'updatePostpone', 'updateInstall', 'onUpdateEvent']) {
    assert.ok(preload.includes(token), `missing ${token}`);
  }
});

test('automatic updater interval is exactly 24 hours', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(main.includes('intervalMs: 24 * 60 * 60 * 1000'));
});

test('automatic GitHub checks are opt-in and disabled by default', () => {
  const temp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'raff-updater-'));
  const app = {
    getPath: () => temp,
    getVersion: () => '3.0.0',
    isPackaged: true,
    quit: () => {},
  };
  const manager = new RaffUpdateManager({ app, getWindow: () => null, owner: 'Hzifa33', repo: 'raff' });
  assert.strictEqual(manager.getStatus().autoCheckEnabled, false);
  assert.strictEqual(manager.getStatus().needsAutoCheckChoice, true);
  manager.setAutoCheckEnabled(true);
  assert.strictEqual(manager.getStatus().autoCheckEnabled, true);
  assert.strictEqual(manager.getStatus().needsAutoCheckChoice, false);
  assert.strictEqual(manager.getStatus().autoCheckConsentVersion, AUTO_CHECK_CONSENT_VERSION);
  assert.strictEqual(manager.getStatus().autoCheckConsentChoice, 'enabled');
  manager.setAutoCheckEnabled(false);
  assert.strictEqual(manager.getStatus().autoCheckEnabled, false);
  assert.strictEqual(manager.getStatus().autoCheckConsentChoice, 'disabled');
  manager.stop();
  fs.rmSync(temp, { recursive: true, force: true });
});

test('settings contains the in-app manual update card', () => {
  const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'settings-view.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'update-ui.js'), 'utf8');
  assert.ok(settings.includes('raffUpdateSettingsCardHtml'));
  assert.ok(ui.includes('checkUpdatesBtn'));
  assert.ok(ui.includes('autoUpdateCheckToggle'));
  assert.ok(ui.includes('التحديثات التلقائية معطّلة'));
  assert.ok(ui.includes('updateProgressBar'));
});


test('legacy 3.0.0 updater state is migrated back to offline until one-time consent', () => {
  const os = require('os');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'raff-updater-consent-'));
  fs.writeFileSync(path.join(temp, 'raff-update-state.json'), JSON.stringify({ autoCheckEnabled: true, lastAutoCheckAt: Date.now() - 99999999 }), 'utf8');
  const app = { getPath: () => temp, getVersion: () => '3.0.0', isPackaged: true, quit: () => {} };
  const manager = new RaffUpdateManager({ app, getWindow: () => null, owner: 'Hzifa33', repo: 'raff' });
  const status = manager.getStatus();
  assert.strictEqual(status.autoCheckEnabled, false);
  assert.strictEqual(status.needsAutoCheckChoice, true);
  manager.stop();
  fs.rmSync(temp, { recursive: true, force: true });
});

test('renderer contains the one-time recommended updater consent dialog', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'update-ui.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', 'v3.css'), 'utf8');
  for (const token of ['showRaffUpdateConsentDialog', 'needsAutoCheckChoice', 'updateConsentAccept', 'updateConsentDecline', 'موصى به', 'لا تُرسل بيانات المكتبة']) {
    assert.ok(ui.includes(token), `missing consent UI token: ${token}`);
  }
  assert.ok(css.includes('.modal.modal-update-consent'));
  assert.ok(css.includes('.update-consent-recommended-badge'));
});

console.log('✓ updater tests passed');
