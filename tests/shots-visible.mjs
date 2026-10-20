// Captures the reported phone condition: dvh/innerHeight report 844 while the area the
// user can actually see is 600. The screenshot is clipped to the VISIBLE area, which is
// what the phone shows, so the collapsed strip and the last service group must be in it.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_URL, connect, createProfile, evalJson, launchChrome, removeProfile, sleep } from './helpers.mjs';

const OUT = join(process.cwd(), 'shots') + '\\';
const PORT = 9346;
const PROFILE = createProfile('hp-shots-visible');
const VISIBLE = 600;
const chrome = launchChrome({ port: PORT, profile: PROFILE });
const { cdp, sessionId, ws } = await connect(PORT);
const ev = (e) => evalJson(cdp, sessionId, e);
const click = async (x, y) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }, sessionId);
};
const shot = async (name) => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 390, height: VISIBLE, scale: 1 } }, sessionId);
  writeFileSync(OUT + name, Buffer.from(data, 'base64'));
  console.log('wrote ' + name);
};
const center = async (sel) => JSON.parse(await ev(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return JSON.stringify({x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)}); })()`));

const stub = `(() => {
  const fake = { height: ${VISIBLE}, width: 390, scale: 1, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0,
    addEventListener: function(){}, removeEventListener: function(){} };
  try { Object.defineProperty(window, 'visualViewport', { configurable: true, get: function(){ return fake; } }); } catch (e) {}
})();`;

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stub }, sessionId);
await cdp.send('Page.navigate', { url: APP_URL }, sessionId);
for (let i = 0; i < 120; i++) { if (await ev(`!!(document.querySelector('#app') && document.querySelector('#app').__vue_app__ && document.querySelector('.preview-panel').getAttribute('style'))`)) break; await sleep(150); }
await ev('document.fonts.ready.then(() => true)');
await sleep(1200);

await shot('phone-visible-expanded.png');
const b = await center('.preview-header-left button');
await click(b.x, b.y);
await sleep(600);
await shot('phone-visible-collapsed.png');

ws.close(); chrome.kill();
removeProfile(PROFILE);
