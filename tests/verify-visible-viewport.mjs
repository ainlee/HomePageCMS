// Reproduces the real phone condition that headless device emulation cannot show:
// a browser whose dvh/100vh resolve to the LARGE viewport (URL bar hidden) while the
// area the user can actually see is shorter. visualViewport is stubbed to report the
// shorter visible height, which is what the page must lay out against.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-visible-verify');

const chrome = launchChrome({ port: PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId, ws } = await connect(PORT);
const ev = (e) => evalJson(cdp, sessionId, e);

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`); };

const SNAP = `(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  return JSON.stringify({
    innerHeight: window.innerHeight,
    appHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
    bodyH: r('body'), app: r('#app'), editor: r('.editor-panel'), preview: r('.preview-panel'), resizer: r('.resizer'),
    collapsed: document.querySelector('.preview-panel').classList.contains('collapsed'),
    bodyScrollHeight: document.body.scrollHeight,
    docScrollHeight: document.documentElement.scrollHeight
  });
})()`;
const snap = async () => JSON.parse(await ev(SNAP));
const clickAt = async (x, y) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }, sessionId);
};
const lastGroup = async () => JSON.parse(await ev(`(() => {
  const ed = document.querySelector('.editor-panel');
  const cards = ed.querySelectorAll('.group-card');
  const last = cards[cards.length - 1].getBoundingClientRect();
  return JSON.stringify({ lastBottom: Math.round(last.bottom), editorBottom: Math.round(ed.getBoundingClientRect().bottom), scrollTop: ed.scrollTop });
})()`));
const expandBtnPoint = async () => JSON.parse(await ev(`(() => { const r = document.querySelector('.preview-header-left button').getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`));
const stripPoint = async () => JSON.parse(await ev(`(() => { const r = document.querySelector('.preview-header').getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`));

// Preload script: make visualViewport report the SHORTER visible area (600) while the
// layout viewport stays 844 - exactly the URL-bar relationship on a real phone.
const stubVisible = (visible) => `(() => {
  const fake = { height: ${visible}, width: 390, scale: 1, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0,
    addEventListener: function(){}, removeEventListener: function(){} };
  try { Object.defineProperty(window, 'visualViewport', { configurable: true, get: function(){ return fake; } }); } catch (e) {}
})();`;

async function loadMobile(width, height, stub) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }, sessionId);
  const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stub }, sessionId);
  await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
  for (let i = 0; i < 120; i++) {
    if (await ev(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`)) break;
    await sleep(150);
  }
  await ev('document.fonts.ready.then(() => true)');
  await sleep(600);
  return identifier;
}

// ===== A. the exact reported condition: dvh says 844, the user can see 600 =====
const VISIBLE = 600;
let idA = await loadMobile(390, 844, stubVisible(VISIBLE));
const mech = JSON.parse(await ev(`JSON.stringify({
  dvhResolvesTo: (() => { const el = document.createElement('div'); el.style.cssText='position:absolute;height:100dvh'; document.body.appendChild(el);
    const h = Math.round(el.getBoundingClientRect().height); el.remove(); return h; })(),
  visualViewportH: Math.round(window.visualViewport.height),
  innerHeight: window.innerHeight
})`));
check('scenario matches the phone: dvh/100vh report the large viewport, visible area is shorter',
  mech.dvhResolvesTo === 844 && mech.visualViewportH === VISIBLE,
  `100dvh=${mech.dvhResolvesTo} visualViewport=${mech.visualViewportH} innerHeight=${mech.innerHeight}`);

const a = await snap();
check('shell is measured against the VISIBLE area, not dvh',
  a.appHeightVar === VISIBLE + 'px' && a.app.h === VISIBLE && a.app.bottom === VISIBLE,
  `--app-height="${a.appHeightVar}" app.h=${a.app.h} app.bottom=${a.app.bottom} (must be ${VISIBLE})`);
// documentElement.scrollHeight is floored at the layout viewport's client height, so it
// stays 844 even when nothing overflows. What matters is whether the page can actually be
// scrolled or panned, which is what used to push the bottom of the shell out of reach.
const scrollability = JSON.parse(await ev(`(() => {
  const before = window.scrollY;
  window.scrollTo(0, 500);
  const afterY = window.scrollY;
  window.scrollTo(0, 0);
  return JSON.stringify({ before, afterY, htmlOverflow: getComputedStyle(document.documentElement).overflowY,
    bodyOverflow: getComputedStyle(document.body).overflowY, htmlH: getComputedStyle(document.documentElement).height });
})()`));
check('the page itself cannot scroll or pan, so nothing is pushed out of reach',
  scrollability.afterY === 0 && scrollability.htmlOverflow === 'hidden' && scrollability.bodyOverflow === 'hidden'
    && scrollability.htmlH === VISIBLE + 'px' && a.bodyScrollHeight <= VISIBLE,
  `scrollY after scrollTo(0,500)=${scrollability.afterY} html.overflow=${scrollability.htmlOverflow} html.height=${scrollability.htmlH} bodyScrollH=${a.bodyScrollHeight} visible=${VISIBLE}`);

// bottom of the services list must be reachable by scrolling inside the editor
await ev(`(() => { const ed = document.querySelector('.editor-panel'); ed.scrollTop = ed.scrollHeight; })()`);
await sleep(300);
const aLast = await lastGroup();
check('last service group is reachable on-screen',
  aLast.lastBottom <= aLast.editorBottom + 2 && aLast.scrollTop > 0 && aLast.editorBottom <= VISIBLE,
  `lastGroup.bottom=${aLast.lastBottom} <= editor.bottom=${aLast.editorBottom} (visible ${VISIBLE}), scrollTop=${aLast.scrollTop}`);

// collapse and confirm the strip lands inside the visible area
const b1 = await expandBtnPoint();
await clickAt(b1.x, b1.y);
await sleep(500);
const ac = await snap();
check('collapsed strip is inside the visible area (was off-screen before)',
  ac.collapsed && ac.preview.bottom <= VISIBLE && ac.preview.h > 0 && ac.preview.h <= 44,
  `collapsed=${ac.collapsed} strip.bottom=${ac.preview.bottom} <= ${VISIBLE}, stripH=${ac.preview.h}`);

const hit = JSON.parse(await ev(`(() => {
  const b = document.querySelector('.preview-header-left button');
  const r = b.getBoundingClientRect();
  const cx = Math.round(r.x + r.width/2), cy = Math.round(r.y + r.height/2);
  const el = document.elementFromPoint(cx, cy);
  return JSON.stringify({ cx, cy, insideViewport: cy <= window.visualViewport.height && cy >= 0,
    hitIsButtonOrChild: el ? (el === b || b.contains(el)) : false, hit: el ? (el.className || el.tagName) : null });
})()`));
check('collapsed expand trigger is visible and hittable',
  hit.insideViewport && hit.hitIsButtonOrChild,
  `point=(${hit.cx},${hit.cy}) insideVisible=${hit.insideViewport} hitsButton=${hit.hitIsButtonOrChild} hit=${hit.hit}`);

await ev(`(() => { const ed = document.querySelector('.editor-panel'); ed.scrollTop = ed.scrollHeight; })()`);
await sleep(300);
const acLast = await lastGroup();
check('collapsed, the last service group is fully visible',
  acLast.lastBottom <= acLast.editorBottom + 2 && acLast.editorBottom <= VISIBLE,
  `lastGroup.bottom=${acLast.lastBottom} editor.bottom=${acLast.editorBottom} (visible ${VISIBLE})`);

const st = await stripPoint();
await clickAt(st.x, st.y);
await sleep(500);
const ae = await snap();
check('tapping the strip expands the preview inside the visible area',
  !ae.collapsed && ae.preview.h > 100 && ae.preview.bottom <= VISIBLE,
  `collapsed=${ae.collapsed} preview.h=${ae.preview.h} preview.bottom=${ae.preview.bottom}`);

await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: idA }, sessionId);

// ===== B. browsers without dvh: the 100vh fallback must also be corrected =====
let idB = await loadMobile(390, 844, stubVisible(VISIBLE) + `
  try {
    const orig = CSS.supports.bind(CSS);
    CSS.supports = function(){ const k = String(arguments[0]) + String(arguments[1] || '');
      if (k.indexOf('dvh') !== -1) return false; return orig.apply(null, arguments); };
  } catch (e) {}
`);
const b = await snap();
check('without dvh support the shell still uses the measured visible height',
  b.appHeightVar === VISIBLE + 'px' && b.app.h === VISIBLE && b.bodyScrollHeight <= VISIBLE,
  `--app-height="${b.appHeightVar}" app.h=${b.app.h} bodyScrollH=${b.bodyScrollHeight} (visible ${VISIBLE})`);
await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: idB }, sessionId);

// ===== C. desktop is unaffected =====
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
for (let i = 0; i < 120; i++) { if (await ev(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`)) break; await sleep(150); }
await sleep(700);
const d = await snap();
check('desktop: shell still fills the viewport exactly',
  d.app.h === 900 && d.app.bottom === 900 && d.appHeightVar === '900px' && d.bodyScrollHeight <= 900,
  `--app-height="${d.appHeightVar}" app.h=${d.app.h} app.bottom=${d.app.bottom} bodyScrollH=${d.bodyScrollHeight}`);

// ===== D2. on-screen keyboard: the visible area shrinks while a modal is open =====
const idKb = await loadMobile(390, 844, stubVisible(340));
await ev(`document.querySelector('.editor-toolbar .btn-primary').click()`);
await sleep(700);
const kb = JSON.parse(await ev(`(() => {
  const m = document.querySelector('.modal');
  const btn = m.querySelector('.modal-actions .btn-primary');
  const br = btn.getBoundingClientRect();
  const el = document.elementFromPoint(Math.round(br.x + br.width/2), Math.round(br.y + br.height/2));
  return JSON.stringify({ appH: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
    appH_px: Math.round(document.querySelector('#app').getBoundingClientRect().height),
    modalBottom: Math.round(m.getBoundingClientRect().bottom), confirmBottom: Math.round(br.bottom),
    confirmHittable: el ? (el === btn || btn.contains(el)) : false });
})()`));
check('keyboard-open: the modal and its confirm button stay above the keyboard',
  kb.confirmHittable && kb.confirmBottom <= 340 && kb.modalBottom <= 340 && kb.appH_px === 340,
  `--app-height="${kb.appH}" app.h=${kb.appH_px} modal.bottom=${kb.modalBottom} confirm.bottom=${kb.confirmBottom} (keyboard top at 340) confirmHittable=${kb.confirmHittable}`);
await ev(`document.querySelector('.modal-overlay').click()`);
await sleep(400);
await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: idKb }, sessionId);

// ===== D. rotation / resize re-measures =====
// Fresh load without the stubbed visualViewport, so the real measurement path runs.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await cdp.send('Page.navigate', { url: 'http://localhost:3456' }, sessionId);
for (let i = 0; i < 120; i++) { if (await ev(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`)) break; await sleep(150); }
await sleep(600);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true }, sessionId);
await sleep(800);
const rot = await snap();
check('rotating re-measures the visible area',
  rot.appHeightVar === '390px' && rot.app.h === 390 && rot.bodyScrollHeight <= 390,
  `--app-height="${rot.appHeightVar}" app.h=${rot.app.h} bodyScrollH=${rot.bodyScrollHeight}`);

// ===== E. iOS-Safari shape: innerHeight ALREADY tracks the visible area =====
// On iOS window.innerHeight shrinks with the URL bar, unlike Android Chrome. The layout
// must stay correct there too, so the measurement has to work when both agree.
const idIos = await loadMobile(390, 844, `(() => {
  const fake = { height: ${VISIBLE}, width: 390, scale: 1, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0,
    addEventListener: function(){}, removeEventListener: function(){} };
  try { Object.defineProperty(window, 'visualViewport', { configurable: true, get: function(){ return fake; } }); } catch (e) {}
  try { Object.defineProperty(window, 'innerHeight', { configurable: true, get: function(){ return ${VISIBLE}; } }); } catch (e) {}
})();`);
const ios = await snap();
check('iOS-Safari shape: innerHeight and visualViewport both track the visible area',
  ios.app.h === VISIBLE && ios.appHeightVar === VISIBLE + 'px' && ios.bodyScrollHeight <= VISIBLE,
  `--app-height="${ios.appHeightVar}" app.h=${ios.app.h} bodyScrollH=${ios.bodyScrollHeight} (visible ${VISIBLE})`);
const iosBtn = await expandBtnPoint();
await clickAt(iosBtn.x, iosBtn.y);
await sleep(500);
const iosC = await snap();
check('iOS-Safari shape: collapsed strip is inside the visible area',
  iosC.collapsed && iosC.preview.bottom <= VISIBLE,
  `collapsed=${iosC.collapsed} strip.bottom=${iosC.preview.bottom} <= ${VISIBLE}`);
await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: idIos }, sessionId);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
ws.close(); chrome.kill();
cleanup();
process.exit(failed.length ? 1 : 0);
