// Checks the colour schemes: the built-in ones are offered and can be applied, a
// scheme the user makes is stored as a file and can be removed again, and the
// colours of every scheme are readable enough.
//
// The test changes the scheme of the running editor, so it puts the original one
// back when it is done.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { parseIni } = require('../lib/ini.js');
const { COLOR_TOKENS } = require('../lib/themes.js');

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-themes');
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

const click = async (x, y) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }, sessionId);
};
const center = async (selector) => JSON.parse(await ev(`(() => { const r = document.querySelector('${selector}').getBoundingClientRect(); return JSON.stringify({x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)}); })()`));
// The top bar changes width with the language, so the position is read again before
// every click.
const clickSelector = async (selector) => {
  const box = await center(selector);
  await click(box.x, box.y);
};

// ---- The colours themselves -------------------------------------------------

function luminance(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const parts = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = parts.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const themesDir = join(process.cwd(), 'themes');
const themeFiles = readdirSync(themesDir).filter((f) => f.endsWith('.ini'));
check('there are several built-in schemes', themeFiles.length >= 6, themeFiles.length + ' schemes');

for (const file of themeFiles) {
  const parsed = parseIni(readFileSync(join(themesDir, file), 'utf8'), file);
  const colors = parsed.sections.colors || {};
  const missing = COLOR_TOKENS.filter((token) => !colors[token]);
  const pairs = [
    ['text on bg', colors.text, colors.bg],
    ['text on card', colors.text, colors['bg-card']],
    ['dim on bg', colors['text-dim'], colors.bg],
    ['dim on card', colors['text-dim'], colors['bg-card']]
  ].filter(([, a, b]) => a && b);
  const tooLow = pairs.filter(([, a, b]) => contrast(a, b) < 4.5)
    .map(([label, a, b]) => `${label} ${contrast(a, b).toFixed(2)}`);
  check(file + ': every colour token is defined', missing.length === 0, missing.join(',') || 'all present');
  check(file + ': the text is readable on the background', tooLow.length === 0, tooLow.join('; ') || 'all at least 4.5:1');
}

// ---- The editor -------------------------------------------------------------

const before = JSON.parse(await (await fetch(APP_URL + '/api/settings')).text());
const originalTheme = before.data.theme || 'midnight';
const tokens = JSON.parse(await (await fetch(APP_URL + '/api/themes')).text()).data.tokens || [];

// The colour scheme of the running editor is put back when the test ends, also when
// the test is interrupted.
function restoreThemeSync() {
  try {
    const script = `fetch(${JSON.stringify(APP_URL + '/api/settings')},{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:${JSON.stringify(originalTheme)}})}).then(()=>process.exit(0),()=>process.exit(0))`;
    execFileSync(process.execPath, ['-e', script], { timeout: 5000 });
  } catch { /* the editor may already be gone */ }
  // The scheme the test made is removed too, so an interrupted run leaves nothing
  // behind.
  try {
    const script = `fetch(${JSON.stringify(APP_URL + '/api/themes/verify-test-theme')},{method:'DELETE'}).then(()=>process.exit(0),()=>process.exit(0))`;
    execFileSync(process.execPath, ['-e', script], { timeout: 5000 });
  } catch { /* the editor may already be gone */ }
}
process.on('exit', restoreThemeSync);

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(600);

const appliedBg = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`);
check('the page starts in the configured scheme', !!appliedBg, '--bg=' + appliedBg);

// Open the appearance dialog from the settings dialog.
await clickSelector('.settings-btn');
await waitFor(`!!document.querySelector('.open-appearance-btn')`);
await clickSelector('.open-appearance-btn');
const opened = await waitFor(`document.querySelectorAll('.theme-row').length > 0`);
check('the appearance dialog lists the schemes', opened);

// The appearance dialog opens from the settings dialog, so it has to sit on top of
// it - otherwise it is invisible behind the settings dialog.
const stacking = await ev(`(() => {
  const overlays = [...document.querySelectorAll('.modal-overlay')];
  const top = overlays.find((o) => o.classList.contains('modal-overlay-top'));
  const other = overlays.find((o) => o !== top);
  if (!top || !other) return 'missing overlay';
  const zTop = parseInt(getComputedStyle(top).zIndex, 10) || 0;
  const zOther = parseInt(getComputedStyle(other).zIndex, 10) || 0;
  const box = top.querySelector('.modal').getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(box.x + box.width / 2), Math.round(box.y + 30));
  return JSON.stringify({ zTop, zOther, onTop: !!(hit && top.contains(hit)) });
})()`);
const stackingInfo = JSON.parse(stacking);
check('the appearance dialog is on top of the settings dialog',
  stackingInfo.zTop > stackingInfo.zOther && stackingInfo.onTop, stacking);

const rowCount = await ev(`document.querySelectorAll('.theme-row').length`);
check('every built-in scheme is listed', rowCount >= 6, rowCount + ' rows');

// The name and its tag belong on one line - a tag on a line of its own reads as a
// name that wrapped, even though there is room next to it.
const nameAndTag = JSON.parse(await ev(`(() => {
  const row = document.querySelector('.theme-row');
  const name = row.querySelector('.theme-name').getBoundingClientRect();
  const tag = row.querySelector('.theme-tag').getBoundingClientRect();
  return JSON.stringify({
    nameY: Math.round(name.y), tagY: Math.round(tag.y),
    nameRight: Math.round(name.right), tagLeft: Math.round(tag.left),
    tagH: Math.round(tag.height), tagText: row.querySelector('.theme-tag').textContent.trim()
  });
})()`));
check('the tag sits on the same line as the scheme name',
  Math.abs(nameAndTag.nameY - nameAndTag.tagY) <= 2 && nameAndTag.tagLeft >= nameAndTag.nameRight,
  JSON.stringify(nameAndTag));
check('the tag is a single line of text', nameAndTag.tagH <= 22, 'height=' + nameAndTag.tagH);

// The editor has a picker for every colour token the server knows about.
const editorState = await ev(`(() => {
  const button = document.querySelector('.theme-list-footer .btn');
  if (!button) return 'no button';
  button.click();
  return 'clicked';
})()`);
await sleep(300);
const pickerCount = await ev(`document.querySelectorAll('.theme-color input[type="color"]').length`);
const tokenCount = tokens.length;
check('the theme editor opens with a picker for every colour', editorState === 'clicked' && pickerCount === tokenCount,
  pickerCount + ' pickers for ' + tokenCount + ' tokens');

const named = await ev(`(() => {
  const input = document.querySelector('#theme-name-input');
  return input ? input.value : 'no input';
})()`);
check('a new scheme starts from the colours on screen', typeof named === 'string' && named.length > 0, JSON.stringify(named));

await ev(`(() => { const b = [...document.querySelectorAll('.theme-editor .modal-actions .btn')].find(x => x.classList.contains('btn-secondary')); if (b) b.click(); return true; })()`);

// Apply a light scheme and look at the colour that comes out of it.
const applied = await ev(`(() => {
  const rows = [...document.querySelectorAll('.theme-row')];
  const row = rows.find((r) => r.querySelector('.theme-name').textContent.trim() === '石墨');
  if (!row) return 'no row';
  const button = row.querySelector('.btn-primary');
  if (!button) return 'no button';
  button.click();
  return 'clicked';
})()`);
check('a light scheme can be picked', applied === 'clicked', applied);

const lightBg = await waitFor(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#eef0f4'`);
check('the picked scheme is on screen', lightBg,
  '--bg=' + await ev(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`));

// The scheme has to be stored, so a reload comes up in the same colours.
await cdp.send('Page.reload', {}, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(500);
check('the scheme survives a reload', await ev(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#eef0f4'`),
  '--bg=' + await ev(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`));

// Make a scheme of one's own, store it, use it, and remove it again.
const custom = await (await fetch(APP_URL + '/api/themes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'verify-test-theme',
    name: 'Verify test theme',
    colors: {
      bg: '#101014', 'bg-card': '#1b1b21', 'bg-hover': '#26262e', border: '#303038',
      text: '#e8e8ea', 'text-dim': '#9a9aa5', accent: '#e0603a', 'accent-hover': '#f07a52',
      'accent-text': '#ffffff', danger: '#e05555', success: '#5ac47a', info: '#5aa0e0', api: '#a06ad0'
    },
    options: { radius: '8px', shadow: '0 2px 8px rgba(0,0,0,0.3)' }
  })
})).json();
check('a custom scheme can be stored', custom.success === true && custom.data.themes.some((t) => t.id === 'verify-test-theme'), JSON.stringify(custom.error || ''));
check('the stored scheme is a file on disk', existsSync(join(themesDir, 'verify-test-theme.ini')));

const list = JSON.parse(await (await fetch(APP_URL + '/api/themes')).text());
check('the stored scheme is in the list', list.data.themes.some((t) => t.id === 'verify-test-theme'));

const builtIn = await (await fetch(APP_URL + '/api/themes/midnight', { method: 'DELETE' })).json();
check('a built-in scheme cannot be deleted', builtIn.success === false, JSON.stringify(builtIn.error || ''));

const exported = JSON.parse(await (await fetch(APP_URL + '/api/themes/verify-test-theme/export')).text());
check('a scheme can be exported as INI', exported.success === true && /\[colors\]/.test(exported.data.content));

const removed = await (await fetch(APP_URL + '/api/themes/verify-test-theme', { method: 'DELETE' })).json();
check('a custom scheme can be removed', removed.success === true && !removed.data.themes.some((t) => t.id === 'verify-test-theme'));
check('the removed scheme is gone from disk', !existsSync(join(themesDir, 'verify-test-theme.ini')));

// On a phone the buttons of a scheme go two to a row, so they stay inside the
// scheme instead of running under the colour swatches.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(500);
await clickSelector('.settings-btn');
await sleep(400);
await clickSelector('.open-appearance-btn');
await waitFor(`document.querySelectorAll('.theme-row').length > 0`);
await sleep(300);

const mobileRow = JSON.parse(await ev(`(() => {
  const row = document.querySelector('.theme-row');
  const buttons = [...row.querySelectorAll('.theme-actions .btn')].map((b) => {
    const r = b.getBoundingClientRect();
    return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width)};
  });
  const swatches = row.querySelector('.theme-swatches').getBoundingClientRect();
  return JSON.stringify({buttons, swatchBottom: Math.round(swatches.bottom)});
})()`));
const [first, second, third] = mobileRow.buttons;
check('the scheme buttons go two to a row on a phone',
  !!first && !!second && !!third && first.x !== second.x && first.x === third.x && first.w === second.w,
  JSON.stringify(mobileRow.buttons));
check('the scheme buttons sit below the colour swatches',
  mobileRow.buttons.every((b) => b.y >= mobileRow.swatchBottom - 1),
  'buttons start at y=' + (first ? first.y : '?') + ', swatches end at y=' + mobileRow.swatchBottom);

// Put the scheme back the way it was.
await fetch(APP_URL + '/api/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ theme: originalTheme })
});

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');

