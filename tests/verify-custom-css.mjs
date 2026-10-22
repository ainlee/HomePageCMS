// Checks the custom CSS section: every palette has its own customisation, the
// two rows of shades show which one is really in effect, the font is written as
// an import at the top of the file, and the buttons put things back.
//
// The test runs against a settings directory of its own, so the installation
// that is running is never touched. The directory is removed when it is done.
import { connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

const configDir = mkdtempSync(join(tmpdir(), 'hcms-css-'));
mkdirSync(join(configDir, 'backups'), { recursive: true });
writeFileSync(join(configDir, 'settings.yaml'), '---\n# test\n\nallowedHosts:\n  - localhost\n', 'utf8');
writeFileSync(join(configDir, 'services.yaml'), '- Test:\n    - Example:\n        href: https://example.com\n', 'utf8');
writeFileSync(join(configDir, 'bookmarks.yaml'), '- Group:\n    - Item:\n        - abbr: I\n          href: https://example.com\n', 'utf8');

const PORT = await freePort();
const editor = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: Object.assign({}, process.env, {
    PORT: String(PORT),
    HOST: '127.0.0.1',
    HOMEPAGE_CONFIG_PATH: configDir,
    HOMEPAGE_BACKUP_PATH: join(configDir, 'backups')
  }),
  stdio: 'ignore'
});
const APP_URL = 'http://127.0.0.1:' + PORT;

const CHROME_PORT = await freePort();
const PROFILE = createProfile('hp-verify-css');
const chrome = launchChrome({ port: CHROME_PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId, ws } = await connect(CHROME_PORT);
const ev = (e) => evalJson(cdp, sessionId, e);

// The confirm() of the reset button.
let confirmSeen = false;
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.method === 'Page.javascriptDialogOpening') {
    confirmSeen = true;
    cdp.send('Page.handleJavaScriptDialog', { accept: true }, sessionId);
  }
});

function stop() {
  try { editor.kill(); } catch {}
  try { rmSync(configDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', stop);

let up = false;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(APP_URL + '/api/auth');
    if (res.ok) { up = true; break; }
  } catch {}
  await sleep(250);
}
if (!up) {
  console.log('FAIL  the editor started');
  stop();
  process.exit(1);
}

const api = async () => (await (await fetch(APP_URL + '/api/homepage-custom-css')).json());

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(800);
await ev(`(() => { [...document.querySelectorAll('.tab-btn')].find(b => b.textContent.includes('外觀')).click(); return true; })()`);
const opened = await waitFor(`!!document.querySelector('.appearance-panel')`);
check('the appearance tab opens', opened);
await sleep(800);

// The two rows of shades.
const rows = await ev(`(() => {
  const list = [...document.querySelectorAll('.ramp-row')];
  return JSON.stringify(list.map((r) => ({
    chips: r.querySelectorAll('.ramp-chip').length,
    effective: [...r.querySelectorAll('.ramp-chip')].filter((c) => c.classList.contains('effective')).length
  })));
})()`);
const rowInfo = JSON.parse(rows);
check('the shades are in two rows of ten', rowInfo.length === 2 && rowInfo.every((r) => r.chips === 10), rows);
check('without a hand edit the computed row is the one in effect',
  rowInfo[0].effective === 10 && rowInfo[1].effective === 0, rows);

// Pick a palette and change its seed.
await ev(`(() => { document.querySelector('.palette-swatch[title="blue"]').click(); return true; })()`);
await sleep(400);
const picked = await ev(`(() => {
  const text = document.querySelector('.css-editor').value;
  const match = text.match(/html\\.theme-([a-z]+)/);
  return JSON.stringify({ theme: match ? match[1] : '' });
})()`);
check('the text area shows the palette that was picked', JSON.parse(picked).theme === 'blue', picked);

await ev(`(() => {
  const input = document.querySelector('.seed-input');
  input.value = '#e11d48';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(400);
const afterSeed = await ev(`(() => {
  const text = document.querySelector('.css-editor').value;
  const match = text.match(/--color-500:\\s*(\\d+ \\d+ \\d+)/);
  const rows = [...document.querySelectorAll('.ramp-row')].map((r) =>
    [...r.querySelectorAll('.ramp-chip')].filter((c) => c.classList.contains('effective')).length);
  return JSON.stringify({ seed: match ? match[1] : '', effective: rows });
})()`);
check('the new seed is in the text', JSON.parse(afterSeed).seed === '225 29 72', afterSeed);
check('the computed row is still the one in effect', JSON.parse(afterSeed).effective[0] === 10, afterSeed);

// Hand edit one shade: that chip becomes the one in effect.
await ev(`(() => {
  const el = document.querySelector('.css-editor');
  el.value = el.value.replace('--color-300: 245 179 194;', '--color-300: 1 2 3;');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(400);
const afterEdit = await ev(`(() => {
  const rows = [...document.querySelectorAll('.ramp-row')];
  const auto = [...rows[0].querySelectorAll('.ramp-chip')];
  const manual = [...rows[1].querySelectorAll('.ramp-chip')];
  return JSON.stringify({
    autoEffective: auto.filter((c) => c.classList.contains('effective')).length,
    manualEffective: manual.filter((c) => c.classList.contains('effective')).length,
    manualEffectiveIndex: manual.findIndex((c) => c.classList.contains('effective')),
    manualChipColor: manual[3] ? getComputedStyle(manual[3]).backgroundColor : ''
  });
})()`);
const editInfo = JSON.parse(afterEdit);
check('a hand edited shade is the one in effect',
  editInfo.manualEffective === 1 && editInfo.manualEffectiveIndex === 3, afterEdit);
check('the hand edited shade shows the new colour', editInfo.manualChipColor === 'rgb(1, 2, 3)', afterEdit);

// Another palette keeps its own state.
await ev(`(() => { document.querySelector('.palette-swatch[title="cyan"]').click(); return true; })()`);
await sleep(400);
const other = await ev(`(() => {
  const text = document.querySelector('.css-editor').value;
  const match = text.match(/html\\.theme-([a-z]+)/);
  return JSON.stringify({ theme: match ? match[1] : '', hasEdit: text.includes('1 2 3') });
})()`);
check('another palette shows its own block',
  JSON.parse(other).theme === 'cyan' && !JSON.parse(other).hasEdit, other);

// The font: a name and an address.
await ev(`(() => {
  const inputs = document.querySelectorAll('.font-fields input');
  inputs[0].value = 'Noto Sans TC';
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  inputs[1].value = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC&display=swap';
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await sleep(400);

// Save.
await ev(`(() => { document.querySelector('.appearance-head .btn-primary').click(); return true; })()`);
await sleep(2500);
const saved = await api();
const content = saved.data.content || '';
check('the file holds the font block first',
  content.indexOf('@import') !== -1 && content.indexOf('@import') < content.indexOf('html.theme-'), content.slice(0, 160));
check('the font block carries the name', content.includes('Noto Sans TC'), '');
check('the file holds the customised palette', content.includes('html.theme-blue') && content.includes('1 2 3'), '');
check('the palette that was not touched has no block', !content.includes('html.theme-cyan'), '');

// The palette that was customised comes back after a reload.
await ev(`(() => { document.querySelector('.appearance-head .btn-icon').click(); return true; })()`);
await sleep(1500);
await ev(`(() => { document.querySelector('.palette-swatch[title="blue"]').click(); return true; })()`);
await sleep(600);
const reloaded = await ev(`(() => {
  const text = document.querySelector('.css-editor').value;
  return JSON.stringify({
    hasEdit: text.includes('1 2 3'),
    font: document.querySelectorAll('.font-fields input')[0].value
  });
})()`);
check('the hand edit is still there after a reload', JSON.parse(reloaded).hasEdit, reloaded);
check('the font is still there after a reload', JSON.parse(reloaded).font === 'Noto Sans TC', reloaded);

// The reset button of one palette takes it back to the official colour.
await ev(`(() => {
  const buttons = [...document.querySelectorAll('.appearance-actions .btn')];
  const reset = buttons.find((b) => b.textContent.includes('重置'));
  reset.click();
  return true;
})()`);
await sleep(400);
const afterReset = await ev(`(() => ({
  text: document.querySelector('.css-editor').value
}))()`);
check('the reset button takes the palette back', !afterReset.text.includes('1 2 3'), afterReset.text.slice(0, 80));

// The reset of everything asks first.
confirmSeen = false;
await ev(`(() => {
  const button = [...document.querySelectorAll('.appearance-head .btn')].find((b) => b.textContent.includes('全部重置'));
  button.click();
  return true;
})()`);
await sleep(2500);
check('the reset of everything asks first', confirmSeen, '');
const afterAll = await api();
check('the reset of everything clears the file',
  (afterAll.data.content || '').trim() === '', JSON.stringify((afterAll.data.content || '').slice(0, 80)));

stop();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
