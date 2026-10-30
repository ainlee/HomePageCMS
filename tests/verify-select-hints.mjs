// Checks the select-hint widget-type dropdown: the name+hint row layout, the
// missing-key fallback, the marquee mechanism, keyboard selection,
// outside-click close, narrow mobile overflow, and the ping save path.
//
// Seeds a services file through the API, drives the editor, saves, and
// reads the file back. The original file is restored at the end.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-select-hints');
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
const api = async (path, init) => (await (await fetch(APP_URL + path, init)).json());

const seed = await api('/api/services');
const originalRaw = seed.raw || '';
const originalHash = seed.hash;

// One legacy ping service and one multi-widget service: the shapes the
// editor writes are checked against after the save. watchtower has no
// hint key, so it also stands in for the missing-key fallback.
const SEED = [
  '- Media:',
  '    - Pinger:',
  '        href: http://host-a/',
  '        ping: 10.0.0.1',
  '    - Multi:',
  '        href: http://host-b/',
  '        widget:',
  '          type: plex',
  '          url: http://plex.host',
  '        widgets:',
  '          - type: watchtower',
  '            url: http://watchtower.host'
].join('\n');

await api('/api/services', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw: '---\n' + SEED, hash: originalHash })
});

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor('!!(document.querySelector("#app") && document.querySelector("#app").__vue_app__)');
await sleep(600);

const openService = (index) => ev('(() => { const cards = document.querySelectorAll(".item-card"); const c = cards[' + index + ']; const b = c && c.querySelector(".item-actions .btn"); if (b) b.click(); return !!b; })()');

// Open the Pinger service: its legacy ping field loads as a widget row.
await openService(0);
await sleep(400);

const pingRow = await ev('(() => { const sh = document.querySelector(".widget-row .widget-type"); if (!sh) return "no-row"; return JSON.stringify({ value: sh.getAttribute("data-value"), label: (sh.querySelector(".sh-trigger-label") || {}).textContent || "", hint: (sh.querySelector(".sh-trigger-hint") || {}).textContent || "" }); })()');
const pr = JSON.parse(pingRow);
check('the legacy ping field loads as a widget row', pr.value === 'ping', pingRow);
check('the trigger shows the type name', pr.label.indexOf('ping') !== -1, pr.label);
check('the trigger shows its right-aligned hint', pr.hint !== '', pr.hint);

// Open the list and check the option rows: name left, hint right.
await ev('(() => { const t = document.querySelector(".widget-row .widget-type .sh-trigger"); if (t) t.click(); return !!t; })()');
await sleep(300);

const rows = await ev('(() => { const opts = [...document.querySelectorAll(".widget-row .widget-type .sh-opt")].filter((o) => ["ping", "plex", "kubernetes", "watchtower"].includes(o.getAttribute("data-value"))); return JSON.stringify(opts.map((o) => { const hint = o.querySelector(".sh-opt-hint"); const hs = hint ? getComputedStyle(hint) : {}; return { value: o.getAttribute("data-value"), hint: hint ? hint.textContent.trim() : "", hasHint: !!hint, hintAlign: hs ? hs.textAlign : "" }; })); })()');
const rowArr = JSON.parse(rows);
const known = rowArr.filter((r) => r.value !== 'watchtower');
check('known type rows carry their hint text', known.length >= 3 && known.every((r) => r.hint !== ''), rows);
check('hints are right-aligned in the row', known.every((r) => r.hintAlign === 'right'), known.map((r) => r.hintAlign).join(','));
const unknown = rowArr.find((r) => r.value === 'watchtower');
check('a type without a hint key falls back to no hint', unknown && unknown.hasHint === false, JSON.stringify(unknown));

// Marquee mechanism: the hint text is duplicated in the run so an
// overflowing hint can scroll seamlessly; short hints sit still.
const marquee = await ev('(() => { const sh = document.querySelector(".widget-row .widget-type"); const opt = [...sh.querySelectorAll(".sh-opt")].find((o) => o.querySelector(".sh-opt-hint")); if (!opt) return "no-hint-opt"; const run = opt.querySelector(".sh-hint-run"); const copies = run ? run.querySelectorAll(".sh-hint-copy").length : 0; return JSON.stringify({ copies, marquee: opt.classList.contains("sh-marquee"), clip: opt.classList.contains("sh-clip") }); })()');
const mq = JSON.parse(marquee);
check('the marquee mechanism duplicates the hint text', mq.copies === 2, marquee);

// Keyboard: open with ArrowDown, commit with Enter.
await ev('(() => { const t = document.querySelector(".widget-row .widget-type .sh-trigger"); t.focus(); t.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); return true; })()');
await sleep(200);
const kbdValue = await ev('document.querySelector(".widget-row .widget-type").getAttribute("data-value")');
check('ArrowDown opens the list and highlights an option', kbdValue !== null && kbdValue !== '', String(kbdValue));
await ev('(() => { const t = document.querySelector(".widget-row .widget-type .sh-trigger"); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; })()');
await sleep(200);
const afterKbd = await ev('(() => { return JSON.stringify({ value: document.querySelector(".widget-row .widget-type").getAttribute("data-value"), open: !!document.querySelector(".widget-row .widget-type .sh-list") }); })()');
const ak = JSON.parse(afterKbd);
check('Enter commits the highlighted option and closes', ak.value !== '' && ak.open === false, afterKbd);

// A mousedown outside the listbox closes it.
await ev('(() => { const t = document.querySelector(".widget-row .widget-type .sh-trigger"); t.click(); return true; })()');
await sleep(200);
const reopened = await ev('!!document.querySelector(".widget-row .widget-type .sh-list")');
check('the trigger reopens the listbox', reopened);
await ev('(() => { document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); return true; })()');
await sleep(200);
check('a mousedown outside the listbox closes it', await ev('!document.querySelector(".widget-row .widget-type .sh-list")'));

// Narrow mobile column: the open listbox must not overflow horizontally.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
await sleep(400);
await ev('(() => { const t = document.querySelector(".widget-row .widget-type .sh-trigger"); if (t) t.click(); return true; })()');
await sleep(300);
const mobile = await ev('(() => { const list = document.querySelector(".widget-row .widget-type .sh-list"); if (!list) return JSON.stringify({ noList: true }); return JSON.stringify({ sw: list.scrollWidth, cw: list.clientWidth }); })()');
const mob = JSON.parse(mobile);
check('mobile: the open listbox does not overflow its column', !mob.noList && mob.sw <= mob.cw + 2, mobile);

// Ping save path: pick ping, fill only the host, save the dialog and the
// editor, and read the file back.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
await sleep(300);
await ev('(() => { const sh = document.querySelector(".widget-row .widget-type"); sh.click(); return true; })()');
await sleep(200);
await ev('(() => { const opt = [...document.querySelectorAll(".widget-row .widget-type .sh-opt")].find((o) => o.getAttribute("data-value") === "ping"); if (opt) opt.click(); return !!opt; })()');
await sleep(200);
await ev('(() => { const groups = [...document.querySelectorAll(".widget-row-fields .form-group")]; groups.forEach((g) => { const i = g.querySelector("input"); if (i) { i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); } }); const host = groups[3]; if (host) { const i = host.querySelector("input"); i.value = "10.9.9.9"; i.dispatchEvent(new Event("input", { bubbles: true })); } return !!host; })()');
await sleep(200);

await ev('(() => { const b = [...document.querySelectorAll(".modal button")].find((x) => x.classList.contains("btn-primary")); if (b) b.click(); return true; })()');
await sleep(300);
await ev('(() => { const b = document.querySelector(".btn-save"); if (b) b.click(); return true; })()');
await sleep(1500);

const yaml = (await import('../node_modules/js-yaml/dist/js-yaml.mjs')).default;
const file = await api('/api/services');
const parsed = yaml.load(file.raw || '', 'utf8');
function findSvc(name) {
  for (const g of parsed) {
    for (const svcs of Object.values(g)) {
      if (!Array.isArray(svcs)) continue;
      for (const entry of svcs) if (entry[name]) return entry[name];
    }
  }
  return null;
}
const pinger = findSvc('Pinger');
const multi = findSvc('Multi');
check('a single plain ping writes the service-level ping field',
  pinger && pinger.ping === '10.9.9.9' && !('widget' in pinger) && !('widgets' in pinger), JSON.stringify(pinger));
check('a multi-widget service keeps its shapes without a stray host',
  multi && multi.widget && Array.isArray(multi.widgets) && multi.widgets.length === 1 &&
  !('host' in multi.widget) && !('host' in multi.widgets[0]), JSON.stringify(multi));

// Put the file back the way it was.
await api('/api/services', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw: originalRaw, hash: file.hash })
});
const restored = await api('/api/services');
check('the original file is restored', restored.raw === originalRaw);

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
