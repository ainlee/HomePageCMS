// Checks that the bookmark tab offers the same experience as the services tab:
// move-up / move-down buttons, the move-to-group dialog, and the shared drag
// engine with its drop indicator.
//
// The test never saves, so the bookmarks.yaml on disk stays untouched.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-bookmark-xp');
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

// Set an input the way typing does: Vue binds v-model to the input event.
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

// Find a group card or an item card by its visible name, so the test works
// next to the groups the user already has.
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

const addBookmark = async (groupName, name, abbr, href) => {
  await ev('(() => { const card = ' + groupCard(groupName) +
    '; card && card.querySelector(".add-item-btn").click(); return true; })()');
  await waitFor('!!document.querySelector("#bookmark-name")');
  await setInput('#bookmark-name', name);
  await setInput('#bookmark-href', href);
  if (abbr) await setInput('#bookmark-abbr', abbr);
  await click('.bookmark-item-modal .btn-primary');
  await sleep(300);
};

const clickItemButton = (itemName, icon) => ev('(() => {' +
  "  const card = " + itemCard(itemName) + ";" +
  "  if (!card) return false;" +
  "  const btn = [...card.querySelectorAll('.item-actions .btn')].find((b) => b.querySelector('.mdi-" + icon + "'));" +
  "  if (!btn) return false;" +
  "  btn.click();" +
  "  return true;" +
'})()');

const itemButtonDisabled = (itemName, icon) => ev('(() => {' +
  "  const card = " + itemCard(itemName) + ";" +
  "  if (!card) return null;" +
  "  const btn = [...card.querySelectorAll('.item-actions .btn')].find((b) => b.querySelector('.mdi-" + icon + "'));" +
  "  return btn ? btn.disabled : null;" +
'})()');

const press = (x, y) => cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
const move = (x, y) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }, sessionId);
const release = (x, y) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }, sessionId);

const dragHandleBox = (name) => ev('(() => { const card = ' + itemCard(name) +
  '; if (!card) return null; const r = card.querySelector(".item-drag").getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()');
const itemBox = (name) => ev('(() => { const card = ' + itemCard(name) +
  '; if (!card) return null; const r = card.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()');

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Network.enable', {}, sessionId);

// The editor loads bookmarks.yaml on open; wait for it before editing so the
// list is not about to be replaced.
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

// The bookmark tab is the second one.
await click('.tab-bar .tab-btn:nth-child(2)');
await sleep(400);
check('the bookmark tab shows its group cards',
  await ev("!!document.querySelector('.group-card[data-group-id]')"));

// A first-run editor opens the setup dialog over everything; its overlay would
// swallow the real mouse events the drag checks use. Skip the setup when it is
// in the way.
await ev('(() => { const sel = document.querySelector("#locale-select"); if (!sel) return true; const btn = sel.closest(".modal-overlay").querySelector(".modal-actions .btn-secondary"); btn && btn.click(); return true; })()');
await sleep(300);
check('the setup dialog does not cover the editor',
  await ev('(() => { const sel = document.querySelector("#locale-select"); return !sel || !sel.closest(".modal-overlay"); })()'));

check('there is a group to order in', await ensureGroup('測試排序組'));
check('there is a group to move into', await ensureGroup('測試目標組'));

await addBookmark('測試排序組', '甲', 'J', 'https://example.com/jia');
await addBookmark('測試排序組', '乙', 'Y', 'https://example.com/yi');
await addBookmark('測試排序組', '丙', 'B', 'https://example.com/bing');
check('three bookmarks were added',
  (await groupOrder('測試排序組')).join(',') === '甲,乙,丙',
  String(await groupOrder('測試排序組')));

// Move up / down, the same buttons the services tab carries.
await clickItemButton('乙', 'arrow-up');
check('the move-up button reorders the list',
  (await groupOrder('測試排序組')).join(',') === '乙,甲,丙',
  String(await groupOrder('測試排序組')));
check('the move-up button of the first item is disabled',
  await itemButtonDisabled('乙', 'arrow-up'));
await clickItemButton('甲', 'arrow-down');
check('the move-down button reorders the list',
  (await groupOrder('測試排序組')).join(',') === '乙,丙,甲',
  String(await groupOrder('測試排序組')));
check('the move-down button of the last item is disabled',
  await itemButtonDisabled('甲', 'arrow-down'));

// Move to another group, guided by the dialog.
await clickItemButton('乙', 'arrow-right-bold-circle');
await waitFor("!!document.querySelector('.move-targets')");
const moveTargets = JSON.parse(await ev("JSON.stringify([...document.querySelectorAll('.move-targets .btn-move')].map((b) => b.textContent.trim()))"));
const bookmarkGroupCount = JSON.parse(await ev("JSON.stringify(document.querySelectorAll('.group-card').length)"));
check('the move dialog lists the bookmark groups',
  moveTargets.includes('測試目標組') && moveTargets.includes('測試排序組'),
  String(moveTargets));
check('the move dialog lists only the groups of this tab',
  moveTargets.length === bookmarkGroupCount,
  'targets=' + moveTargets.length + ' groups=' + bookmarkGroupCount);
await ev("(() => { const btn = [...document.querySelectorAll('.move-targets .btn-move')].find((b) => b.textContent.includes('測試目標組')); btn && btn.click(); return true; })()");
check('the move dialog closes after the move',
  await waitFor("!document.querySelector('.move-targets')"));
check('the bookmark left its group',
  (await groupOrder('測試排序組')).join(',') === '丙,甲',
  String(await groupOrder('測試排序組')));
check('the bookmark joined the target group',
  (await groupOrder('測試目標組')).join(',') === '乙',
  String(await groupOrder('測試目標組')));

// Drag: the shared engine has to work on this tab too.
await addBookmark('測試目標組', '丁', 'D', 'https://example.com/ding');
check('two bookmarks in the target group',
  (await groupOrder('測試目標組')).join(',') === '乙,丁',
  String(await groupOrder('測試目標組')));

await ev("(() => { const card = " + itemCard('丁') + "; card && card.scrollIntoView({ block: 'center' }); return true; })()");
await sleep(300);
const from = JSON.parse(await dragHandleBox('丁'));
const toRaw = JSON.parse(await itemBox('甲'));
const to = { x: toRaw.x, y: toRaw.y + 8 };

await press(from.x, from.y);
for (let i = 1; i <= 12; i++) {
  await move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
}
check('the dragging card is marked',
  await ev("!!document.querySelector('.item-card.is-dragging')"));
check('a drop indicator points at the landing spot',
  await ev("!!document.querySelector('.drop-indicator, .drop-target')"));
check('the group under the cursor is highlighted',
  await ev("!!document.querySelector('.group-card.drag-over')"));
await release(to.x, to.y);
await sleep(300);
check('the drag ghost is gone after release',
  await ev("!document.querySelector('.drag-ghost')"));
check('the dragged bookmark joined the other group',
  (await groupOrder('測試排序組')).join(',') === '丙,甲,丁',
  String(await groupOrder('測試排序組')));
check('the source group lost the bookmark',
  (await groupOrder('測試目標組')).join(',') === '乙',
  String(await groupOrder('測試目標組')));

// The services tab still carries the same affordances, and switching tabs
// clears the drag indicator.
await click('.tab-bar .tab-btn:nth-child(1)');
await sleep(400);
check('the services tab keeps its move buttons',
  await ev("[...document.querySelectorAll('.item-card .item-actions .btn')].some((b) => b.querySelector('.mdi-arrow-up'))"));
check('switching tabs clears the drag indicator',
  await ev("!document.querySelector('.drop-indicator, .drop-target, .drag-ghost')"));

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');

