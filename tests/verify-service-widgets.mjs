// Checks the complete service widget model: every widget shape upstream uses
// (the single `widget` object, the plural `widgets` list, and the legacy
// service-level customapi / container / ping fields) loads into the editor,
// the unmodelled keys (headers, highlight, ...) survive a save, and the file
// keeps the shape it started in.
//
// The test seeds a services file through the API, drives the editor, saves,
// and reads the file back. It puts the original file back when it finishes.
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-service-widgets');
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
const originalHash = seed.hash;
const originalRaw = seed.raw || '';

// A service that exercises every shape upstream uses, plus unmodelled keys.
const SEED = [
  '- Media:',
  '    - Sonarr:',
  '        href: http://sonarr.host',
  '        siteMonitor: http://sonarr.host',
  '        statusStyle: dot',
  '        showStats: true',
  '        widget:',
  '          type: sonarr',
  '          url: http://sonarr.host',
  '          key: skey',
  '          fields:',
  '            - wanted',
  '            - queued',
  '          hideErrors: true',
  '          highlight:',
  '            queued:',
  '              numeric:',
  '                - level: danger',
  '                  when: gte',
  '                  value: 20',
  '    - Radarr:',
  '        href: http://radarr.host',
  '        widget:',
  '          type: radarr',
  '          url: http://radarr.host',
  '          key: rkey',
  '        widgets:',
  '          - type: traktormet',
  '            url: http://traktormet.host',
  '            key: tkey',
  '          - type: jellystat',
  '            url: http://jellyfin.host',
  '            key: jkey',
  '- Legacy:',
  '    - Cpi:',
  '        href: http://cpi/',
  '        customapi: http://api/',
  '    - Box:',
  '        href: http://box/',
  '        container: box-container'
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

// Each item card carries five action buttons (edit, up, down, move, delete),
// so count the cards - not the buttons - to reach the right service.
const openService = (index) => ev('(() => { const cards = document.querySelectorAll(".item-card"); const c = cards[' + index + ']; const b = c && c.querySelector(".item-actions .btn"); if (b) b.click(); return !!b; })()');

// Open the Sonarr service (rich widget + unmodelled keys) and confirm the
// widget row carries its type, fields and the hideErrors tri-state.
await openService(0);
await sleep(400);
const sonarr = await ev('(() => { const w = document.querySelector(".widget-row"); const sel = w && w.querySelector(".widget-type"); const labels = [...document.querySelectorAll(".widget-row-fields .form-group label")].map((l) => l.textContent.trim()); const inputs = [...document.querySelectorAll(".widget-row-fields .form-group input, .widget-row-fields .form-group select")]; const byLabel = {}; labels.forEach((t, i) => { byLabel[t] = inputs[i] ? inputs[i].value : ""; }); return JSON.stringify({ type: sel ? sel.getAttribute("data-value") : "", byLabel }); })()');
const s = JSON.parse(sonarr);
check('the rich widget loads with its type', s.type === 'sonarr', s.type);
check('the fields list loads comma-joined', s.byLabel['可見欄位'] === 'wanted, queued', s.byLabel['可見欄位']);
check('hideErrors loads as a tri-state', s.byLabel['隱藏錯誤訊息'] === 'true', s.byLabel['隱藏錯誤訊息']);

// The monitor fields of the service load.
const monitor = await ev('(() => { const find = (re) => { const l = [...document.querySelectorAll(".form-group label")].find((x) => re.test(x.textContent)); const inp = l && l.parentElement.querySelector("input"); return inp ? inp.value : ""; }; return JSON.stringify({ siteMonitor: find(/siteMonitor/), statusStyle: find(/statusStyle/i) || "" }); })()');
const m = JSON.parse(monitor);
check('siteMonitor loads into the monitor field', m.siteMonitor === 'http://sonarr.host', m.siteMonitor);

// Close and open Radarr (index 1: Sonarr, Radarr, Cpi, Box): it carries a
// primary widget plus a plural widgets list.
await ev('(() => { const b = document.querySelector(".modal .btn-secondary"); if (b) b.click(); return true; })()');
await sleep(300);
await openService(1);
await sleep(400);
const radarr = await ev('(() => { const rows = [...document.querySelectorAll(".widget-row .widget-type")].map((x) => x.getAttribute("data-value")); return JSON.stringify(rows); })()');
check('a multi-widget service loads every widget', JSON.parse(radarr).length === 3, radarr);

// Save everything and read the file back.
await ev('(() => { const b = [...document.querySelectorAll(".modal button")].find((x) => x.classList.contains("btn-primary")); if (b) b.click(); return true; })()');
await sleep(300);
await ev('(() => { const b = document.querySelector(".btn-save"); if (b) b.click(); return true; })()');
await sleep(1500);

// The services file is a list of single-key group objects, each mapping a
// group name to a list of single-key service objects. Walk that shape.
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
const sonarrSvc = findSvc('Sonarr');
const radarrSvc = findSvc('Radarr');
const cpiSvc = findSvc('Cpi');
const boxSvc = findSvc('Box');

check('the unmodelled highlight key survives a save', !!sonarrSvc.widget.highlight, JSON.stringify(sonarrSvc.widget && Object.keys(sonarrSvc.widget)));
check('siteMonitor / statusStyle / showStats survive',
  sonarrSvc.siteMonitor === 'http://sonarr.host' && sonarrSvc.statusStyle === 'dot' && sonarrSvc.showStats === true,
  JSON.stringify({ siteMonitor: sonarrSvc.siteMonitor, statusStyle: sonarrSvc.statusStyle, showStats: sonarrSvc.showStats }));
check('a multi-widget service keeps the widgets array',
  Array.isArray(radarrSvc.widgets) && radarrSvc.widgets.length === 2 && !!radarrSvc.widget,
  JSON.stringify({ hasWidget: !!radarrSvc.widget, n: radarrSvc.widgets ? radarrSvc.widgets.length : 0 }));
check('a legacy customapi keeps its scalar shape',
  typeof cpiSvc.customapi === 'string' && !('widget' in cpiSvc), JSON.stringify(cpiSvc));
check('a legacy container keeps its scalar shape',
  typeof boxSvc.container === 'string' && !('widget' in boxSvc), JSON.stringify(boxSvc));

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
