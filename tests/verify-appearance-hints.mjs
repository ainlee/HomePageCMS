// Checks the hints on the appearance tab: the line between the two blocks, the
// note next to the title, and the warning for a palette Homepage does not know.
//
// The editor runs against a settings file of its own here, so a palette that
// would break the real dashboard never reaches the running installation.
import { connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
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

// A configuration directory of its own, with a palette Homepage would not know.
const configDir = mkdtempSync(join(tmpdir(), 'hcms-hints-'));
mkdirSync(join(configDir, 'backups'), { recursive: true });
writeFileSync(join(configDir, 'settings.yaml'), [
  '---',
  '# For configuration options and examples, please see:',
  '# https://gethomepage.dev/configs/settings/',
  '',
  'allowedHosts:',
  '  - localhost',
  'color: not-a-homepage-palette',
  ''
].join('\n'), 'utf8');
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

const CHROME_PORT = await freePort();
const PROFILE = createProfile('hp-verify-hints');
const chrome = launchChrome({ port: CHROME_PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId } = await connect(CHROME_PORT);
const ev = (e) => evalJson(cdp, sessionId, e);
const APP_URL = 'http://127.0.0.1:' + PORT;

function stop() {
  try { editor.kill(); } catch {}
  try { rmSync(configDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', stop);

// Wait for the editor to come up.
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

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(800);

await ev(`(() => {
  const b = [...document.querySelectorAll('.tab-btn')].find(x => x.textContent.includes('外觀'));
  if (b) b.click();
  return !!b;
})()`);
const opened = await waitFor(`!!document.querySelector('.appearance-panel')`);
check('the appearance tab opens', opened);
await sleep(800);

// The line between the two blocks.
const split = JSON.parse(await ev(`(() => {
  const section = document.querySelector('.appearance-section-split');
  if (!section) return '{"missing":true}';
  const style = getComputedStyle(section);
  const previous = section.previousElementSibling;
  return JSON.stringify({
    borderTop: style.borderTopWidth,
    borderStyle: style.borderTopStyle,
    previousBorder: previous ? getComputedStyle(previous).borderTopWidth : 'none',
    gap: parseFloat(style.paddingTop)
  });
})()`));
check('a line separates the custom CSS from the fields above',
  split.borderTop !== '0px' && split.borderStyle !== 'none' && split.gap > 0, JSON.stringify(split));
check('only the custom CSS block carries the line',
  split.previousBorder === '0px' || split.previousBorder === 'none', JSON.stringify(split));

// The note next to the title.
const tip = JSON.parse(await ev(`(() => {
  const mark = document.querySelector('.info-mark');
  if (!mark) return '{"missing":true}';
  const tipEl = mark.querySelector('.info-tip');
  const before = getComputedStyle(tipEl).visibility;
  mark.focus();
  const after = getComputedStyle(tipEl).visibility;
  const rect = tipEl.getBoundingClientRect();
  return JSON.stringify({
    before, after,
    length: tipEl.textContent.trim().length,
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  });
})()`));
check('the note next to the title appears on focus',
  tip.before === 'hidden' && tip.after === 'visible', JSON.stringify(tip));
check('the note has a readable size', tip.width > 150 && tip.height > 30 && tip.length > 20, JSON.stringify(tip));

// The note hangs to the right of the mark: centred on it, half of it would run
// off the side of a narrow screen.
const hang = JSON.parse(await ev(`(() => {
  const mark = document.querySelector('.info-mark');
  const tipEl = mark.querySelector('.info-tip');
  const m = mark.getBoundingClientRect();
  const t = tipEl.getBoundingClientRect();
  return JSON.stringify({
    markLeft: Math.round(m.left),
    tipLeft: Math.round(t.left),
    difference: Math.round(t.left - m.left)
  });
})()`));
check('the note hangs to the right of the mark',
  hang.difference >= 0 && hang.difference < 20, JSON.stringify(hang));

// The warning for a palette Homepage does not know.
const warning = await ev(`(() => {
  const el = document.querySelector('.appearance-warning');
  return el ? el.textContent.trim() : '';
})()`);
check('a palette Homepage does not know is called out',
  warning.includes('not-a-homepage-palette'), warning.slice(0, 90));

// On a phone the note must not stick out of the panel.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await sleep(500);
const narrow = JSON.parse(await ev(`(() => {
  const tipEl = document.querySelector('.info-tip');
  const panel = document.querySelector('.appearance-panel').getBoundingClientRect();
  const tip = tipEl.getBoundingClientRect();
  return JSON.stringify({
    panelLeft: Math.round(panel.left),
    panelRight: Math.round(panel.right),
    tipLeft: Math.round(tip.left),
    tipRight: Math.round(tip.right),
    width: Math.round(tip.width)
  });
})()`));
check('the note stays inside the panel on a phone',
  narrow.tipLeft >= narrow.panelLeft && narrow.tipRight <= narrow.panelRight, JSON.stringify(narrow));

// The seed colour is picked on the swatch itself: one swatch for the official
// colour, one picker for the seed, and no third block in between.
const seed = JSON.parse(await ev(`(() => {
  const field = document.querySelector('.seed-fields');
  if (!field) return '{"missing":true}';
  const swatches = [...field.querySelectorAll('.seed-swatch')];
  const pickers = [...field.querySelectorAll('input[type="color"]')];
  return JSON.stringify({
    swatches: swatches.length,
    pickers: pickers.length,
    pickerRightOfOfficial: pickers[0] && swatches[0]
      ? Math.round(pickers[0].getBoundingClientRect().left) > Math.round(swatches[0].getBoundingClientRect().left)
      : false
  });
})()`));
check('the seed colour is picked on one swatch',
  seed.swatches === 1 && seed.pickers === 1 && seed.pickerRightOfOfficial, JSON.stringify(seed));

// And it looks like the swatch next to it: same size, same border, same corners.
const look = JSON.parse(await ev(`(() => {
  const swatch = document.querySelector('.seed-swatch');
  const picker = document.querySelector('.seed-input');
  const a = getComputedStyle(swatch);
  const b = getComputedStyle(picker);
  const ra = swatch.getBoundingClientRect();
  const rb = picker.getBoundingClientRect();
  return JSON.stringify({
    swatch: [Math.round(ra.width), Math.round(ra.height), a.borderRadius, a.borderTopWidth],
    picker: [Math.round(rb.width), Math.round(rb.height), b.borderRadius, b.borderTopWidth],
    // The browser draws the colour with an inset of its own; that inset is taken
    // out, so the colour fills the picker.
    wrapperPadding: getComputedStyle(picker, '::-webkit-color-swatch-wrapper').padding
  });
})()`));
check('the picker looks like the swatch next to it',
  look.swatch[0] === look.picker[0] && look.swatch[1] === look.picker[1] &&
  look.swatch[2] === look.picker[2] && look.swatch[3] === look.picker[3] &&
  look.wrapperPadding === '0px', JSON.stringify(look));

// The real installation must not have been touched.
const live = await (await fetch('http://localhost:3456/api/homepage-settings')).json();
check('the running installation is not affected',
  !String(live.data.values.color).includes('not-a-homepage-palette'),
  'color=' + live.data.values.color);

stop();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
