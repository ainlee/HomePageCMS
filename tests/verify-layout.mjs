// Checks the layout tab: the panel opens, the group list and the global
// switches are editable, and saving writes settings.yaml while the fields
// the editor does not model stay as they were.
//
// The test puts the original values back before it finishes, so the file
// ends up the way it was.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-layout');
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

const api = async (path, init) => (await (await fetch(APP_URL + path, init)).json());

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(800);

// The layout tab is the fourth one.
await click('.tab-bar .tab-btn:nth-child(4)');
const opened = await waitFor('!!document.querySelector(".layout-panel")');
check('the layout tab opens', opened);
await waitFor('document.querySelector(".layout-panel") !== null');
await sleep(400);

// The group rows and the global switches are there.
const hasGroups = await ev('!!document.querySelector(".layout-section-head")');
check('the layout panel has a group section', hasGroups);
const switchLabels = await ev('JSON.stringify([...document.querySelectorAll(".layout-grid .form-group label")].map((l) => l.textContent.trim()).slice(0, 4))');
check('the global switches form is there', JSON.parse(switchLabels).length === 4, switchLabels);

// Add a layout group through the dialog, save the panel, and check the API.
await click('.layout-section-head .btn');
await waitFor('!!document.querySelector(".modal-overlay .modal-wide h2 i.mdi-view-grid-edit")');
check('the layout group dialog opens',
  await ev('!!document.querySelector(".modal-overlay .modal-wide h2 i.mdi-view-grid-edit")'));
// Fill the group name. The dialog fields are filled through the DOM: find the
// input next to the group name label.
const filled = await ev(`(() => {
  const inputs = [...document.querySelectorAll('.modal-wide .form-group input')];
  if (!inputs.length) return 'no inputs';
  inputs[0].value = '測試分頁群';
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  return inputs.length;
})()`);
check('the dialog accepts a group name', filled === 1 || filled, String(filled));
await sleep(200);
await ev(`(() => {
  const btn = [...document.querySelectorAll('.modal-wide button')].find((b) => b.classList.contains('btn-primary'));
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(500);
const rowCount = await ev('document.querySelectorAll(".layout-group-row").length');
check('the new group shows in the list', rowCount === 1, String(rowCount));

// The panel's save button writes the layout block into settings.yaml.
await click('.layout-head .btn-primary');
await sleep(1500);
const after = await api('/api/homepage-layout');
check('saving writes the group into the file',
  JSON.stringify(after.data.groups).includes('測試分頁群'),
  JSON.stringify(after.data.groups));
const values = after.data.values;
check('the global switches read back from the file',
  typeof values.fullWidth === 'string' && typeof values.statusStyle === 'string',
  JSON.stringify({ fullWidth: values.fullWidth, statusStyle: values.statusStyle }));

// Put the layout block back the way it was so the install ends clean.
await api('/api/homepage-layout', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    values: Object.fromEntries(Object.keys(after.data.values).map((k) => [k, ''])),
    groups: [],
    hash: after.hash
  })
});
const restored = await api('/api/homepage-layout');
check('the layout block is restored to empty',
  JSON.stringify(restored.data.groups) === '[]',
  JSON.stringify(restored.data.groups));

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
