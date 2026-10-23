// Checks the bookmark editor: the link of a bookmark has to be editable next to its
// name, in one dialog, and an empty link must not wipe the bookmark.
//
// The test never saves, so the bookmarks.yaml on disk stays untouched.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-bookmarks');
const chrome = launchChrome({ port: PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId, ws } = await connect(PORT);
const ev = (e) => evalJson(cdp, sessionId, e);

// The editor loads bookmarks.yaml when the page opens. The test has to wait for
// that request, otherwise it would edit a list that is about to be replaced and
// the bookmark it adds would disappear.
let bookmarksLoaded = false;
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Network.responseReceived' &&
      msg.params.response.url.endsWith('/api/bookmarks')) {
    bookmarksLoaded = true;
  }
});

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

// Vue binds v-model to the input event, so setting the value and firing it is the
// same as typing. The click helpers go through the real DOM click so the handlers
// run the way they do for a person using the editor.
const setInput = (selector, value) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.value = ${JSON.stringify(value)};
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);

const click = (selector) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.click();
  return true;
})()`);

const inputValue = (selector) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  return el ? el.value : null;
})()`);

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Network.enable', {}, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
for (let i = 0; i < 100 && !bookmarksLoaded; i++) await sleep(150);
check('the bookmarks are loaded', bookmarksLoaded);
await sleep(400);

// The bookmark tab is the second one.
await click('.tab-bar .tab-btn:nth-child(2)');
const onBookmarkTab = await waitFor(`!!document.querySelector('.editor-toolbar .add-item-btn, .editor-toolbar .btn-primary')`);
check('the bookmark tab opens', onBookmarkTab);
await sleep(400);

// A group to put the bookmark in. One is made when the configuration has none.
if (!(await ev(`!!document.querySelector('.group-card')`))) {
  await click('.editor-toolbar .btn-primary');
  await waitFor(`!!document.querySelector('#bookmark-group-name')`);
  await setInput('#bookmark-group-name', '測試分組');
  await click('.bookmark-group-modal .btn-primary');
  await waitFor(`!!document.querySelector('.group-card')`);
}
check('there is a bookmark group to edit', await ev(`!!document.querySelector('.group-card')`));

// Add a bookmark through the dialog.
await click('.group-card .add-item-btn');
const itemDialog = await waitFor(`!!document.querySelector('#bookmark-href')`);
check('the bookmark dialog has a link field', itemDialog);
check('the bookmark dialog has a name and an abbreviation field',
  await ev(`!!document.querySelector('#bookmark-name') && !!document.querySelector('#bookmark-abbr')`));

await setInput('#bookmark-name', '測試書籤');
await setInput('#bookmark-href', 'https://example.com/one');
await setInput('#bookmark-abbr', 'T1');
await setInput('#bookmark-description', '測試說明');
await setInput('#bookmark-icon', 'mdi-test');
await click('.bookmark-item-modal .btn-primary');
const added = await waitFor(`!!document.querySelector('.item-card .item-name') &&
  [...document.querySelectorAll('.item-card')].some((c) => c.textContent.includes('測試書籤') && c.textContent.includes('測試說明'))`);
check('the bookmark is added with its description', added);

// Edit it: the dialog has to show the link, and the change has to reach the list.
const row = '[...document.querySelectorAll(".item-card")].find((c) => c.textContent.includes("測試書籤"))';
await ev(`(() => { const card = ${row}; card.querySelector('.item-actions .btn:not(.btn-danger)').click(); return true; })()`);
const editDialog = await waitFor(`!!document.querySelector('#bookmark-href')`);
check('the edit dialog opens', editDialog);
check('the dialog shows the current name', await inputValue('#bookmark-name') === '測試書籤',
  String(await inputValue('#bookmark-name')));
check('the dialog shows the current link', await inputValue('#bookmark-href') === 'https://example.com/one',
  String(await inputValue('#bookmark-href')));
check('the dialog shows the description field', await ev(`!!document.querySelector('#bookmark-description')`));
check('the dialog shows the icon field', await ev(`!!document.querySelector('#bookmark-icon')`));

await setInput('#bookmark-href', 'https://example.com/two');
await setInput('#bookmark-description', '');
await click('.bookmark-item-modal .btn-primary');
const changed = await waitFor(`(() => {
  const card = ${row};
  return !!card && card.textContent.includes('https://example.com/two');
})()`);
check('the link can be edited', changed,
  String(await ev(`(() => { const card = ${row}; return card ? card.textContent.replace(/\\s+/g, ' ').trim() : 'no row'; })()`)));

// An empty link must not be written; the dialog stays open and says why.
await ev(`(() => { const card = ${row}; card.querySelector('.item-actions .btn:not(.btn-danger)').click(); return true; })()`);
await waitFor(`!!document.querySelector('#bookmark-href')`);
await setInput('#bookmark-href', '');
await click('.bookmark-item-modal .btn-primary');
await sleep(300);
check('an empty link keeps the dialog open', await ev(`!!document.querySelector('#bookmark-href')`));
check('the empty link is refused with a message', await ev(`!!document.querySelector('.toast')`),
  String(await ev(`(() => { const el = document.querySelector('.toast'); return el ? el.textContent.trim() : ''; })()`)));
await click('.bookmark-item-modal .btn-secondary');
await sleep(200);
check('the link is still there after the dialog is cancelled',
  await ev(`(() => { const card = ${row}; return !!card && card.textContent.includes('https://example.com/two'); })()`));

// The group is renamed in its own dialog.
await ev(`(() => { document.querySelector('.group-header .group-actions .btn:not(.btn-danger)').click(); return true; })()`);
const groupDialog = await waitFor(`!!document.querySelector('#bookmark-group-name')`);
check('the group dialog opens', groupDialog);
const groupName = await inputValue('#bookmark-group-name');
check('the group dialog shows the current name', !!groupName, String(groupName));
await setInput('#bookmark-group-name', '測試分組改名');
await click('.bookmark-group-modal .btn-primary');
const renamed = await waitFor(`!!document.querySelector('.group-card .group-name') &&
  document.querySelector('.group-card .group-name').textContent.trim() === '測試分組改名'`);
check('the group can be renamed', renamed,
  String(await ev(`(() => { const el = document.querySelector('.group-card .group-name'); return el ? el.textContent.trim() : ''; })()`)));

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
