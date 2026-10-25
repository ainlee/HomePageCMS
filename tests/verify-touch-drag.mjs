// Checks that the shared drag engine works with a finger: the card lifts once
// the finger has travelled a short distance, the drop indicator follows, and a
// tap that never moves does not start a drag.
//
// Runs in a phone-sized viewport with CDP touch events, so it exercises the
// same pointer pipeline a phone goes through.
//
// The test never saves, so the YAML on disk stays untouched.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-touch-drag');
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

const setInput = (selector, value) => ev('(() => {' +
  '  const el = document.querySelector(' + JSON.stringify(selector) + ');' +
  '  if (!el) return false;' +
  '  el.value = ' + JSON.stringify(value) + ';' +
  "  el.dispatchEvent(new Event('input', { bubbles: true }));" +
  '  return true;' +
'})()');

const click = (selector) => ev('(() => {' +
  '  const el = document.querySelector(' + JSON.stringify(selector) + ');' +
  '  if (!el) return false;' +
  '  el.click();' +
  '  return true;' +
'})()');

const groupCard = (name) =>
  "[...document.querySelectorAll('.group-card')].find((c) => c.querySelector('.group-name').textContent.trim() === " + JSON.stringify(name) + ")";
const itemCard = (name) =>
  "[...document.querySelectorAll('.item-card')].find((c) => c.querySelector('.item-name').textContent.trim() === " + JSON.stringify(name) + ")";

const groupOrder = async (name) =>
  JSON.parse(await ev('(() => { const card = ' + groupCard(name) +
  '; return card ? JSON.stringify([...card.querySelectorAll(".item-card .item-name")].map((el) => el.textContent.trim())) : "[]"; })()'));

const ensureGroup = async (name) => {
  if (await ev('!!(' + groupCard(name) + ')')) return true;
  await click('.editor-toolbar .btn-primary');
  await waitFor('!!document.querySelector("#bookmark-group-name")');
  await setInput('#bookmark-group-name', name);
  await click('.bookmark-group-modal .btn-primary');
  await waitFor('!!(' + groupCard(name) + ')');
  return !!await ev('!!(' + groupCard(name) + ')');
};

const addBookmark = async (groupName, name, href) => {
  await ev('(() => { const card = ' + groupCard(groupName) +
    '; card && card.querySelector(".add-item-btn").click(); return true; })()');
  await waitFor('!!document.querySelector("#bookmark-name")');
  await setInput('#bookmark-name', name);
  await setInput('#bookmark-href', href);
  await click('.bookmark-item-modal .btn-primary');
  await sleep(300);
};

// Bring the start item into view, then read both the start handle and the
// target card in one eval so the two coordinates are consistent.
const twoBoxes = async (startName, targetName) => {
  await ev('(() => { const card = ' + itemCard(startName) +
    '; card && card.scrollIntoView({ block: "center" }); return true; })()');
  await sleep(300);
  return JSON.parse(await ev('(() => { const s = ' + itemCard(startName) +
    '; const t = ' + itemCard(targetName) + ';' +
    '  if (!s || !t) return JSON.stringify({ s: null, t: null });' +
    '  const sh = s.querySelector(".item-drag").getBoundingClientRect();' +
    '  const tr = t.getBoundingClientRect();' +
    '  return JSON.stringify({ s: { x: sh.x + sh.width / 2, y: sh.y + sh.height / 2 },' +
    '    t: { x: tr.x + tr.width / 2, y: tr.y + tr.height / 2 } }); })()'));
};

// A single-finger gesture through the CDP touch API.
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
}, sessionId);

const dragFromTo = async (from, to, steps = 12) => {
  await touch('touchStart', from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  }
};

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
await cdp.send('Network.enable', {}, sessionId);

let bookmarksLoaded = false;
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Network.responseReceived' &&
      msg.params.response.url.endsWith('/api/bookmarks')) {
    bookmarksLoaded = true;
  }
});
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor('!!(document.querySelector("#app") && document.querySelector("#app").__vue_app__)');
for (let i = 0; i < 100 && !bookmarksLoaded; i++) await sleep(150);
check('the bookmarks are loaded', bookmarksLoaded);

// A first-run editor opens the setup dialog over everything; skip it so it
// does not swallow the touch events.
await ev('(() => { const sel = document.querySelector("#locale-select"); if (!sel) return true; const btn = sel.closest(".modal-overlay").querySelector(".modal-actions .btn-secondary"); btn && btn.click(); return true; })()');
await sleep(300);

await click('.tab-bar .tab-btn:nth-child(2)');
await sleep(400);
check('the bookmark tab is showing',
  await ev('[...document.querySelectorAll(".tab-btn")][1].classList.contains("active")'));

check('there is a group to order in', await ensureGroup('觸控排序組'));
check('there is a group to move into', await ensureGroup('觸控目標組'));

await addBookmark('觸控排序組', '甲', 'https://example.com/jia');
await addBookmark('觸控排序組', '乙', 'https://example.com/yi');
await addBookmark('觸控排序組', '丙', 'https://example.com/bing');
await addBookmark('觸控目標組', '丁', 'https://example.com/ding');
check('three bookmarks were added to the first group',
  (await groupOrder('觸控排序組')).join(',') === '甲,乙,丙',
  String(await groupOrder('觸控排序組')));

// A tap that never travels enough does not start a drag.
const tap = await twoBoxes('乙', '乙');
await dragFromTo(tap.s, { x: tap.s.x + 2, y: tap.s.y + 2 }, 3);
await sleep(150);
check('a tap does not lift the card', await ev('!document.querySelector(".drag-ghost")'));
await touch('touchEnd');
await sleep(150);
check('a tap leaves the order alone',
  (await groupOrder('觸控排序組')).join(',') === '甲,乙,丙',
  String(await groupOrder('觸控排序組')));

// Drag within the group: lift 乙 up over 甲, so the order becomes 乙,甲,丙.
const w = await twoBoxes('乙', '甲');
await dragFromTo(w.s, { x: w.t.x, y: w.t.y - 20 });
check('the dragged card is marked while moving',
  await ev('[...document.querySelectorAll(".item-card")].some((c) => c.classList.contains("is-dragging"))'));
check('a drop indicator points at the landing spot',
  await ev('!!document.querySelector(".drop-target, .drop-indicator")'));
await touch('touchEnd');
await sleep(300);
check('the touch drag reorders the group',
  (await groupOrder('觸控排序組')).join(',') === '乙,甲,丙',
  String(await groupOrder('觸控排序組')));

// Drag across groups: move 丙 up into the target group, above 丁.
const x = await twoBoxes('丙', '丁');
await dragFromTo(x.s, { x: x.t.x, y: x.t.y - 20 });
await sleep(150);
await touch('touchEnd');
await sleep(300);
check('the source group lost the dragged bookmark',
  (await groupOrder('觸控排序組')).join(',') === '乙,甲',
  String(await groupOrder('觸控排序組')));
check('the dragged bookmark joined the target group',
  (await groupOrder('觸控目標組')).join(',') === '丙,丁',
  String(await groupOrder('觸控目標組')));

check('no drag ghost is left behind',
  await ev('!document.querySelector(".drag-ghost")'));

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');

