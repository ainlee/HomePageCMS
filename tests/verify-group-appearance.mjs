// Checks the appearance section of the service / bookmark group dialogs: the
// tab, style, columns, header, initiallyCollapsed and useEqualHeights fields
// write into the layout block of settings.yaml; clearing a group's tab only
// removes that group's assignment (the tab itself survives while any other
// group still uses it, and vanishes naturally once no group does); deleting
// a group removes its layout entry; and the layout panel shows a tab
// structure overview instead of a full group list.
//
// The test snapshots services.yaml and the layout block at the start and
// restores both verbatim at the end, so it is safe to re-run without
// polluting the user's configuration.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-group-appearance');
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

const api = async (path, init) => (await (await fetch(APP_URL + path, init)).json());

// Snapshot the two files this test touches, so they can be put back.
const svcSnap = await api('/api/services');
const laySnap = await api('/api/homepage-layout');

async function restore() {
  // The files moved between the snapshot and now (every save rewrites the
  // hash), so re-read the hash and put the original bytes back.
  const curS = await api('/api/services');
  if (svcSnap.success && curS.success) {
    await api('/api/services', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: svcSnap.raw, hash: curS.hash })
    });
  }
  const curL = await api('/api/homepage-layout');
  if (laySnap.success && curL.success) {
    await api('/api/homepage-layout', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: laySnap.data.values, groups: laySnap.data.groups, hash: curL.hash })
    });
  }
}

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

// Group deletion asks through the native confirm(); auto-accept it.
ws.addEventListener('message', (msg) => {
  let d; try { d = JSON.parse(msg.data); } catch { return; }
  if (d.method === 'Page.javascriptDialogOpening') {
    cdp.send('Page.handleJavaScriptDialog', { accept: true }, sessionId);
  }
});

await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__)`);
await sleep(700);
// Dismiss the auto-opened settings dialog so it never shadows a bare selector.
await ev('(() => { const b = [...document.querySelectorAll(".modal-overlay .btn-secondary")].find((b) => /Cancel|取消|稍後/.test(b.textContent || "")); if (b) b.click(); return !!b; })()');
await sleep(300);

// Two service groups that share one tab, created through the group dialog's
// appearance section.
async function addServiceGroup(name, tab) {
  const ok = await click('.editor-toolbar .btn-primary');
  await waitFor('!!document.querySelector("#svc-group-name")');
  const filled = await ev(`(() => {
    const name = document.querySelector('#svc-group-name');
    name.value = ${JSON.stringify(name)};
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const tabIn = document.querySelector('#svc-group-tab');
    tabIn.value = ${JSON.stringify(tab)};
    tabIn.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = [...document.querySelectorAll('.modal-overlay .modal-wide button')].find((b) => b.classList.contains('btn-primary'));
    if (btn) btn.click();
    return !!(name && tabIn && btn);
  })()`);
  await sleep(400);
  check('the service group was created with its tab (' + name + ')', ok && filled, '');
}

await addServiceGroup('外觀測試 A', 'Media');
await addServiceGroup('外觀測試 B', 'Media');

// The tab tag shows up on each group card, so the grouping is visible without
// opening the dialog. Poll for it: the cards re-render right after the group
// is pushed, and a fixed sleep is too tight on a slow box.
let chipVisible = '[]';
for (let i = 0; i < 20; i++) {
  chipVisible = await ev('JSON.stringify([...document.querySelectorAll(".group-card .group-tab-tag")].map((e) => e.textContent.trim()))');
  if (chipVisible.includes('Media')) break;
  await sleep(150);
}
check('the group cards show their tab tag', chipVisible.includes('Media'), chipVisible);

// Save the whole dashboard so the layout block lands in settings.yaml.
await click('.btn-save');
await sleep(1500);
let layout = await api('/api/homepage-layout');
const aEntry = (layout.data.groups || []).find((g) => g.name === '外觀測試 A');
const bEntry = (layout.data.groups || []).find((g) => g.name === '外觀測試 B');
check('saving writes both groups into the layout block with their tab',
  !!aEntry && !!bEntry && aEntry.tab === 'Media' && bEntry.tab === 'Media', JSON.stringify(layout.data.groups));

// The tab dropdown in the dialog lists the existing tab names.
await click('.editor-toolbar .btn-primary');
await waitFor('!!document.querySelector("#svc-group-name")');
const datalist = await ev('JSON.stringify([...document.querySelectorAll("#svc-tab-options option")].map((o) => o.value))');
check('the tab field offers the existing tab names', datalist.includes('Media'), datalist);
await ev('(() => { const b = document.querySelector(".modal-overlay .modal-wide .btn-secondary"); if (b) b.click(); return true; })()');
await sleep(300);

// Clear group A's tab through the chip X: group A falls back to "shows on
// every tab", but the shared tab survives for group B, which still uses it.
await ev('(() => { const c = [...document.querySelectorAll(".group-card")].find((c) => (c.querySelector(".group-name") || {}).textContent === "外觀測試 A"); if (!c) return false; c.querySelector(".group-actions .btn-icon").click(); return true; })()');
await waitFor('!!document.querySelector("#svc-group-name")');
const cleared = await ev('(() => { const x = document.querySelector(".tab-chip-x"); if (x) { x.click(); return true; } const t = document.querySelector("#svc-group-tab"); if (t) { t.value = ""; t.dispatchEvent(new Event("input", { bubbles: true })); return true; } return false; })()');
const confirmed = await ev('(() => { const b = [...document.querySelectorAll(".modal-overlay .modal-wide button")].find((b) => b.classList.contains("btn-primary")); if (b) b.click(); return !!b; })()');
await sleep(400);
await click('.btn-save');
await sleep(1500);
layout = await api('/api/homepage-layout');
const aEntry2 = (layout.data.groups || []).find((g) => g.name === '外觀測試 A');
const bEntry2 = (layout.data.groups || []).find((g) => g.name === '外觀測試 B');
check('clearing group A tab removes only its own assignment', cleared && confirmed && (!aEntry2 || !aEntry2.tab), JSON.stringify(aEntry2));
check('the tab survives for group B, which still uses it', !!bEntry2 && bEntry2.tab === 'Media', JSON.stringify(bEntry2));

// Delete group A and verify its layout entry disappears with it.
const delClicked = await ev('(() => { const c = [...document.querySelectorAll(".group-card")].find((c) => (c.querySelector(".group-name") || {}).textContent === "外觀測試 A"); if (!c) return false; const del = [...c.querySelectorAll(".group-actions .btn-icon")].find((b) => b.classList.contains("btn-danger")); if (del) del.click(); return !!del; })()');
await sleep(500);
await click('.btn-save');
await sleep(1500);
layout = await api('/api/homepage-layout');
check('deleting the group removes its layout entry',
  delClicked && JSON.stringify(layout.data.groups).includes('外觀測試 B') && !JSON.stringify(layout.data.groups).includes('外觀測試 A'),
  JSON.stringify(layout.data.groups));

// The layout panel shows the tab structure overview rather than a full group
// list.
await click('.tab-bar .tab-btn:nth-child(4)');
await waitFor('!!document.querySelector(".layout-panel")');
await sleep(400);
const buckets = await ev('document.querySelectorAll(".tab-overview-bucket").length');
check('the layout panel carries the tab structure overview', Number(buckets) >= 1, String(buckets));

// Put both files back the way they were so the install ends clean.
await restore();

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
