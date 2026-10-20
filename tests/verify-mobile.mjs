import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-mobile-verify');

const chrome = launchChrome({ port: PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId, ws } = await connect(PORT);
const ev = (e) => evalJson(cdp, sessionId, e);

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`); };

async function loadMobile(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }, sessionId);
  await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
  for (let i = 0; i < 120; i++) {
    if (await ev(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`)) break;
    await sleep(150);
  }
  await ev(`document.fonts.ready.then(() => true)`);
  await sleep(600);
}

const SNAP = `(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width), left: Math.round(b.left), right: Math.round(b.right) }; };
  return JSON.stringify({
    innerHeight: window.innerHeight,
    bodyH: r('body'), app: r('#app'), main: r('.main-content'),
    editor: r('.editor-panel'), preview: r('.preview-panel'), resizer: r('.resizer'),
    collapsed: document.querySelector('.preview-panel').classList.contains('collapsed'),
    editorScrollTop: document.querySelector('.editor-panel').scrollTop,
    editorScrollHeight: document.querySelector('.editor-panel').scrollHeight,
    editorClientHeight: document.querySelector('.editor-panel').clientHeight,
    bodyScrollHeight: document.body.scrollHeight,
    docScrollHeight: document.documentElement.scrollHeight,
    appHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim()
  });
})()`;

const snap = async () => JSON.parse(await ev(SNAP));
const clickAt = async (x, y) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }, sessionId);
};

// ---- A. sizing mechanism ----
await loadMobile(390, 844);
const mech = JSON.parse(await ev(`JSON.stringify({
  supportsDvh: CSS.supports('height', '100dvh'),
  bodyHeightRule: getComputedStyle(document.body).height,
  appHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  htmlHeight: getComputedStyle(document.documentElement).height
})`));
// The shell height must come from a real measurement of the visible area, not from dvh,
// because dvh resolves to the layout viewport on some mobile browsers.
check('body is sized from the measured visible area (--app-height)',
  mech.supportsDvh && Math.round(parseFloat(mech.bodyHeightRule)) === 844 && mech.appHeightVar === '844px',
  `supportsDvh=${mech.supportsDvh} bodyHeight=${mech.bodyHeightRule} --app-height="${mech.appHeightVar}"`);

// ---- B. across phone viewport heights, the app must match the visible area ----
for (const h of [844, 754, 667, 568]) {
  await loadMobile(390, h);
  const s = await snap();
  check(`mobile ${h}px: app fills exactly the visible viewport`,
    s.app.h === h && s.app.bottom === h && s.bodyScrollHeight <= h && s.docScrollHeight <= h,
    `app.h=${s.app.h} app.bottom=${s.app.bottom} bodyScrollH=${s.bodyScrollHeight} docScrollH=${s.docScrollHeight} (viewport ${h})`);
  // Expanded: the preview sits below the editor, so the editor ends at the resizer
  // and the preview is what reaches the bottom of the viewport.
  check(`mobile ${h}px: editor and preview together fill the viewport without overflow`,
    s.editor.bottom === s.resizer.top && s.preview.bottom === h && s.editorScrollHeight > 0,
    `editor.bottom=${s.editor.bottom} resizer.top=${s.resizer.top} preview.bottom=${s.preview.bottom} viewport=${h} scrollH=${s.editorScrollHeight}`);

  // bottom of the services list must be reachable by scrolling inside the editor
  await ev(`(() => { const ed = document.querySelector('.editor-panel'); ed.scrollTop = ed.scrollHeight; })()`);
  await sleep(300);
  const scrolled = await snap();
  const lr = JSON.parse(await ev(`(() => {
    const ed = document.querySelector('.editor-panel');
    const cards = ed.querySelectorAll('.group-card');
    const last = cards[cards.length - 1].getBoundingClientRect();
    const edBox = ed.getBoundingClientRect();
    return JSON.stringify({ lastBottom: Math.round(last.bottom), editorBottom: Math.round(edBox.bottom) });
  })()`));
  check(`mobile ${h}px: last service group scrolls into view`,
    lr.lastBottom <= lr.editorBottom + 2 && scrolled.editorScrollTop > 0,
    `lastGroup.bottom=${lr.lastBottom} <= editor.bottom=${lr.editorBottom}, scrollTop=${scrolled.editorScrollTop}`);

  // ---- C. collapse keeps the strip inside the visible area ----
  const btn = JSON.parse(await ev(`(() => { const r = document.querySelector('.preview-header-left button').getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`));
  await clickAt(btn.x, btn.y);
  await sleep(500);
  const c = await snap();
  check(`mobile ${h}px: collapsed strip stays fully on-screen`,
    c.collapsed && c.preview.bottom <= h && c.preview.h > 0 && c.preview.h <= 44,
    `preview.bottom=${c.preview.bottom} <= viewport ${h}, stripH=${c.preview.h}`);

  // Collapsed, the editor grows into the freed space; its own bottom must stay on-screen
  // so the last service group can be scrolled fully into view.
  check(`mobile ${h}px: collapsed editor bottom stays on-screen`,
    c.editor.bottom <= h && c.editor.bottom === c.resizer.top,
    `editor.bottom=${c.editor.bottom} <= viewport ${h}, resizer.top=${c.resizer.top}`);

  await ev(`(() => { const ed = document.querySelector('.editor-panel'); ed.scrollTop = ed.scrollHeight; })()`);
  await sleep(300);
  const lrc = JSON.parse(await ev(`(() => {
    const ed = document.querySelector('.editor-panel');
    const cards = ed.querySelectorAll('.group-card');
    const last = cards[cards.length - 1].getBoundingClientRect();
    return JSON.stringify({ lastBottom: Math.round(last.bottom), editorBottom: Math.round(ed.getBoundingClientRect().bottom), viewport: window.innerHeight });
  })()`));
  check(`mobile ${h}px: collapsed, last service group is fully visible on-screen`,
    lrc.lastBottom <= lrc.editorBottom + 2 && lrc.editorBottom <= lrc.viewport,
    `lastGroup.bottom=${lrc.lastBottom} editor.bottom=${lrc.editorBottom} viewport=${lrc.viewport}`);

  const hit = JSON.parse(await ev(`(() => {
    const b = document.querySelector('.preview-header-left button');
    const r = b.getBoundingClientRect();
    const cx = Math.round(r.x + r.width/2), cy = Math.round(r.y + r.height/2);
    const el = document.elementFromPoint(cx, cy);
    return JSON.stringify({ cx, cy, insideViewport: cy <= window.innerHeight && cy >= 0, hitIsButtonOrChild: el ? (el === b || b.contains(el)) : false, hit: el ? (el.className || el.tagName) : null });
  })()`));
  check(`mobile ${h}px: collapsed expand button is inside viewport and hittable`,
    hit.insideViewport && hit.hitIsButtonOrChild,
    `point=(${hit.cx},${hit.cy}) insideViewport=${hit.insideViewport} hitsButton=${hit.hitIsButtonOrChild} hit=${hit.hit}`);

  // expand again by tapping the strip
  const strip = JSON.parse(await ev(`(() => { const r = document.querySelector('.preview-header').getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`));
  await clickAt(strip.x, strip.y);
  await sleep(500);
  const ex = await snap();
  check(`mobile ${h}px: tapping the strip expands the preview`,
    !ex.collapsed && ex.preview.h > 100 && ex.preview.bottom <= h,
    `collapsed=${ex.collapsed} preview.h=${ex.preview.h} preview.bottom=${ex.preview.bottom}`);
}

// ---- D. fallback path for browsers without dvh ----
// ---- D0b. simulate the real phone condition: visible area SHORTER than the layout
// viewport (what the URL bar creates vs 100vh). Forcing --app-height to 600 while
// innerHeight is 844 reproduces it, and everything must stay reachable within 600. ----
await loadMobile(390, 844);
await ev(`document.documentElement.style.setProperty('--app-height', '600px')`);
await sleep(500);
const short = await snap();
check('simulated URL-bar viewport: app fits the shorter visible area',
  short.app.h === 600 && short.app.bottom === 600 && short.bodyScrollHeight <= 600,
  `app.h=${short.app.h} app.bottom=${short.app.bottom} bodyScrollH=${short.bodyScrollHeight} (visible 600, layout 844)`);

const sbtn = JSON.parse(await ev(`(() => { const r = document.querySelector('.preview-header-left button').getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`));
await clickAt(sbtn.x, sbtn.y);
await sleep(500);
const sc = await snap();
check('simulated URL-bar viewport: collapsed strip is on-screen and hittable',
  sc.collapsed && sc.preview.bottom <= 600 && sc.editor.bottom <= 600,
  `preview.bottom=${sc.preview.bottom} editor.bottom=${sc.editor.bottom} (must be <= 600)`);

await ev(`(() => { const ed = document.querySelector('.editor-panel'); ed.scrollTop = ed.scrollHeight; })()`);
await sleep(300);
const sLast = JSON.parse(await ev(`(() => {
  const ed = document.querySelector('.editor-panel');
  const cards = ed.querySelectorAll('.group-card');
  const last = cards[cards.length - 1].getBoundingClientRect();
  return JSON.stringify({ lastBottom: Math.round(last.bottom), editorBottom: Math.round(ed.getBoundingClientRect().bottom) });
})()`));
check('simulated URL-bar viewport: last service group is fully reachable',
  sLast.lastBottom <= sLast.editorBottom + 2 && sLast.editorBottom <= 600,
  `lastGroup.bottom=${sLast.lastBottom} editor.bottom=${sLast.editorBottom} (must be <= 600)`);

const sExpand = JSON.parse(await ev(`(() => { const r = document.querySelector('.preview-header').getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`));
await clickAt(sExpand.x, sExpand.y);
await sleep(500);
const se = await snap();
check('simulated URL-bar viewport: strip tap expands within the visible area',
  !se.collapsed && se.preview.bottom <= 600 && se.preview.h > 100,
  `collapsed=${se.collapsed} preview.h=${se.preview.h} preview.bottom=${se.preview.bottom}`);
await ev(`document.documentElement.style.removeProperty('--app-height')`);
await sleep(300);

// ---- D. fallback path for browsers without dvh ----
// ---- D0. modal stays within the visible area (same 100vh/80vh class of bug) ----
await loadMobile(390, 667);
await ev(`document.querySelector('.editor-toolbar .btn-primary').click()`);
await sleep(600);
const modal = JSON.parse(await ev(`(() => {
  const m = document.querySelector('.modal');
  if (!m) return JSON.stringify({ missing: true });
  const r = m.getBoundingClientRect();
  const btn = m.querySelector('.modal-actions .btn-primary');
  const br = btn.getBoundingClientRect();
  const el = document.elementFromPoint(Math.round(br.x + br.width/2), Math.round(br.y + br.height/2));
  return JSON.stringify({ missing: false, top: Math.round(r.top), bottom: Math.round(r.bottom),
    confirmBottom: Math.round(br.bottom), confirmVisible: br.bottom <= window.innerHeight,
    confirmHittable: el ? (el === btn || btn.contains(el)) : false, viewport: window.innerHeight });
})()`));
check('mobile: modal and its confirm button stay inside the visible viewport',
  !modal.missing && modal.top >= 0 && modal.bottom <= modal.viewport && modal.confirmVisible && modal.confirmHittable,
  `modal.top=${modal.top} modal.bottom=${modal.bottom} confirm.bottom=${modal.confirmBottom} confirmHittable=${modal.confirmHittable} viewport=${modal.viewport}`);
await ev(`document.querySelector('.modal-overlay').click()`);
await sleep(300);

// ---- D. fallback path for browsers without dvh ----
await loadMobile(390, 844);
await ev(`document.documentElement.style.setProperty('--app-height', '600px')`);
await sleep(400);
const fb = await snap();
check('fallback: --app-height drives the app height when set',
  fb.app.h === 600 && fb.appHeightVar === '600px',
  `app.h=${fb.app.h} --app-height="${fb.appHeightVar}"`);
await ev(`document.documentElement.style.removeProperty('--app-height')`);
await sleep(400);
const fb2 = await snap();
// Without the JS value the CSS fallback (dvh, or 100vh where dvh is unsupported) takes
// over, which is the correct starting point before the first measurement lands.
check('fallback: without the JS value the CSS fallback height applies',
  fb2.app.h === 844 && /dvh|vh|px/.test(fb2.appHeightVar),
  `app.h=${fb2.app.h} --app-height="${fb2.appHeightVar}"`);

// A real viewport change must re-measure and re-apply the JS value.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 1, mobile: true }, sessionId);
await sleep(700);
const fb3 = await snap();
check('fallback: a viewport change re-measures the shell',
  fb3.app.h === 700 && fb3.appHeightVar === '700px',
  `app.h=${fb3.app.h} --app-height="${fb3.appHeightVar}" (expected 700px)`);

// ---- E. desktop unchanged ----
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
for (let i = 0; i < 120; i++) { if (await ev(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`)) break; await sleep(150); }
await sleep(700);
const d = await snap();
check('desktop: layout still fills the viewport with a side-by-side split',
  d.app.h === 900 && d.main.bottom === 900 && d.preview.h === d.main.h && d.preview.left > d.editor.left,
  `app.h=${d.app.h} main.bottom=${d.main.bottom} editor.w=${d.editor.w} preview.h=${d.preview.h} main.h=${d.main.h} preview.left=${d.preview.left}`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
ws.close(); chrome.kill();
cleanup();
process.exit(failed.length ? 1 : 0);
