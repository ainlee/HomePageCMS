// Inheritance hints and range guards that make Homepage's
// "unset means inherit the global" behaviour visible. Every assertion is
// written against structure (option counts, disabled state, hint presence,
// value round-trips) rather than the words of one language pack, so it
// passes in any of the four built-in locales.
//
// - group dialog: an unset style says it behaves like columns, the columns
//   field is locked outside the row style, the header is a binary switch,
//   the tristate fields hint what an unset value inherits, and the tab
//   field hints "shows on every tab" while another group carries a tab.
// - item dialog: showStats is a two-choice field, the fields carry
//   inheritance hints, and the weight placeholder carries the default note.
// - layout panel: a group row renders the effective style summary and an
//   override mark; an out-of-range maxGroupColumns is blocked by the API
//   (answered with the translated error, value not written), is marked in
//   the form when loaded, is dropped by a panel save, and an in-range value
//   still writes.
//
// Snapshots both files it touches and restores them at the end.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-inheritance-hints');
const chrome = launchChrome({ port: PORT, profile: PROFILE });
const cleanup = trackChrome(chrome, PROFILE);
const { cdp, sessionId, ws } = await connect(PORT);
const ev = (e) => evalJson(cdp, sessionId, e);

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) { passed++; console.log('PASS  ' + name + (detail ? '  ' + detail : '')); }
  else { failures.push(name); console.log('FAIL  ' + name + (detail ? '  ' + detail : '')); }
}

async function waitFor(expression, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if (await ev(expression)) return true;
    await sleep(150);
  }
  return false;
}

const click = (selector) => ev('(() => { const el = document.querySelector(' + JSON.stringify(selector) + '); if (!el) return false; el.click(); return true; })()');

const api = async (path, init) => (await (await fetch(APP_URL + path, init)).json());

// The two files the UI saves, snapshotted so the test ends where it began.
const svcSnap = await api('/api/services');
const laySnap = await api('/api/homepage-layout');

async function restore() {
  const curS = await api('/api/services');
  if (svcSnap.success && curS.success) {
    await api('/api/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: svcSnap.raw, hash: curS.hash }) });
  }
  const curL = await api('/api/homepage-layout');
  if (laySnap.success && curL.success) {
    await api('/api/homepage-layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: laySnap.data.values, groups: laySnap.data.groups, hash: curL.hash }) });
  }
}

// A thrown assertion or a rejected promise must not leave the user's files
// changed: the restore above only runs on the normal path, and a crashed run
// that kept its groups (and the global switch it flipped) breaks the next test
// in the chain. Any unhandled failure restores first, then exits non-zero.
for (const event of ['uncaughtException', 'unhandledRejection']) {
  process.on(event, async (err) => {
    try { await restore(); } catch {}
    try { ws.close(); chrome.kill(); cleanup(); } catch {}
    console.error(err);
    process.exit(1);
  });
}

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

// Group deletion confirms through the native confirm(): auto-accept.
ws.addEventListener('message', (msg) => {
  let d; try { d = JSON.parse(msg.data); } catch { return; }
  if (d.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }, sessionId);
});

await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor('!!(document.querySelector("#app") && document.querySelector("#app").__vue_app__)');
await sleep(800);
// Dismiss the auto-opened settings dialog so it never shadows a bare selector.
await ev('(() => { const b = [...document.querySelectorAll(".modal-overlay .btn-secondary")].find((b) => b.textContent.trim().length < 20); if (b) b.click(); return !!b; })()');
await sleep(300);

// Two service groups that share a tab, so the tab hint has an "other group"
// to point at regardless of the user's existing configuration.
async function addServiceGroup(name, tab) {
  await click('.editor-toolbar .btn-primary');
  await waitFor('!!document.querySelector("#svc-group-name")');
  const expr = '(() => {'
    + ' const n = document.querySelector("#svc-group-name");'
    + ' n.value = ' + JSON.stringify(name) + ';'
    + ' n.dispatchEvent(new Event("input", { bubbles: true }));'
    + ' const t = document.querySelector("#svc-group-tab");'
    + ' t.value = ' + JSON.stringify(tab) + ';'
    + ' t.dispatchEvent(new Event("input", { bubbles: true }));'
    + ' const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-folder-edit");'
    + ' if (m) m.closest(".modal").querySelector("button.btn-primary").click();'
    + ' return !!(n && t && m);'
    + ' })()';
  await ev(expr);
  await sleep(400);
}

await addServiceGroup('繼承群 A', 'Media');
await addServiceGroup('繼承群 B', 'Media');

// Open group A's dialog and inspect its layout fields.
const openCardByName = (nm) => ev('(() => { const c = [...document.querySelectorAll(".group-card")].find((c) => (c.querySelector(".group-name") || {}).textContent === ' + JSON.stringify(nm) + '); if (c) c.querySelector(".group-actions .btn-icon").click(); return !!c; })()');
await openCardByName('繼承群 A');
await waitFor('!!document.querySelector("#svc-group-name")');

// An unset style is the columns style, said on the option itself.
const styleOpts = await ev('JSON.stringify([...document.querySelectorAll("#svc-group-style option")].map((o) => [o.value, o.textContent.trim()]))');
check('the style select says an unset style behaves like columns',
  JSON.parse(styleOpts)[0][0] === '' && /columns/i.test(JSON.parse(styleOpts)[0][1]), styleOpts);

// The columns field is locked outside the row style, with the reason next to
// the label; switching to row unlocks it.
check('the columns field is disabled outside the row style', await ev('document.querySelector("#svc-group-columns").disabled'));
const rowHint = await ev('JSON.stringify((document.querySelector("#svc-group-columns").closest(".form-group").querySelector(".label-hint") || {}).textContent)');
check('the locked field says it is row-only', /row/i.test(JSON.parse(rowHint)), rowHint);
await ev('(() => { const sel = document.querySelector("#svc-group-style"); sel.value = "row"; sel.dispatchEvent(new Event("change", { bubbles: true })); return !!sel; })()');
await sleep(150);
check('the columns field unlocks for the row style', await ev('!document.querySelector("#svc-group-columns").disabled'));

// Back to the unset style, so the card summary below reads columns.
await ev('(() => { const sel = document.querySelector("#svc-group-style"); sel.value = ""; sel.dispatchEvent(new Event("change", { bubbles: true })); return !!sel; })()');
await sleep(150);

// The header is a binary switch: the dialog has exactly one two-choice
// select (the header) next to three three-choice selects (style, collapse,
// equal heights).
const svcSelects = '(() => { const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-folder-edit"); return m ? [...m.closest(".modal").querySelectorAll(".form-group select")].map((s) => s.options.length) : []; })()';
const svcHeaderSel = JSON.parse(await ev('JSON.stringify(' + svcSelects + ')'));
check('the header field is the dialog only two-choice select',
  svcHeaderSel.filter((n) => n === 2).length === 1 && svcHeaderSel.filter((n) => n === 3).length === 3, JSON.stringify(svcHeaderSel));

// The tristate fields hint what an unset value inherits (the default
// direction while the global is unset), so an empty field is never a blind
// spot; the row-only note counts as a hint too.
const hintExpr = '(() => { const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-folder-edit"); return m ? [...m.closest(".modal").querySelectorAll(".form-group label .label-hint")].map((h) => h.textContent.trim()) : []; })()';
const tristateHints = JSON.parse(await ev('JSON.stringify(' + hintExpr + ')'));
check('the group fields carry visible hints', tristateHints.filter((h) => h.length > 0).length >= 2, JSON.stringify(tristateHints));

// Group B carries the tab, so clearing A tab in the dialog must show the
// every-tab hint (the hint keys off the field being edited).
await ev('(() => { const t = document.querySelector("#svc-group-tab"); t.value = ""; t.dispatchEvent(new Event("input", { bubbles: true })); return !!t; })()');
await sleep(150);
const tabHint = await ev('JSON.stringify((document.querySelector("#svc-group-tab").closest(".form-group").querySelector(".label-hint") || {}).textContent)');
check('an untabbed group hints it shows on every tab', tabHint.trim().length > 0, tabHint);

// Close the dialog without saving, then check the card summary.
await ev('(() => { const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-folder-edit"); if (m) m.closest(".modal").querySelector("button.btn-secondary").click(); return !!m; })()');
await sleep(300);
const cardSummary = await ev('JSON.stringify([...document.querySelectorAll(".group-card .group-layout-tag")].map((e) => e.textContent.trim()))');
check('the group cards render the effective style summary',
  JSON.parse(cardSummary).some((t) => /columns/.test(t) && !/×/.test(t)), cardSummary);

// ---- Layout panel: orphan row summary, override mark, range guard.
await click('.tab-bar .tab-btn:nth-child(4)');
await waitFor('!!document.querySelector(".layout-panel")');
await sleep(500);

// An unbound layout group with no style: the row still shows the effective
// style, so an empty style never reads as "nothing".
await click('.layout-section-head .btn');
await waitFor('!!document.querySelector("#layout-group-name")');
await ev('(() => { const n = document.querySelector("#layout-group-name"); n.value = "繼承群 C"; n.dispatchEvent(new Event("input", { bubbles: true })); const b = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-view-grid-edit"); if (b) b.closest(".modal").querySelector("button.btn-primary").click(); return !!(n && b); })()');
await sleep(500);
const rowSummary = await ev('JSON.stringify([...document.querySelectorAll(".layout-group-row .layout-group-tag")].map((e) => e.textContent.trim()))');
check('the layout rows show the effective style summary',
  JSON.parse(rowSummary).some((t) => /columns/.test(t) && !/×/.test(t)), rowSummary);

// Global initially-collapsed on, group C explicitly not: the row carries the
// override mark, so the disagreement is visible without opening the dialog.
let lay = await api('/api/homepage-layout');
await api('/api/homepage-layout', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    values: Object.assign({}, lay.data.values, { groupsInitiallyCollapsed: 'true' }),
    groups: lay.data.groups.concat([{ name: '繼承群 C', initiallyCollapsed: 'false', source: {} }]),
    hash: lay.hash
  })
});
await click('.layout-head .btn-icon');
await sleep(600);
// The panel reloaded with the group C entry and the global switch: the row
// must carry the override mark next to its style summary.
const cMark = await ev('JSON.stringify([...document.querySelectorAll(".layout-group-row")].filter((r) => (r.querySelector(".layout-group-name") || {}).textContent === "繼承群 C").map((r) => !!r.querySelector(".layout-override-mark")))');
check('a group that overrides the global carries the mark on its row', JSON.parse(cMark).some(Boolean), cMark);

// The range guard at API level: an out-of-range value is not written, and the
// save still succeeds, answering with the (translated) range error that names
// the dropped keys.
lay = await api('/api/homepage-layout');
const rangePut = await api('/api/homepage-layout', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ values: Object.assign({}, lay.data.values, { maxGroupColumns: '3' }), groups: lay.data.groups, hash: lay.hash })
});
check('an out-of-range save answers with the range error',
  rangePut.success === true && typeof rangePut.error === 'string' && rangePut.error.indexOf('maxGroupColumns') >= 0,
  JSON.stringify(rangePut.error));
lay = await api('/api/homepage-layout');
check('the out-of-range value is not in the file', lay.data.values.maxGroupColumns === '', JSON.stringify(lay.data.values.maxGroupColumns));

// The range guard on load: seed an out-of-range value straight into the file
// (the API refuses to write one, so the seed goes through the filesystem),
// reload the panel, and the form must mark it.
const layPath = lay.data.path;
const rawSettings = fs.readFileSync(layPath, 'utf8');
const headerLines = rawSettings.split('\n').filter((l) => l.trim() === '' || l.trim() === '---' || l.trim().startsWith('#')).join('\n');
const seeded = Object.assign({}, yaml.load(rawSettings) || {}, { maxGroupColumns: 10 });
fs.writeFileSync(layPath, headerLines + '\n' + yaml.dump(seeded));
await click('.layout-head .btn-icon');
await sleep(600);
const rangeMark = await ev('document.querySelectorAll(".layout-grid .form-group .label-danger").length');
check('a loaded out-of-range value is marked in the form', Number(rangeMark) >= 1, String(rangeMark));

// A panel save drops the stale out-of-range value: make the panel dirty by
// typing an in-range value into the sibling field, save, and the out-of-range
// value must be gone from the file while the in-range one lands.
const typed = await ev('(() => { const inputs = [...document.querySelectorAll(".layout-grid .form-group input")].filter((i) => i.placeholder === "5-8"); if (inputs.length < 2) return false; const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; d.call(inputs[1], "7"); inputs[1].dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
await sleep(300);
check('the sibling in-range field was typed', typed === true, String(typed));
await click('.layout-head .btn-primary');
await sleep(1500);
lay = await api('/api/homepage-layout');
check('a panel save drops the out-of-range value and keeps the in-range one',
  lay.data.values.maxGroupColumns === '' && lay.data.values.maxBookmarkGroupColumns === '7',
  JSON.stringify({ a: lay.data.values.maxGroupColumns, b: lay.data.values.maxBookmarkGroupColumns }));

// An in-range value still writes through the same guard.
const okPut = await api('/api/homepage-layout', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ values: Object.assign({}, lay.data.values, { maxGroupColumns: '6' }), groups: lay.data.groups, hash: lay.hash })
});
const afterOk = await api('/api/homepage-layout');
check('an in-range value still writes',
  okPut.success && !okPut.error && afterOk.data.values.maxGroupColumns === '6',
  JSON.stringify({ err: okPut.error, v: afterOk.data.values.maxGroupColumns }));

// ---- The item dialog: two-choice showStats, inheritance hints, weight note.
await click('.tab-bar .tab-btn:nth-child(1)');
await sleep(400);
await ev('(() => { const c = [...document.querySelectorAll(".group-card")].find((c) => (c.querySelector(".group-name") || {}).textContent === "繼承群 A"); if (c) { const b = c.querySelector(".add-item-btn"); if (b) b.click(); } return false; })()');
await waitFor('!!document.querySelector(".modal-overlay .modal-wide h2 i.mdi-pencil-circle")');
const itemSelects = JSON.parse(await ev('JSON.stringify((function() { const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-pencil-circle"); if (!m) return []; return [...m.closest(".modal").querySelectorAll(".form-group select")].map((s) => [s.options.length, [...s.options].map((o) => o.value)]); })())'));
// showStats is the select offering an empty value and an explicit "false":
// "follows global" or "explicitly off", with no "true" choice (a per-item
// true behaves like unset upstream).
check('showStats is a two-choice follow-or-off field',
  itemSelects.some((s) => s[0] === 2 && s[1][0] === '' && s[1][1] === 'false' && !s[1].includes('true')), JSON.stringify(itemSelects));
const itemHints = JSON.parse(await ev('JSON.stringify((function() { const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-pencil-circle"); if (!m) return []; return [...m.closest(".modal").querySelectorAll(".form-group label .label-hint")].map((h) => h.textContent.trim()); })())'));
check('the item fields carry inheritance hints', itemHints.filter((h) => h.length > 0).length >= 2, JSON.stringify(itemHints));
// The weight input is the last numeric input of the dialog (after the
// Proxmox vmid), and its placeholder carries the default note.
const weightPh = JSON.parse(await ev('JSON.stringify((function() { const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-pencil-circle"); if (!m) return []; const ps = [...m.closest(".modal").querySelectorAll("input")].filter((i) => i.inputMode === "numeric").map((i) => i.getAttribute("placeholder") || ""); return ps; })())'));
check('the weight placeholder carries the default note', weightPh.length > 0 && /0/.test(weightPh[weightPh.length - 1]), JSON.stringify(weightPh));
await ev('(() => { const m = document.querySelector(".modal-overlay .modal-wide h2 i.mdi-pencil-circle"); if (m) m.closest(".modal").querySelector("button.btn-secondary").click(); return !!m; })()');
await sleep(300);

// Put everything back where it was.
await restore();

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
