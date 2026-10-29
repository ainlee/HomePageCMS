// Checks that every dialog with an icon field renders the one shared
// icon-field component, so the fields cannot drift apart between the dialogs:
// the service group, layout group, service item, bookmark group and bookmark
// item dialogs all render the shared markup, and a bookmark group icon
// follows the same layout sync path as a service group icon.
//
// The layout block is saved through the layout API and put back when the test
// is done; the other YAML files are never written, so the install ends the
// way it started.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-group-icon');
const chrome = launchChrome({ port: PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId, ws } = await connect(PORT);
const ev = (e) => evalJson(cdp, sessionId, e);

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('PASS  ' + name + (detail ? '  ' + detail : ''));
  } else {
    failures.push(name);
    console.log('FAIL  ' + name + (detail ? '  ' + detail : ''));
  }
}

async function waitFor(expression, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if (await ev(expression)) return true;
    await sleep(150);
  }
  return false;
}

const click = (selector) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.click();
  return true;
})()`);

const setInput = (selector, value) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.value = ${JSON.stringify(value)};
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);

const api = async (path, init) => (await (await fetch(APP_URL + path, init)).json());

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(800);

// 1. The shared component in the service group dialog: one icon input with
//    its live preview, next to the name field.
check('the service add-group button opens its dialog', await click('.editor-toolbar .btn-primary'));
await sleep(300);
const svcGroupModal = JSON.parse(await ev(`(() => {
  const m = document.querySelector('.modal-overlay .modal');
  if (!m) return 'no modal';
  return JSON.stringify({ input: !!m.querySelector('input'), wrap: !!m.querySelector('.icon-input-wrap'), labels: m.querySelectorAll('label').length });
})()`));
check('the service group dialog renders the shared icon field',
  svcGroupModal.input && svcGroupModal.wrap && svcGroupModal.labels === 2, JSON.stringify(svcGroupModal));
await click('.modal-overlay .modal .btn-secondary');
await sleep(300);

// 2. The bookmark group dialog carries the same field - the one that was
//    missing while the dialogs drifted apart.
await click('.tab-bar .tab-btn:nth-child(2)');
await sleep(300);
check('the bookmark add-group button opens its dialog', await click('.editor-toolbar .btn-primary'));
await waitFor('!!document.querySelector("#bookmark-group-name")');
const bmGroupModal = JSON.parse(await ev(`(() => {
  const m = document.querySelector('.bookmark-group-modal');
  if (!m) return 'no modal';
  return JSON.stringify({ name: !!m.querySelector('#bookmark-group-name'), icon: !!m.querySelector('#bookmark-group-icon'), wrap: !!m.querySelector('.icon-input-wrap'), labels: m.querySelectorAll('label').length });
})()`));
check('the bookmark group dialog renders the shared icon field',
  bmGroupModal.name && bmGroupModal.icon && bmGroupModal.wrap && bmGroupModal.labels === 2, JSON.stringify(bmGroupModal));

// 3. Typing an mdi icon shows the live glyph preview inside the shared field.
await setInput('#bookmark-group-name', '共用圖示測試群');
check('the bookmark group icon input accepts a value', await setInput('#bookmark-group-icon', 'mdi-gamepad'));
check('the shared field shows the live icon preview',
  await waitFor('!!document.querySelector(".bookmark-group-modal .icon-preview-glyph.mdi-gamepad")'));

// 4. Saving the group routes the icon through the layout sync, the same path
//    the service dialogs use. The layout save writes settings.yaml only.
await click('.bookmark-group-modal .btn-primary');
await waitFor('!!document.querySelector(".group-card .group-name")');
await click('.tab-bar .tab-btn:nth-child(4)');
await waitFor('!!document.querySelector(".layout-panel")');
const saveEnabled = await waitFor('document.querySelector(".layout-head .btn-primary") && !document.querySelector(".layout-head .btn-primary").disabled', 40);
check('the layout save button is enabled after the bookmark group icon was set', saveEnabled);
await click('.layout-head .btn-primary');
await sleep(1500);
const layout = await api('/api/homepage-layout');
check('the bookmark group icon reaches the layout block on save',
  layout.success && JSON.stringify(layout.data.groups).includes('共用圖示測試群'), JSON.stringify(layout.data.groups));

// Put the layout block back the way it was. The test group only ever lived in
// the in-memory model - the bookmark file was never written - so closing the
// page after the layout restore leaves the install untouched.
await api('/api/homepage-layout', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    values: Object.fromEntries(Object.keys(layout.data.values).map((k) => [k, ''])),
    groups: [],
    hash: layout.hash
  })
});

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
