// Checks the Homepage appearance tab: the palette is there, a colour can be picked,
// and saving writes it into settings.yaml while the fields the editor does not model
// stay as they were.
//
// The test puts the original colour back before it finishes, so the file ends up
// the way it was.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-appearance');
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

// The settings of the running editor, read from the same API the page uses.
const api = async () => (await (await fetch(APP_URL + '/api/homepage-settings')).json());
const before = await api();
const originalColour = before.data.values.color || '';
const originalValues = before.data.values;

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(800);

// The appearance tab is the third one.
await click('.tab-bar .tab-btn:nth-child(3)');
const opened = await waitFor(`!!document.querySelector('.appearance-panel')`);
check('the appearance tab opens', opened);
await sleep(600);

const swatches = await ev(`document.querySelectorAll('.palette-swatch').length`);
check('every colour of the palette is offered', swatches === 23, String(swatches));

const fields = await ev(`JSON.stringify([...document.querySelectorAll('.appearance-panel select')].map((s) =>
  s.closest('.form-group').querySelector('label').textContent.trim()))`);
const labels = JSON.parse(fields);
check('the appearance fields are there', labels.length === 7, fields);

// The form shows what the file holds.
const shown = await ev(`JSON.stringify({
  theme: (() => { const s = document.querySelectorAll('.appearance-panel select')[0]; return s ? s.value : null; })(),
  colour: (() => { const b = document.querySelector('.palette-swatch.active'); return b ? b.getAttribute('title') : ''; })()
})`);
const form = JSON.parse(shown);
check('the form shows the colour of the file', (form.colour || '') === originalColour,
  'file=' + originalColour + ' form=' + form.colour);
check('the form shows the theme of the file', (form.theme || '') === (originalValues.theme || ''),
  'file=' + originalValues.theme + ' form=' + form.theme);

// Pick another colour and save it.
const other = originalColour === 'rose' ? 'blue' : 'rose';
await click(`.palette-swatch[title="${other}"]`);
await sleep(300);
const dirty = await ev(`document.querySelector('.editor-toolbar .stats').textContent.includes('尚未儲存')`);
check('picking a colour marks the form as unsaved', dirty);

const saveButton = await ev(`(() => {
  const btn = document.querySelector('.appearance-head .btn-primary');
  if (!btn) return 'no button';
  return btn.disabled ? 'disabled' : 'enabled';
})()`);
check('the panel has a save button that is ready', saveButton === 'enabled', String(saveButton));

await click('.appearance-head .btn-primary');
await sleep(2000);
const afterSave = await api();
check('the colour is written to settings.yaml', afterSave.data.values.color === other,
  'file=' + afterSave.data.values.color);

// The fields the editor does not model have to stay untouched.
const fileText = await api();
check('the other fields of the file are kept',
  fileText.data.values.theme === (originalValues.theme || '')
  && fileText.data.values.font === (originalValues.font || '')
  && fileText.data.values.backgroundImage === (originalValues.backgroundImage || ''),
  JSON.stringify(fileText.data.values));

// Put the original values back through the same API, so the file ends up the way
// it was even when the browser part of the test failed half way.
await fetch(APP_URL + '/api/homepage-settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ values: originalValues, hash: fileText.hash })
});
const restored = await api();
check('the original colour is back in the file', restored.data.values.color === originalColour,
  'file=' + restored.data.values.color);

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
