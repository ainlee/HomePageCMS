// Checks the custom CSS part of the appearance tab: a ramp is generated from a seed
// colour, it lands in custom.css, and the file is put back the way it was.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-custom-css');
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

const api = async () => (await (await fetch(APP_URL + '/api/homepage-custom-css')).json());
const before = await api();
const originalContent = before.data.content || '';

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(800);

await click('.tab-bar .tab-btn:nth-child(3)');
const opened = await waitFor(`!!document.querySelector('.appearance-panel')`);
check('the appearance tab opens', opened);
await sleep(800);

check('the tab has a stylesheet editor', await ev(`!!document.querySelector('.css-editor')`));
check('the editor shows the file', await ev(`document.querySelector('.css-editor').value.length === ${JSON.stringify(originalContent.length)}`));

// Pick a palette and a seed colour, then generate the ramp.
await ev(`(() => {
  // Seven selects carry the style fields; the palette of the custom ramp is the
  // eighth one.
  const select = document.querySelectorAll('.appearance-panel select')[7];
  select.value = 'rose';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  const color = document.querySelector('.appearance-panel input[type="color"]');
  color.value = '#e11d48';
  // Vue binds v-model on a colour input to the input event.
  color.dispatchEvent(new Event('input', { bubbles: true }));
  color.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await sleep(300);
await click('.appearance-actions .btn:nth-child(1)');
const generated = await waitFor(`document.querySelectorAll('.ramp-chip').length === 10`);
check('the ramp shows ten shades', generated,
  String(await ev(`document.querySelectorAll('.ramp-chip').length`)));

const chipColour = await ev(`(() => {
  const chips = [...document.querySelectorAll('.ramp-chip')];
  return JSON.stringify(chips.map((c) => getComputedStyle(c).backgroundColor));
})()`);
const chipColours = JSON.parse(chipColour);
// The seed colour has to be the 500 shade, and the ramp runs from light to dark.
check('the shades are painted', chipColours.length === 10 && chipColours[5] === 'rgb(225, 29, 72)', chipColour);

// Put the ramp into the stylesheet.
await click('.appearance-actions .btn:nth-child(2)');
await sleep(300);
const text = await ev(`document.querySelector('.css-editor').value`);
check('the ramp lands in the stylesheet', text.includes('html.theme-rose'), text.slice(0, 120));
check('the stylesheet holds the ten shades',
  ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
    .every((name) => text.includes('--color-' + name + ':')), '');
check('the block is marked so it can be replaced', text.includes('HomePageCMS: rose'), '');

// Save it and look at the file.
await click('.appearance-head .btn-primary');
await sleep(2000);
const after = await api();
check('the stylesheet is written to custom.css', after.data.content.includes('html.theme-rose'), '');

// The rule has to win against the built-in one. Homepage loads custom.css before
// its own stylesheet, so the selector needs the higher specificity.
// The live dashboard is behind a cache, so the query string keeps the check from
// reading a cached copy of the file.
const served = await (await fetch('https://home.928202333.xyz/api/config/custom.css?cb=' + Date.now())).text();
check('Homepage serves the new stylesheet', served.includes('html.theme-rose'), served.slice(0, 120));

// Put the file back the way it was.
await fetch(APP_URL + '/api/homepage-custom-css', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: originalContent, hash: after.hash })
});
const restored = await api();
check('the original stylesheet is back', restored.data.content === originalContent, JSON.stringify(restored.data.content.slice(0, 60)));

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
