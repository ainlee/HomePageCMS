'use strict';

// The updater sidecar: the docker half of the self-upgrade.
//
// The local editor pulls its own git checkout and restarts itself. In the
// docker layout the app container has no git checkout at all, so this small
// sidecar owns one: it keeps a persistent clone, and when the editor's
// upgrade button is pressed it pulls the new snapshot, publishes it into the
// releases directory the app container mounts, and restarts that container
// through the docker socket. The config volumes are never touched.
//
// Zero dependencies: node >= 18, git, and (optionally) the docker socket.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');

const PORT = Number(process.env.UPDATE_PORT || 8788);
const REPO_DIR = process.env.UPDATE_REPO_DIR || '/srv/update/repo';
const RELEASES_DIR = process.env.UPDATE_RELEASES_DIR || '/srv/update/releases';
const REPO_URL = (process.env.UPDATE_REPO_URL || '').trim();
const BRANCH = (process.env.UPDATE_BRANCH || 'main').trim();
const KEEP_RELEASES = Math.max(1, Number(process.env.UPDATE_KEEP_RELEASES || 3));
const APP_CONTAINER = (process.env.UPDATE_APP_CONTAINER || '').trim();
const DOCKER_SOCK = process.env.UPDATE_DOCKER_SOCK || '/var/run/docker.sock';
const FETCH_TIMEOUT_MS = 30000;
const PULL_TIMEOUT_MS = 60000;
const CLONE_TIMEOUT_MS = 5 * 60 * 1000;
const NPM_TIMEOUT_MS = 5 * 60 * 1000;

// The parts of the repo the app actually runs. Everything else (tests, docs,
// agent tooling, the sidecar itself) stays out of the published snapshot.
// The parts of the repo the app actually runs. node_modules is copied
// separately (once, after npm ci) so it is not duplicated by the filter.
const PUBLISH_TOP = new Set([
  'server.js', 'package.json', 'package-lock.json',
  'lib', 'public', 'locales', 'themes', 'config'
]);

const log = {
  info: (...a) => console.log('[updater]', ...a),
  error: (...a) => console.error('[updater]', ...a)
};

function git(args, opts = {}) {
  return new Promise((resolve) => {
    execFile('git', args, {
      cwd: REPO_DIR,
      timeout: opts.timeoutMs || 30000,
      maxBuffer: 64 * 1024 * 1024,
      env: process.env
    }, (err, stdout, stderr) => {
      if (err) {
        // Keep the stderr tail: the first line of a failed git command is
        // generic ("fatal: ...") and the real reason is usually later.
        const lines = String(stderr || err.message || '').split('\n').filter((l) => l.trim());
        resolve({ ok: false, output: lines.slice(-5).join(' | '), err });
        return;
      }
      resolve({ ok: true, output: String(stdout).trim() });
    });
  });
}

function gitSha(args, opts = {}) {
  return git(args, opts).then((r) => {
    if (!r.ok) return null;
    const m = r.output.match(/\b[0-9a-f]{40}\b/);
    return m ? m[0] : null;
  });
}

function isRepo() {
  return fs.existsSync(path.join(REPO_DIR, '.git'));
}

function isDirty() {
  // node_modules and other gitignored work never show up here, so a pull in
  // the middle does not count as "dirty".
  return git(['status', '--porcelain']).then((r) => r.ok && r.output.length > 0);
}

// npm ci with the runtime dependencies only, matching the app image (the
// Dockerfile builds with npm ci --omit=dev, so the app container never
// runs against development packages).
function npmInstall(force) {
  const hasModules = fs.existsSync(path.join(REPO_DIR, 'node_modules'));
  const hasLock = fs.existsSync(path.join(REPO_DIR, 'package-lock.json'));
  if (!force && hasModules) return Promise.resolve('');
  if (!hasLock && !force) return Promise.resolve('');
  const sub = hasLock ? 'ci' : 'install';
  return new Promise((resolve, reject) => {
    execFile('npm', [sub, '--omit=dev'], {
      cwd: REPO_DIR,
      timeout: NPM_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32'
    }, (err, stdout, stderr) => {
        if (err) {
          const lines = String(stderr || err.message || '').split('\n').filter((l) => l.trim());
          reject(new Error(lines.slice(-5).join(' | ')));
        } else {
          resolve('');
        }
      }
    );
  });
}

// Copy one runnable snapshot into releases/<name> and atomically switch
// current -> it. The switch is rename(2) over a temporary link, so the app
// container either sees the old snapshot or the complete new one, never a mix.
async function publish() {
  if (!isRepo()) throw new Error('repo not initialised');
  const name = 'r-' + Date.now();
  const target = path.join(RELEASES_DIR, name);
  fs.mkdirSync(RELEASES_DIR, { recursive: true });
  fs.cpSync(REPO_DIR, target, {
    recursive: true,
    filter: (src) => {
      if (src === REPO_DIR) return true; // the source root itself must pass
      const top = path.relative(REPO_DIR, src).split(path.sep)[0];
      return PUBLISH_TOP.has(top);
    }
  });
  // Keep the snapshot self-contained: the app container only mounts the
  // release, so its node_modules must ship with it.
  await npmInstall(false);
  if (fs.existsSync(path.join(REPO_DIR, 'node_modules'))) {
    fs.cpSync(path.join(REPO_DIR, 'node_modules'), path.join(target, 'node_modules'), { recursive: true });
  }

  const tmp = path.join(RELEASES_DIR, 'current.tmp');
  const cur = path.join(RELEASES_DIR, 'current');
  fs.rmSync(tmp, { force: true });
  try {
    fs.symlinkSync(name, tmp);
    fs.renameSync(tmp, cur); // atomic, even when current already exists
  } catch (e) {
    // Windows: symlinks need privileges; a junction is enough and needs none.
    if (e.code === 'EPERM' || e.code === 'EEXIST' || e.code === 'ENOTEMPTY' || e.code === 'UNKNOWN') {
      fs.rmSync(cur, { force: true, recursive: true });
      fs.rmSync(tmp, { force: true });
      fs.symlinkSync(name, cur, 'junction');
    } else {
      throw e;
    }
  }

  // Prune old releases, keeping the one current points at plus KEEP_RELEASES.
  const keep = new Set([name]);
  const entries = fs.readdirSync(RELEASES_DIR).filter((e) => e.startsWith('r-')).sort().reverse();
  for (const entry of entries) {
    if (keep.size >= KEEP_RELEASES) break;
    keep.add(entry);
  }
  for (const entry of fs.readdirSync(RELEASES_DIR)) {
    if (!entry.startsWith('r-') || keep.has(entry)) continue;
    fs.rmSync(path.join(RELEASES_DIR, entry), { recursive: true, force: true });
  }
  log.info('published ' + name);
  return name;
}

// Restart the app container over the docker socket. Best-effort: when the
// socket is absent (local testing) it reports false instead of failing the
// update. The caller runs this AFTER the HTTP answer has been sent, so the
// app container may die mid-request without losing the user's reply.
function dockerRestart() {
  return new Promise((resolve) => {
    if (!APP_CONTAINER) return resolve(false);
    let req;
    try {
      req = http.request({
        socketPath: DOCKER_SOCK,
        method: 'POST',
        path: '/containers/' + encodeURIComponent(APP_CONTAINER) + '/restart',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        res.resume();
      res.on('end', () => {
        // Docker answers 204 (Not Content) on a successful restart.
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      });
    } catch (e) {
      log.error('docker socket unreachable: ' + e.message);
      return resolve(false);
    }
    req.on('error', (e) => {
      log.error('docker restart failed: ' + e.message);
      resolve(false);
    });
    req.end();
  });
}

// GET: is the remote snapshot ahead of this one?
async function status() {
  const base = { hasUpdate: false, local: null, remote: null, offline: true, env: 'docker' };
  if (!isRepo()) {
    await ensureRepo().catch(() => {});
    if (!isRepo()) return base;
  }
  const local = await gitSha(['rev-parse', 'HEAD']);
  const fetched = await git(['fetch', 'origin', BRANCH], { timeoutMs: FETCH_TIMEOUT_MS });
  if (!fetched.ok) return { ...base, local, remote: null, offline: true, fetchError: fetched.output };
  const remote = await gitSha(['rev-parse', 'refs/remotes/origin/' + BRANCH]);
  if (!local || !remote) return { ...base, local, remote, offline: true };
  return { hasUpdate: local !== remote, local, remote, offline: false, env: 'docker' };
}

// POST: pull, publish a snapshot, restart the app container.
async function update() {
  // A pull arriving before the initial clone finished still works: it waits
  // for the shared init instead of failing.
  if (!isRepo()) {
    try {
      await ensureRepo();
    } catch (e) {
      throw new Error('升級失敗: 快照資料夾初始化失敗 ' + (e.message || e));
    }
  }
  if (await isDirty()) {
    const detail = (await git(['status', '--porcelain'])).output;
    throw new Error('升級失敗: 工作目錄有未提交的改動\n' + detail);
  }
  const before = await gitSha(['rev-parse', 'HEAD']);
  const fetched = await git(['fetch', 'origin', BRANCH], { timeoutMs: FETCH_TIMEOUT_MS });
  if (!fetched.ok) throw new Error('升級失敗: 無法連線至遠端倉庫 ' + fetched.output);
  const pull = await git(['pull', '--ff-only', 'origin', BRANCH], { timeoutMs: PULL_TIMEOUT_MS });
  if (!pull.ok) throw new Error('升級失敗: ' + pull.output);
  const after = await gitSha(['rev-parse', 'HEAD']);

  // Reinstall the dependencies only when the lockfile moved in this pull.
  if (before && after && before !== after) {
    const moved = await git(['diff', '--name-only', before, after, '--', 'package-lock.json']);
    if (moved.ok && moved.output) {
      try {
        await npmInstall(true);
      } catch (e) {
        throw new Error('依賴安裝失敗: ' + (e.message || e));
      }
    }
  }
  let published;
  try {
    published = await publish();
  } catch (e) {
    throw new Error('發布失敗: ' + (e.message || e));
  }
  // Whether a background restart will follow this answer.
  const willRestart = !!(APP_CONTAINER && fs.existsSync(DOCKER_SOCK));
  return {
    env: 'docker',
    restarted: willRestart,
    release: published,
    commitsPulled: before && after && before !== after ? 1 : 0
  };
}

// A usable "current" link is a symlink into one of the releases. Docker
// creates the host path as a plain EMPTY DIRECTORY when the app container
// starts before the first publish exists, and that counts as no release.
function currentLinkOk() {
  try {
    return fs.lstatSync(path.join(RELEASES_DIR, 'current')).isSymbolicLink();
  } catch (e) {
    return false;
  }
}

// The clone happens once; concurrent requests share it so a healthcheck or
// a status poll does not trigger a second clone while the first is running.
let initPromise = null;

async function ensureRepo() {
  if (!REPO_URL) throw new Error('UPDATE_REPO_URL 未設定');
  if (isRepo()) return;
  if (!initPromise) {
    initPromise = _initRepo().finally(() => { initPromise = null; });
  }
  await initPromise;
}

async function _initRepo() {
  if (isRepo()) return;
  fs.mkdirSync(REPO_DIR, { recursive: true });
  const r = await new Promise((resolve) => {
    execFile(
      'git', ['clone', '--single-branch', '--branch', BRANCH, REPO_URL, REPO_DIR],
      { timeout: CLONE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, env: process.env },
      (err, stdout, stderr) => {
        if (err) resolve({ ok: false, output: String(stderr || err.message) });
        else resolve({ ok: true, output: String(stdout) });
      }
    );
  });
  if (!r.ok) throw new Error('repo init failed: ' + r.output.split('\n').slice(-3).join(' '));
  log.info('cloned ' + REPO_URL);
  await npmInstall(true);
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const route = (req.url || '').split('?')[0];
  try {
    if (req.method === 'GET' && route === '/healthz') {
      // Pure liveness. Deliberately NOT /api/update/status: a healthcheck that
      // really runs git fetch would fork processes every 30 seconds.
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && route === '/api/update/status') {
      sendJson(res, 200, await status());
      return;
    }
    if (req.method === 'POST' && route === '/api/update/pull') {
      let data;
      try {
        data = await update();
      } catch (e) {
        // Every error is answered with the "升級失敗:" prefix: the editor's
        // i18n layer keys off that pattern to translate it.
        const msg = String(e.message || e);
        sendJson(res, 500, { success: false, error: msg.startsWith('升級失敗') ? msg : '升級失敗: ' + msg });
        return;
      }
      // The pull and publish are done, so the answer is safe to send. The
      // container restart follows in the background: if it were awaited
      // before replying, the restarted app container would take this very
      // process down and the browser would never see the success.
      sendJson(res, 200, { success: true, data });
      if (data.restarted) {
        setTimeout(() => {
          dockerRestart().then((ok) => {
            if (ok) log.info('app container ' + APP_CONTAINER + ' restarted');
            else log.error('app container ' + APP_CONTAINER + ' restart reported failure');
          });
        }, 800);
      }
      return;
    }
    sendJson(res, 404, { success: false, error: 'Unknown route: ' + route });
  } catch (e) {
    log.error('request error: ' + (e.stack || e.message));
    sendJson(res, 500, { success: false, error: e.message || String(e) });
  }
});

server.listen(PORT, '0.0.0.0', async () => {
  log.info('listening on :' + PORT);
  if (!REPO_URL) {
    log.info('UPDATE_REPO_URL not set: running in unsupported mode');
    return;
  }
  try {
    await ensureRepo();
    if (!currentLinkOk()) {
      // First boot of a fresh install: publish so the app container has
      // something to run. The app container's /code mount is fixed to
      // whatever "current" resolved to when the container was created, so
      // after the first publish the container must be restarted once for
      // the new link to take effect.
      await publish();
      log.info('initial release published');
      if (APP_CONTAINER && fs.existsSync(DOCKER_SOCK)) {
        setTimeout(() => {
          dockerRestart().then((ok) => {
            if (ok) log.info('app container ' + APP_CONTAINER + ' restarted with initial release');
            else log.error('could not restart ' + APP_CONTAINER + ' (not running yet? it will pick up the release on its next start)');
          });
        }, 2000);
      }
    }
  } catch (e) {
    log.error('startup init failed (will retry on request): ' + (e.message || e));
  }
});
