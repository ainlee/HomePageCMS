// Checks the ordering controls of a service dialog: the widget cards move with
// their up/down buttons and with their drag handle, and the order that reaches
// the file is the one the dialog showed.
//
// The same run checks that the service card stays free of badge rows, so the
// narrow layout cannot be squeezed by tracking labels.
import yaml from '../node_modules/js-yaml/dist/js-yaml.mjs';
import { APP_URL, connect, createProfile, evalJson, freePort, launchChrome, sleep, trackChrome } from './helpers.mjs';

const PORT = await freePort();
const PROFILE = createProfile('hp-verify-item-order');
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

const api = async (path, init) => (await (await fetch(APP_URL + path, init)).json());

const seed = await api('/api/services');
const originalRaw = seed.raw || '';
const originalHash = seed.hash;

const SEED = [
  '- Media:',
  '    - Sorter:',
  '        href: http://sorter/',
  '        container: c1',
  '        ping: 10.0.0.9',
  '        siteMonitor: http://sorter/',
  '        namespace: media',
  '        app: plex',
  '        proxmoxNode: pve',
  '        proxmoxVMID: 100',
  '        widget:',
  '          type: plex',
  '          url: http://plex.host',
  '        widgets:',
  '          - type: sonarr',
  '            url: http://sonarr.host',
  '    - Ext:',
  '        href: http://ext/',
  '        app: far-away',
  '        external: true',
].join('\n');

await api('/api/services', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw: '---\n' + SEED, hash: originalHash }),
});

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
await waitFor('!!(document.querySelector("#app") && document.querySelector("#app").__vue_app__)');
await sleep(600);

// The tracking labels no longer sit on the card.
const cardBadges = await ev('document.querySelectorAll(".item-badges, .item-widget-badge").length');
check('the service card carries no badge row', cardBadges === 0, String(cardBadges));

await ev('(() => { document.querySelector(".item-card .item-actions .btn").click(); return true; })()');
await sleep(500);

const widgetTypes = () => ev('JSON.stringify([...document.querySelectorAll(".modal .widget-row .widget-type")].map((s) => s.getAttribute("data-value")))');

const startedTypes = JSON.parse(await widgetTypes());
check('both widget cards load', JSON.stringify(startedTypes) === '["plex","sonarr"]', JSON.stringify(startedTypes));

await ev('(() => { const b = document.querySelectorAll(".modal .widget-row")[0].querySelectorAll(".widget-row-foot .btn")[1]; b.click(); return true; })()');
await sleep(300);
const afterDown = JSON.parse(await widgetTypes());
check('the down button swaps the two widget cards', afterDown[0] === startedTypes[1] && afterDown[1] === startedTypes[0], JSON.stringify(afterDown));

await ev('(() => { const b = document.querySelectorAll(".modal .widget-row")[1].querySelectorAll(".widget-row-foot .btn")[0]; b.click(); return true; })()');
await sleep(300);
const afterUp = JSON.parse(await widgetTypes());
check('the up button moves the card back', JSON.stringify(afterUp) === JSON.stringify(startedTypes), JSON.stringify(afterUp));

const dragged = await ev('(() => { const rows = document.querySelectorAll(".modal .widget-row"); const handle = rows[0].querySelector(".widget-drag"); const a = handle.getBoundingClientRect(); const b = rows[1].getBoundingClientRect(); handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0, clientX: a.x + 4, clientY: a.y + 8 })); document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: b.x + 40, clientY: b.bottom - 4 })); document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", clientX: b.x + 40, clientY: b.bottom - 4 })); return true; })()');
await sleep(300);
const afterDrag = JSON.parse(await widgetTypes());
check('the drag handle reorders the widget cards', dragged && afterDrag[0] === startedTypes[1], JSON.stringify(afterDrag));

// Narrow phone: the handle and footer buttons must stay inside their cards.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await sleep(500);
const narrow = await ev('(() => { const head = document.querySelector(".modal .widget-row-head"); const foot = document.querySelector(".modal .widget-row-foot"); return JSON.stringify({ head: head ? head.scrollWidth - head.clientWidth : -1, foot: foot ? foot.scrollWidth - foot.clientWidth : -1 }); })()');
const narrowInfo = JSON.parse(narrow);
check('phone: the widget head does not overflow', narrowInfo.head <= 2, narrow);
check('phone: the widget footer does not overflow', narrowInfo.foot <= 2, narrow);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
await sleep(400);

await ev('(() => { const b = [...document.querySelectorAll(".modal button")].find((x) => x.classList.contains("btn-primary")); if (b) b.click(); return true; })()');
await sleep(300);
await ev('(() => { const b = document.querySelector(".btn-save"); if (b) b.click(); return true; })()');
await sleep(1800);

const file = await api('/api/services');
const parsed = yaml.load(file.raw || '', 'utf8');
const sorter = parsed[0].Media[0].Sorter;
const savedTypes = [sorter.widget.type, ...(sorter.widgets || []).map((w) => w.type)];
check('the saved widget order matches the dialog', JSON.stringify(savedTypes) === JSON.stringify(afterDrag), JSON.stringify(savedTypes));
check('the kubernetes target round-trips', sorter.app === 'plex' && sorter.namespace === 'media', JSON.stringify({ app: sorter.app, namespace: sorter.namespace }));
check('the proxmox target round-trips, vmid as a number',
  sorter.proxmoxNode === 'pve' && sorter.proxmoxVMID === 100 && !('proxmoxType' in sorter),
  JSON.stringify({ node: sorter.proxmoxNode, vmid: sorter.proxmoxVMID, type: sorter.proxmoxType }));
const ext = parsed[0].Media[1].Ext;
check('the external flag round-trips as a boolean', ext.app === 'far-away' && ext.external === true, JSON.stringify(ext));
check('the services file keeps no editor-only key',
  !('badgeOrder' in sorter) && !('badge_order' in sorter) && !('badges' in sorter),
  JSON.stringify(Object.keys(sorter)));

await api('/api/services', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw: originalRaw, hash: file.hash }),
});
const restored = await api('/api/services');
check('the original services file is restored', restored.raw === originalRaw);

ws.close(); chrome.kill();
cleanup();

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');
