// Checks the preview panel collapse behaviour: collapsing must move the divider and
// hand the freed space to the editor, and the collapsed strip must stay expandable.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome, waitForApp } from './helpers.mjs';

const DEVTOOLS_PORT = await freePort();
const PROFILE = createProfile('hp-verify');

const chrome = launchChrome({ port: DEVTOOLS_PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId, ws } = await connect(DEVTOOLS_PORT);

const setViewport = (width, height, mobile) =>
  cdp.send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile }, sessionId);

const GEOM = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const pv = document.querySelector('.preview-panel');
  return JSON.stringify({
    editor: box('.editor-panel'),
    preview: box('.preview-panel'),
    resizer: box('.resizer'),
    main: box('.main-content'),
    collapsed: pv.classList.contains('collapsed'),
    iframeVisible: !!document.querySelector('.preview-iframe') && getComputedStyle(document.querySelector('.preview-iframe')).display !== 'none',
    toggleLabel: (document.querySelector('.preview-header-left span') || {}).textContent,
    toggleIcon: (document.querySelector('.preview-header-left i') || {}).className
  });
})()`;

const geom = async () => JSON.parse(await evalJson(cdp, sessionId, GEOM));

async function click(x, y) {
  const common = { x, y, button: 'left', clickCount: 1 };
  await cdp.send('Input.dispatchMouseEvent', { ...common, type: 'mousePressed', buttons: 1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { ...common, type: 'mouseReleased', buttons: 0 }, sessionId);
}

async function dragTo(targetX, targetY) {
  const rz = (await geom()).resizer;
  const fromX = rz.x + rz.w / 2, fromY = rz.y + rz.h / 2;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fromX, y: fromY, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
  for (let i = 1; i <= 12; i++) {
    const x = fromX + ((targetX - fromX) * i) / 12;
    const y = fromY + ((targetY - fromY) * i) / 12;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }, sessionId);
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetX, y: targetY, button: 'left', clickCount: 1, buttons: 0 }, sessionId);
}

const toggleButtonCenter = async () => JSON.parse(await evalJson(cdp, sessionId, `(() => {
  const b = document.querySelector('.preview-header-left button');
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
})()`));

const stripCenter = async () => JSON.parse(await evalJson(cdp, sessionId, `(() => {
  const h = document.querySelector('.preview-header');
  const r = h.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
})()`));

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
}

// ---------------- Desktop / column split ----------------
await setViewport(1440, 900, false);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitForApp(cdp, sessionId);
await sleep(500);

const base = await geom();
check('desktop: initial layout has divider between panes',
  base.editor.w > 0 && base.preview.w > 100 && base.resizer.x > base.editor.x,
  `editor=${base.editor.w}px preview=${base.preview.w}px resizer.x=${base.resizer.x}`);

// 1) collapse with no prior drag (the reported "first press" case)
let btn = await toggleButtonCenter();
await click(btn.x, btn.y);
await sleep(450);
const c1 = await geom();
check('desktop: collapse shrinks preview to a thin strip',
  c1.collapsed && c1.preview.w <= 48 && !c1.iframeVisible,
  `preview.w=${c1.preview.w}px collapsed=${c1.collapsed} iframeVisible=${c1.iframeVisible}`);
check('desktop: collapse frees the space for the editor',
  c1.editor.w >= base.main.w - c1.preview.w - c1.resizer.w - 2,
  `editor.w=${c1.editor.w}px (was ${base.editor.w}px) main.w=${base.main.w}px`);
check('desktop: divider moves right when collapsed',
  c1.resizer.x > base.resizer.x + 100,
  `resizer.x ${base.resizer.x} -> ${c1.resizer.x}`);
check('desktop: collapsed strip keeps an expand affordance',
  /展開/.test(c1.toggleLabel || '') && /chevron-left/.test(c1.toggleIcon || ''),
  `label="${c1.toggleLabel}" icon="${c1.toggleIcon}"`);

// 2) expand by clicking the strip itself (not the button)
let strip = await stripCenter();
await click(strip.x, strip.y);
await sleep(450);
const e1 = await geom();
check('desktop: clicking collapsed strip expands again',
  !e1.collapsed && e1.preview.w > 100 && e1.iframeVisible,
  `collapsed=${e1.collapsed} preview.w=${e1.preview.w}px iframeVisible=${e1.iframeVisible}`);

// 3) drag divider, then collapse -- the reported broken sequence
await dragTo(base.main.x + base.main.w * 0.3, base.main.y + base.main.h / 2);
await sleep(400);
const d1 = await geom();
const draggedPreview = d1.preview.w;
check('desktop: drag sets preview to ~70% width',
  Math.abs(draggedPreview - d1.main.w * 0.7) < 25,
  `preview.w=${draggedPreview}px expected~${Math.round(d1.main.w * 0.7)}px resizer.x=${d1.resizer.x}`);

btn = await toggleButtonCenter();
await click(btn.x, btn.y);
await sleep(450);
const c2 = await geom();
check('desktop: collapse after drag still shrinks preview (no stale inline width)',
  c2.collapsed && c2.preview.w <= 48,
  `preview.w=${draggedPreview}px -> ${c2.preview.w}px`);
check('desktop: divider moves right after drag+collapse',
  c2.resizer.x > d1.resizer.x + 100,
  `resizer.x ${d1.resizer.x} -> ${c2.resizer.x}`);
check('desktop: editor reclaims the released space after drag+collapse',
  c2.editor.w > d1.editor.w + 100,
  `editor.w ${d1.editor.w}px -> ${c2.editor.w}px`);

strip = await stripCenter();
await click(strip.x, strip.y);
await sleep(450);
const e2 = await geom();
check('desktop: expanding restores the dragged split ratio',
  !e2.collapsed && Math.abs(e2.preview.w - draggedPreview) < 25,
  `preview.w=${e2.preview.w}px expected~${draggedPreview}px`);

// 4) dragging while collapsed should reopen the preview
btn = await toggleButtonCenter();
await click(btn.x, btn.y);
await sleep(450);
await dragTo(base.main.x + base.main.w * 0.5, base.main.y + base.main.h / 2);
await sleep(400);
const d2 = await geom();
check('desktop: dragging the divider reopens a collapsed preview',
  !d2.collapsed && d2.preview.w > 100,
  `collapsed=${d2.collapsed} preview.w=${d2.preview.w}px`);

// 5) hide/show preview from the topbar must still give the editor the full width
// The topbar button is found by its eye icon, not by position: adding a button there
// (the runtime settings gear) must not change which control this exercises. The button
// carries no words any more, so the icon is what tells the two states apart.
const topbarBtn = (icon) => `(() => {
  const b = [...document.querySelectorAll('.topbar-right .btn')].find(x => x.querySelector('.mdi-${icon}'));
  if (b) b.click();
  return !!b;
})()`;
await evalJson(cdp, sessionId, topbarBtn('eye-off'));
await sleep(450);
const h1 = await geom();
check('desktop: hiding the preview gives the editor full width',
  // v-show keeps the nodes mounted, so hidden panels measure 0 wide rather than disappearing.
  h1.preview.w === 0 && h1.resizer.w === 0 && h1.editor.w >= h1.main.w - 2,
  `editor.w=${h1.editor.w} main.w=${h1.main.w} preview.w=${h1.preview.w} resizer.w=${h1.resizer.w}`);

await evalJson(cdp, sessionId, topbarBtn('eye'));
await sleep(450);
const h2 = await geom();
check('desktop: showing the preview again restores the split',
  h2.preview.w > 100 && h2.editor.w < h2.main.w,
  `editor.w=${h2.editor.w} preview.w=${h2.preview.w}`);

// ---------------- Mobile / row split ----------------
await setViewport(390, 844, true);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitForApp(cdp, sessionId);
await sleep(500);

const m0 = await geom();
check('mobile: initial stacked layout with horizontal divider',
  m0.resizer.h <= 10 && m0.resizer.w > 300 && m0.preview.h > 100,
  `resizer=${m0.resizer.w}x${m0.resizer.h} preview.h=${m0.preview.h}px`);

btn = await toggleButtonCenter();
await click(btn.x, btn.y);
await sleep(450);
const mc = await geom();
check('mobile: collapse shrinks preview height to a thin strip',
  mc.collapsed && mc.preview.h <= 44 && mc.preview.w >= 380,
  `preview=${mc.preview.w}x${mc.preview.h} collapsed=${mc.collapsed}`);
check('mobile: collapse frees vertical space for the editor',
  mc.editor.h > m0.editor.h + 50,
  `editor.h ${m0.editor.h}px -> ${mc.editor.h}px`);
check('mobile: divider moves down when collapsed',
  mc.resizer.y > m0.resizer.y + 50,
  `resizer.y ${m0.resizer.y} -> ${mc.resizer.y}`);
check('mobile: collapsed strip points up (expand) and is reachable',
  /展開/.test(mc.toggleLabel || '') && /chevron-up/.test(mc.toggleIcon || '') && mc.preview.y + mc.preview.h <= 844,
  `label="${mc.toggleLabel}" icon="${mc.toggleIcon}" bottom=${mc.preview.y + mc.preview.h}`);

strip = await stripCenter();
await click(strip.x, strip.y);
await sleep(450);
const me = await geom();
check('mobile: clicking collapsed strip expands again',
  !me.collapsed && me.preview.h > 100,
  `collapsed=${me.collapsed} preview.h=${me.preview.h}px`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

ws.close();
cleanup();
process.exit(failed.length ? 1 : 0);
