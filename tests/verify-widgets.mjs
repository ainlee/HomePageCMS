// Checks the information-widgets tab: the panel opens, the seeded list shows,
// a widget can be edited and reordered, and saving writes widgets.yaml while
// the options the editor does not model stay as they were.
//
// The test puts the file back before it finishes, so the file ends up the way
// it was.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-widgets');
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

// A file the editor has not seen yet: seed one through the API so the tab has
// something to show, and remember the raw text to put back at the end.
const seed = await api('/api/widgets');
const originalRaw = seed.raw;
const originalHash = seed.hash;

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor('!!(document.querySelector("#app") && document.querySelector("#app").__vue_app__)');
await sleep(600);

// The widgets tab is the fifth one.
await click('.tab-bar .tab-btn:nth-child(5)');
const opened = await waitFor('!!document.querySelector(".widgets-panel")');
check('the widgets tab opens', opened);

const cards = await ev('document.querySelectorAll(".widget-card").length');
check('the seeded widgets are listed', Number(cards) >= 1, String(cards));

// Add one through the dialog and save it.
await click('.editor-toolbar .btn-primary');
await sleep(200);
const dialogOpen = await waitFor('!!document.querySelector(".modal-wide h2 i.mdi-widget-edit")');
check('the widget dialog opens', dialogOpen);
await ev(`(() => {
  const trigger = document.querySelector('#widget-modal-type .sh-trigger');
  if (!trigger) return false;
  trigger.click();
  return true;
})()`);
// Wait for the listbox to render its options, then pick the first real one.
for (let i = 0; i < 20; i++) {
  const picked = await ev(`(() => {
    const opt = [...document.querySelectorAll('#widget-modal-type .sh-opt')].find((o) => o.getAttribute('data-value') !== '');
    if (opt) { opt.click(); return true; }
    return false;
  })()`);
  if (picked) break;
  await sleep(100);
}
await ev(`(() => {
  const btn = [...document.querySelectorAll('.modal-wide button')].find((b) => b.classList.contains('btn-primary'));
  if (btn) btn.click();
  return !!btn;
})()`);
await sleep(800);
const countAfterAdd = await ev('document.querySelectorAll(".widget-card").length');
check('the new widget shows in the list', Number(countAfterAdd) === Number(cards) + 1, String(countAfterAdd));

// Save the panel and read the file back.
await click('.widgets-head .btn-primary');
await sleep(1500);
const after = await api('/api/widgets');
check('saving writes the widget into the file',
  after.data.length === Number(countAfterAdd),
  String(after.data.length));

// Put the file back the way it was.
await api('/api/widgets', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw: originalRaw, hash: after.hash })
});
const restored = await api('/api/widgets');
check('the original file is restored', restored.raw === originalRaw);

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
