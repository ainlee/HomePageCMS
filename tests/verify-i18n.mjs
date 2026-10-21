// Checks the language packs: the editor starts in the language that is configured,
// switching works without a reload, and the choice survives a reload.
//
// The test changes the language of the running editor, so it puts the original
// language back when it is done.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-i18n');
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

// The settings the editor is running with, so the test can put them back.
const before = JSON.parse(await (await fetch(APP_URL + '/api/settings')).text());
const originalLocale = before.data.locale || 'zh-TW';

async function setLocale(code) {
  const res = await fetch(APP_URL + '/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: code })
  });
  return res.json();
}

// The language of the running editor is put back when the test ends, also when the
// test is interrupted. The call is synchronous so it still works in an exit handler.
function restoreLocaleSync() {
  try {
    const script = `fetch(${JSON.stringify(APP_URL + '/api/settings')},{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale:${JSON.stringify(originalLocale)}})}).then(()=>process.exit(0),()=>process.exit(0))`;
    execFileSync(process.execPath, ['-e', script], { timeout: 5000 });
  } catch { /* the editor may already be gone */ }
}
process.on('exit', restoreLocaleSync);

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(500);

check('the editor starts in the configured language', await ev(`document.documentElement.lang === ${JSON.stringify(originalLocale)}`),
  'lang=' + await ev('document.documentElement.lang'));

// A string that was not replaced shows up as its key, for example "topbar.save". The
// catalogue says which keys exist, so the check looks for those exact strings.
const catalog = JSON.parse(await (await fetch(APP_URL + '/api/i18n')).text()).data.catalog;
const catalogKeys = Object.keys(catalog);
const rawKeys = async () => {
  const text = await ev(`document.querySelector('#app').innerText || ''`);
  return catalogKeys.filter((key) => text.includes(key));
};

const keysBefore = await rawKeys();
check('no untranslated keys are on screen', keysBefore.length === 0, JSON.stringify(keysBefore));

// The preview toggle is an icon: the eye says what it does, so the button needs no
// words. The tooltip carries the name for the hover.
const toggleInfo = await ev(`(() => {
  const button = document.querySelector('.preview-toggle-btn');
  if (!button) return 'no button';
  return JSON.stringify({
    text: button.textContent.trim(),
    title: button.getAttribute('title') || '',
    icon: !!button.querySelector('.mdi')
  });
})()`);
const toggle = JSON.parse(toggleInfo);
check('the preview toggle is an icon with a tooltip',
  toggle.text === '' && toggle.icon && toggle.title.length > 0, toggleInfo);

// Every button in the top bar is the same height, the language one included, and the
// icon buttons are the same width.
const buttonSizes = await ev(`JSON.stringify([...document.querySelectorAll('.topbar-right .btn')].map((b) => {
  const r = b.getBoundingClientRect();
  return {w: Math.round(r.width), h: Math.round(r.height), label: !!b.querySelector('.btn-label')};
}))`);
const sizes = JSON.parse(buttonSizes);
const heights = new Set(sizes.map((s) => s.h));
const iconWidths = new Set(sizes.filter((s) => !s.label).map((s) => s.w));
check('the top bar buttons are all the same height', heights.size === 1, buttonSizes);
check('the icon buttons in the top bar are the same width', iconWidths.size === 1, JSON.stringify([...iconWidths]));

// The language menu in the top bar unfolds and switches the language.
await clickSelector('.lang-btn');
const menuOpen = await waitFor(`(() => {
  const menu = document.querySelector('.lang-dropdown');
  if (!menu) return false;
  const style = getComputedStyle(menu);
  return style.visibility === 'visible' && parseFloat(style.opacity) > 0.9;
})()`);
check('the language menu unfolds', menuOpen);

const menuItems = await ev(`JSON.stringify([...document.querySelectorAll('.lang-item')].map((i) => i.querySelector('.lang-code').textContent.trim()))`);
check('the menu lists every language', ['zh-TW', 'zh-CN', 'ja', 'en'].every((c) => menuItems.includes(c)), menuItems);

// A real mouse click, so the check also proves that the menu is not covered by
// something else.
const enBox = JSON.parse(await ev(`(() => {
  const item = [...document.querySelectorAll('.lang-item')].find((i) => i.querySelector('.lang-code').textContent.trim() === 'en');
  if (!item) return 'null';
  const r = item.getBoundingClientRect();
  return JSON.stringify({x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)});
})()`));
await click(enBox.x, enBox.y);
const picked = await ev(`(() => {
  const item = [...document.querySelectorAll('.lang-item')].find((i) => i.querySelector('.lang-code').textContent.trim() === 'en');
  return !!item;
})()`);
const switchedByMenu = await waitFor(`document.documentElement.lang === 'en'`);
check('picking a language in the menu switches the interface', picked && switchedByMenu,
  'lang=' + await ev('document.documentElement.lang'));
check('the menu closes after a language is picked', await ev(`!document.querySelector('.lang-dropdown').classList.contains('open')`));

// And back again, through the same menu.
await clickSelector('.lang-btn');
await waitFor(`document.querySelector('.lang-dropdown').classList.contains('open')`);
await ev(`(() => {
  const item = [...document.querySelectorAll('.lang-item')].find((i) => i.querySelector('.lang-code').textContent.trim() === 'zh-TW');
  if (item) item.click();
  return true;
})()`);
check('the menu can switch back', await waitFor(`document.documentElement.lang === 'zh-TW'`));

// Every language pack has to have the same keys, otherwise a language is missing
// strings the others have.
const available = JSON.parse(await (await fetch(APP_URL + '/api/i18n')).text()).data.available;
const mismatches = [];
for (const entry of available) {
  const pack = JSON.parse(await (await fetch(APP_URL + '/api/i18n?locale=' + encodeURIComponent(entry.code))).text()).data;
  const keys = Object.keys(pack.catalog);
  const missing = catalogKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !catalogKeys.includes(key));
  if (missing.length || extra.length) {
    mismatches.push(entry.code + ' missing:' + missing.join(',') + ' extra:' + extra.join(','));
  }
}
check('every language pack has the same keys', mismatches.length === 0, mismatches.join(' | ') || available.length + ' packs');

// Open the settings dialog and switch the language.
await clickSelector('.settings-btn');
const opened = await waitFor(`!!document.querySelector('#locale-select')`);
check('the settings dialog has a language select', opened);

const options = await ev(`JSON.stringify([...document.querySelectorAll('#locale-select option')].map(o => o.value))`);
check('every installed language is offered', ['zh-TW', 'zh-CN', 'ja', 'en'].every((c) => options.includes(c)), options);

// The action row of the settings dialog carries the project name and the version
// that is running, and links to the repository.
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
const brand = JSON.parse(await ev(`(() => {
  const link = document.querySelector('.modal-brand');
  if (!link) return 'null';
  const row = link.parentElement.getBoundingClientRect();
  const box = link.getBoundingClientRect();
  const style = getComputedStyle(link.parentElement);
  const buttons = [...link.parentElement.querySelectorAll('.btn')].map((b) => Math.round(b.getBoundingClientRect().x));
  return JSON.stringify({
    text: link.textContent.replace(/\\s+/g, ' ').trim(),
    href: link.getAttribute('href'),
    leftGap: Math.round(box.x - row.x),
    padLeft: Math.round(parseFloat(style.paddingLeft)),
    rowMiddle: Math.round(row.x + row.width / 2),
    buttons: buttons
  });
})()`));
check('the settings dialog shows the project name and version',
  brand.text === 'HomePageCMS v' + pkg.version, JSON.stringify(brand.text) + ' expected v' + pkg.version);
check('the project name links to the repository', /github\.com/.test(brand.href || ''), brand.href);
check('the project name sits at the left of the action row',
  Math.abs(brand.leftGap - brand.padLeft) <= 1, 'gap=' + brand.leftGap + ' padding=' + brand.padLeft);
check('the buttons stay on the right of the action row',
  brand.buttons.every((x) => x >= brand.rowMiddle), JSON.stringify(brand.buttons) + ' middle=' + brand.rowMiddle);

await ev(`(() => {
  const select = document.querySelector('#locale-select');
  select.value = 'en';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

const changed = await waitFor(`document.documentElement.lang === 'en' && document.querySelector('.topbar h1').textContent.includes('Homepage editor')`);
check('switching the language changes the interface without a reload', changed,
  'lang=' + await ev('document.documentElement.lang') + ' title=' + JSON.stringify(await ev(`document.querySelector('.topbar h1').textContent.trim()`)));

const keysAfter = await rawKeys();
check('no untranslated keys are left after switching', keysAfter.length === 0, JSON.stringify(keysAfter));

// The colour schemes are read again after a language change, so their names follow
// the new language too. Give that a moment to arrive.
await sleep(800);

// The service names and group names come from the user's own Homepage configuration
// and are not translated, so only the interface around them is checked.
const chinese = await ev(`(() => {
  const parts = ['.topbar', '.editor-toolbar', '.preview-panel', '.modal-overlay']
    .map((s) => document.querySelector(s))
    .filter(Boolean)
    .map((el) => el.innerText || '')
    .join(' ');
  // The language list shows every language in its own name, which is the point of it.
  const select = document.querySelector('#locale-select');
  const text = parts.split(select ? select.innerText : '').join(' ');
  return JSON.stringify([...new Set(text.match(/[\\u4e00-\\u9fff]+/g) || [])].slice(0, 10));
})()`);
check('no Chinese text is left in the interface', chinese === '[]', chinese);

// The choice has to survive a reload, so it must be in the settings file.
await cdp.send('Page.reload', {}, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(400);
check('the language survives a reload', await ev(`document.documentElement.lang === 'en'`),
  'lang=' + await ev('document.documentElement.lang'));

// The server sends its own messages in the language of the request.
const localized = await (await fetch(APP_URL + '/api/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en' },
  body: JSON.stringify({ previewUrl: 'not-a-url' })
})).json();
check('server messages follow the requested language',
  typeof localized.error === 'string' && /URL/i.test(localized.error), JSON.stringify(localized.error));

// Put the language back the way it was.
await setLocale(originalLocale);

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');

