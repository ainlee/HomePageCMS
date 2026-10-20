// Shared setup for the headless-Chrome checks.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

// Chrome location differs per platform and per install, so probe a list instead of
// hardcoding one machine's path. CHROME_PATH overrides the search.
export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    'Chrome not found. Set CHROME_PATH to a Chrome/Chromium executable and try again.'
  );
}

export function launchChrome({ port, profile }) {
  return spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal CDP client over the DevTools websocket.
export class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      const entry = this.pending.get(msg.id);
      if (entry) {
        this.pending.delete(msg.id);
        msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

// Connect to a freshly launched Chrome and attach to a new page target.
export async function connect(port) {
  let version;
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) { version = await res.json(); break; }
    } catch {}
    await sleep(200);
  }
  if (!version) throw new Error('Chrome DevTools endpoint never came up');

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('ws failed')); });
  const cdp = new CDP(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  return { cdp, sessionId, ws };
}

// The editor must already be running; these checks drive the real page.
export const APP_URL = process.env.APP_URL || 'http://localhost:3456';

export async function evalJson(cdp, sessionId, expression) {
  const res = await cdp.send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (res.exceptionDetails) {
    throw new Error('page threw: ' + JSON.stringify(res.exceptionDetails.exception));
  }
  return res.result.value;
}

export async function waitForApp(cdp, sessionId) {
  for (let i = 0; i < 100; i++) {
    // The template is inline inside #app, so .preview-panel exists before Vue mounts.
    // Wait for the real mount (__vue_app__) plus rendered inline styles, otherwise clicks
    // land on an unhydrated page and silently do nothing.
    const ready = await evalJson(cdp, sessionId, `(() => {
      const app = document.querySelector('#app');
      const pv = document.querySelector('.preview-panel');
      return !!(app && app.__vue_app__ && pv && pv.getAttribute('style'));
    })()`);
    if (ready) return;
    await sleep(150);
  }
  throw new Error('app never rendered');
}
