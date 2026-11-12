// Checks the ordering controls of a service dialog: the widget cards move with
// their up/down buttons and their drag handle, the badge chips reorder by drag,
// and the order that reaches the files is the one the dialog showed.
//
// The test seeds a services file and reads both files back, then restores them.
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
const settingsBefore = await api('/api/settings');
const originalBadgeOrder = settingsBefore.data.badgeOrder || {};

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

// An external Kubernetes workload gets no status indicator upstream, so it must
// not produce a badge chip either.
await ev('(() => { document.querySelectorAll(".item-card")[1].querySelector(".item-actions .btn").click(); return true; })()');
await sleep(500);
const extChips = await ev('document.querySelectorAll(".modal .badge-chip").length');
check('an external kubernetes workload gets no badge', extChips === 0, String(extChips));
await ev('(() => { const b = document.querySelector(".modal .btn-secondary"); if (b) b.click(); return true; })()');
await sleep(400);

await ev('(() => { const c = document.querySelector(".item-card"); c.querySelector(".item-actions .btn").click(); return true; })()');
await sleep(500);

const chips = () => ev('JSON.stringify([...document.querySelectorAll(".modal .badge-chip")].map((c) => ({ label: (c.querySelector(".badge-chip-label") || {}).textContent || "", shown: c.classList.contains("is-shown") })))');
const widgetTypes = () => ev('JSON.stringify([...document.querySelectorAll(".modal .widget-row .widget-type")].map((s) => s.getAttribute("data-value")))');

const initial = JSON.parse(await chips());
check('one chip per tracked item', initial.length === 7, JSON.stringify(initial.map((c) => c.label)));
check('the first three chips are marked as shown', initial.slice(0, 3).every((c) => c.shown) && !initial[3].shown, JSON.stringify(initial));
check('chips start with the monitors', initial[0].label === 'c1' && initial[1].label === '10.0.0.9' && initial[2].label === 'monitor', JSON.stringify(initial.slice(0, 3)));
check('the kubernetes and proxmox indicators are chips too',
  initial[3].label === 'plex' && initial[4].label === 'pve/100', JSON.stringify(initial.slice(3, 5)));

// Up/down buttons of the widget cards.
const startedTypes = JSON.parse(await widgetTypes());
await ev('(() => { const b = document.querySelectorAll(".modal .widget-row")[0].querySelectorAll(".widget-row-foot .btn")[1]; b.click(); return true; })()');
await sleep(300);
const afterDown = JSON.parse(await widgetTypes());
check('the down button swaps the two widget cards', afterDown[0] === startedTypes[1] && afterDown[1] === startedTypes[0], JSON.stringify(afterDown));
await ev('(() => { const b = document.querySelectorAll(".modal .widget-row")[1].querySelectorAll(".widget-row-foot .btn")[0]; b.click(); return true; })()');
await sleep(300);
const afterUp = JSON.parse(await widgetTypes());
check('the up button moves the card back', JSON.stringify(afterUp) === JSON.stringify(startedTypes), JSON.stringify(afterUp));

// Drag handle: pull the first widget card down onto the second one.
const dragged = await ev('(() => { const rows = document.querySelectorAll(".modal .widget-row"); const handle = rows[0].querySelector(".widget-drag"); const a = handle.getBoundingClientRect(); const b = rows[1].getBoundingClientRect(); handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0, clientX: a.x + 4, clientY: a.y + 8 })); document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: b.x + 40, clientY: b.bottom - 4 })); document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", clientX: b.x + 40, clientY: b.bottom - 4 })); return true; })()');
await sleep(300);
const afterDrag = JSON.parse(await widgetTypes());
check('the drag handle reorders the widget cards', dragged && afterDrag[0] === startedTypes[1], JSON.stringify(afterDrag));

// Drag the last badge chip to the front: it becomes the first card badge.
const chipLabelsBefore = JSON.parse(await chips()).map((c) => c.label);
const lastLabel = chipLabelsBefore[chipLabelsBefore.length - 1];
await ev('(() => { const chips = document.querySelectorAll(".modal .badge-chip"); const last = chips[chips.length - 1]; const first = chips[0]; const a = last.getBoundingClientRect(); const b = first.getBoundingClientRect(); last.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0, clientX: a.x + 6, clientY: a.y + 6 })); document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: b.x + 2, clientY: b.y + 6 })); document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", clientX: b.x + 2, clientY: b.y + 6 })); return true; })()');
await sleep(300);
const chipLabelsAfter = JSON.parse(await chips()).map((c) => c.label);
check('the dragged chip is now first', chipLabelsAfter[0] === lastLabel, JSON.stringify(chipLabelsAfter));

// Narrow phone: the new handle and footer buttons must stay inside their cards.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await sleep(500);
const narrow = await ev('(() => { const over = (el) => el ? el.scrollWidth > el.clientWidth + 2 : false; const head = document.querySelector(".modal .widget-row-head"); const foot = document.querySelector(".modal .widget-row-foot"); return JSON.stringify({ head: head ? head.scrollWidth - head.clientWidth : -1, foot: foot ? foot.scrollWidth - foot.clientWidth : -1 }); })()');
const narrowInfo = JSON.parse(narrow);
check('phone: the widget head does not overflow', narrowInfo.head <= 2, narrow);
check('phone: the widget footer does not overflow', narrowInfo.foot <= 2, narrow);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
await sleep(400);

// Save the dialog and the file, then read both files back.
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

const settingsAfter = await api('/api/settings');
const storedOrder = (settingsAfter.data.badgeOrder || {})['Media/Sorter'] || [];
check('the badge order is stored in the editor settings', storedOrder[0] === 'widget:' + lastLabel, JSON.stringify(storedOrder));
check('the services file keeps no editor-only key', !('badgeOrder' in sorter) && !('badge_order' in sorter), JSON.stringify(Object.keys(sorter)));

const cardLabels = await ev('JSON.stringify([...document.querySelectorAll(".item-badges .item-widget-badge")].slice(0, 3).map((b) => b.textContent.trim()))');
check('the card shows the reordered badges first', JSON.parse(cardLabels)[0] === lastLabel, cardLabels);

// Put both files back.
await api('/api/services', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ raw: originalRaw, hash: file.hash }),
});
await api('/api/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ badgeOrder: originalBadgeOrder }),
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
