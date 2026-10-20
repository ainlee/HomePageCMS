const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');

const app = express();
const PROJECT_DIR = __dirname;

// Defaults, all relative to the project directory, so a fresh clone works with no
// setup and nothing here is tied to one particular deployment.
const DEFAULT_PORT = 3456;
// The editor can rewrite the Homepage configuration, so it only listens on the local
// machine unless it is told otherwise. Opening it up is one setting (or HOST) away.
const DEFAULT_BIND_ADDRESS = '127.0.0.1';
const DEFAULT_CONFIG_DIR = path.join(PROJECT_DIR, 'config');
const DEFAULT_BACKUP_DIR = path.join(PROJECT_DIR, 'backups');
const DEFAULT_SETTINGS_FILE = path.join(PROJECT_DIR, 'cms-settings.yaml');
// Homepage's own default port. It is the suggestion shown in the setup form, not a
// value the editor uses on its own: a fresh install has no Homepage to point at.
const SUGGESTED_PREVIEW_URL = 'http://localhost:3000';

// Where the editor looks for its settings file. The file may point somewhere else
// (settingsPath), in which case this path only holds that pointer.
const BOOTSTRAP_FILE = process.env.HOMEPAGE_CMS_SETTINGS || DEFAULT_SETTINGS_FILE;

app.use(express.json({ limit: '10mb' }));
// The editor is a single page made of a hand-written template and a hand-written
// script. A browser that keeps an old copy of one of them and a new copy of the other
// makes Vue render with bindings that no longer exist, which kills the whole page.
// The files are tiny, so they are always fetched fresh instead of being cached.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store')
}));
// The browser needs a YAML writer, Vue and the icon font. All three are installed as
// packages and served from node_modules, so the editor works on a network without
// internet access.
app.use('/vendor/js-yaml', express.static(path.join(__dirname, 'node_modules', 'js-yaml', 'dist')));
app.use('/vendor/vue', express.static(path.join(__dirname, 'node_modules', 'vue', 'dist')));
app.use('/vendor/mdi', express.static(path.join(__dirname, 'node_modules', '@mdi', 'font')));

// ---- Settings -------------------------------------------------------------
// The editor's own settings live in a YAML file. It is read on every request, so a
// change made in the UI takes effect right away, except for the values the server
// binds at startup (port and address), which need a restart.

const ENV_BIND_ADDRESS = (process.env.HOST || '').trim();
const ENV_PORT = (process.env.PORT || '').trim();
const ENV_CONFIG_PATH = (process.env.HOMEPAGE_CONFIG_PATH || '').trim();
const ENV_BACKUP_PATH = (process.env.HOMEPAGE_BACKUP_PATH || '').trim();
const ENV_PREVIEW_URL = (process.env.HOMEPAGE_PREVIEW_URL || '').trim();
const ENV_PASSWORD = (process.env.HOMEPAGE_CMS_PASSWORD || '').trim();

// The bootstrap file is where the editor looks for its settings. When the settings
// live somewhere else, this file only holds a pointer to them.
function readBootstrap() {
  try {
    if (!fs.existsSync(BOOTSTRAP_FILE)) return {};
    const data = yaml.load(fs.readFileSync(BOOTSTRAP_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    console.warn(`Could not read ${BOOTSTRAP_FILE}: ${err.message}`);
    return {};
  }
}

function settingsPathSetting() {
  if (process.env.HOMEPAGE_CMS_SETTINGS) {
    return { value: path.resolve(process.env.HOMEPAGE_CMS_SETTINGS), source: 'env' };
  }
  const recorded = readBootstrap().settingsPath;
  if (typeof recorded === 'string' && recorded.trim()) {
    return { value: path.resolve(recorded.trim()), source: 'settings-file' };
  }
  return { value: DEFAULT_SETTINGS_FILE, source: 'default' };
}

function settingsFilePath() {
  return settingsPathSetting().value;
}

// A broken settings file must not stop the editor from starting, so reading failures
// degrade to "no settings" and the environment values apply.
function readCmsSettings() {
  const file = settingsFilePath();
  try {
    if (!fs.existsSync(file)) return {};
    const data = yaml.load(fs.readFileSync(file, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    console.warn(`Could not read ${file}: ${err.message}`);
    return {};
  }
}

function settingsExist() {
  return fs.existsSync(settingsFilePath());
}

// Deployment settings: the environment variable wins, because that is how a
// deployment (usually a container mount) says where things live.
function resolveDeploymentSetting(name, envValue, defaultValue) {
  if (envValue) return { value: envValue, source: 'env' };
  const fromFile = readCmsSettings()[name];
  if (typeof fromFile === 'string' && fromFile.trim()) {
    return { value: fromFile.trim(), source: 'settings-file' };
  }
  return { value: defaultValue, source: 'default' };
}

// User settings: what the user picked in the interface wins over the deployment
// default, because picking it was a deliberate act.
function resolveUserSetting(name, envValue, defaultValue) {
  const fromFile = readCmsSettings()[name];
  if (typeof fromFile === 'string' && fromFile.trim()) {
    return { value: fromFile.trim(), source: 'settings-file' };
  }
  if (envValue) return { value: envValue, source: 'env' };
  return { value: defaultValue, source: 'default' };
}

function asAbsolutePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(PROJECT_DIR, value);
}

function configDirSetting() {
  const r = resolveDeploymentSetting('configPath', ENV_CONFIG_PATH, DEFAULT_CONFIG_DIR);
  return { value: asAbsolutePath(r.value), source: r.source };
}

function backupDirSetting() {
  const r = resolveDeploymentSetting('backupPath', ENV_BACKUP_PATH, DEFAULT_BACKUP_DIR);
  return { value: asAbsolutePath(r.value), source: r.source };
}

function previewUrlSetting() {
  return resolveUserSetting('previewUrl', ENV_PREVIEW_URL, '');
}

function bindAddressSetting() {
  return resolveUserSetting('bindAddress', ENV_BIND_ADDRESS, DEFAULT_BIND_ADDRESS);
}

function portSetting() {
  return resolveDeploymentSetting('port', ENV_PORT, String(DEFAULT_PORT));
}

// The password may come from the environment or from the settings file, where it is
// stored as a hash.
function protectionSetting() {
  if (ENV_PASSWORD) return { enabled: true, source: 'env' };
  const p = readCmsSettings().protection;
  const stored = !!(p && typeof p === 'object' && p.salt && p.hash);
  if (stored && p.enabled) {
    return { enabled: true, source: 'settings-file', salt: p.salt, hash: p.hash };
  }
  // The password can stay stored while the switch is off: it is simply not verified.
  return { enabled: false, source: 'none', salt: stored ? p.salt : null, hash: stored ? p.hash : null };
}

function servicesFile() {
  return path.join(configDirSetting().value, 'services.yaml');
}

function bookmarksFile() {
  return path.join(configDirSetting().value, 'bookmarks.yaml');
}

// Older installs kept the editor's settings inside the Homepage config directory. Move
// them to the editor's own directory so that directory holds Homepage's files only.
function migrateLegacySettings() {
  const target = settingsFilePath();
  const legacy = path.join(configDirSetting().value, '.homepage-cms.yaml');
  if (fs.existsSync(target)) return;
  if (!fs.existsSync(legacy)) return;
  if (path.resolve(legacy) === path.resolve(target)) return;
  try {
    writeFileSafe(target, fs.readFileSync(legacy));
    fs.unlinkSync(legacy);
    console.log(`Moved editor settings from ${legacy} to ${target}`);
  } catch (err) {
    console.warn(`Could not move ${legacy}: ${err.message}`);
  }
}

function isValidBindAddress(value) {
  if (net.isIP(value)) return true;
  // A hostname, e.g. "localhost" or "cms.lan".
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(value);
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// What the server is actually bound to right now. Changing the address or the port
// only takes effect after a restart, so the UI needs both numbers.
const EFFECTIVE_BIND = bindAddressSetting().value;
const EFFECTIVE_PORT = portSetting().value;

function settingsPayload() {
  const preview = previewUrlSetting();
  const bind = bindAddressSetting();
  const port = portSetting();
  const config = configDirSetting();
  const backup = backupDirSetting();
  const settingsPath = settingsPathSetting();
  const protection = protectionSetting();
  const file = readCmsSettings();
  const fileValue = (key) => (typeof file[key] === 'string' && file[key].trim() ? file[key].trim() : null);
  return {
    initialized: settingsExist(),
    previewUrl: preview.value,
    previewUrlSource: preview.source,
    suggestedPreviewUrl: SUGGESTED_PREVIEW_URL,
    bindAddress: bind.value,
    bindAddressSource: bind.source,
    bindAddressEffective: EFFECTIVE_BIND,
    port: port.value,
    portSource: port.source,
    portEffective: EFFECTIVE_PORT,
    configPath: config.value,
    configPathSource: config.source,
    backupPath: backup.value,
    backupPathSource: backup.source,
    settingsPath: settingsPath.value,
    settingsPathSource: settingsPath.source,
    protection: {
      enabled: protection.enabled,
      source: protection.source,
      // A password can be stored even while the switch is off.
      stored: !!(protection.salt && protection.hash)
    },
    restartRequired: bind.value !== EFFECTIVE_BIND || String(port.value) !== String(EFFECTIVE_PORT),
    // What the user configured in the settings file, and what each field falls back
    // to when it is left empty. The form shows the first as the field value and the
    // second as the placeholder.
    fileValues: {
      previewUrl: fileValue('previewUrl'),
      bindAddress: fileValue('bindAddress'),
      port: fileValue('port'),
      configPath: fileValue('configPath'),
      backupPath: fileValue('backupPath'),
      settingsPath: fileValue('settingsPath')
    },
    placeholders: {
      previewUrl: ENV_PREVIEW_URL || SUGGESTED_PREVIEW_URL,
      bindAddress: ENV_BIND_ADDRESS || DEFAULT_BIND_ADDRESS,
      port: ENV_PORT || String(DEFAULT_PORT),
      configPath: ENV_CONFIG_PATH || DEFAULT_CONFIG_DIR,
      backupPath: ENV_BACKUP_PATH || DEFAULT_BACKUP_DIR,
      settingsPath: process.env.HOMEPAGE_CMS_SETTINGS || DEFAULT_SETTINGS_FILE
    }
  };
}

// Copy the current file into the backup directory before it is overwritten. Used for
// both the Homepage config files and the editor's own settings file.
function copyBackup(file, prefix) {
  if (!fs.existsSync(file)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDirSetting().value, `${prefix}-${timestamp}.yaml`);
  // Read and write instead of copying: a copy inherits the file's attributes, and on
  // Windows a file with the Hidden attribute cannot be opened for writing later on.
  writeFileSafe(target, fs.readFileSync(file));
}

// Write a file without depending on the attributes of an existing one. On Windows,
// opening a file that carries the Hidden attribute for writing fails with EPERM, and
// copying a file also copies those attributes, so a hidden file (a dot-prefixed name
// is hidden on Windows) would break every later save. Writing to a temporary file and
// renaming it over the target avoids the problem and makes the write atomic.
function writeFileSafe(file, content) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(temp, content, 'utf8');
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) {
      try { fs.unlinkSync(temp); } catch { /* the rename already moved it */ }
    }
  }
}

// A hash of the file as it was when the browser loaded it. If the file changed on disk
// in the meantime (another tool, or Homepage itself), a save would silently discard
// those changes, so the save is refused instead.
function fileHash(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

// Seed a fresh install from the committed examples so the editor has something to show
// on first run. An existing config is never touched.
function ensureConfigFiles() {
  const configDir = configDirSetting().value;
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  for (const name of ['services', 'bookmarks']) {
    const target = path.join(configDir, name + '.yaml');
    const example = path.join(PROJECT_DIR, 'config', name + '.example.yaml');
    if (!fs.existsSync(target) && fs.existsSync(example)) {
      writeFileSafe(target, fs.readFileSync(example));
      console.log(`Seeded ${target} from ${name}.example.yaml`);
    }
  }
}

function ensureBackupDir() {
  const dir = backupDirSetting().value;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

migrateLegacySettings();
ensureConfigFiles();
ensureBackupDir();

// GET /api/services - read services.yaml
// Every API needs the password when one is configured. The check is deliberately
// constant-time so a wrong password cannot be guessed by timing the response.
function passwordMatches(candidate) {
  const protection = protectionSetting();
  if (!protection.enabled) return true;
  if (!candidate) return false;
  if (protection.source === 'env') {
    const given = Buffer.from(candidate);
    const expected = Buffer.from(ENV_PASSWORD);
    if (given.length !== expected.length) return false;
    return crypto.timingSafeEqual(given, expected);
  }
  const derived = Buffer.from(hashPassword(candidate, protection.salt));
  const stored = Buffer.from(protection.hash);
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

app.use('/api', (req, res, next) => {
  if (req.path === '/auth') return next();
  if (!protectionSetting().enabled) return next();
  const header = req.get('X-CMS-Password') || '';
  const bearer = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!passwordMatches(header || bearer)) {
    return res.status(401).json({ success: false, error: '需要存取密碼' });
  }
  next();
});

// GET /api/auth - tells the browser whether a password is needed, without needing one
app.get('/api/auth', (req, res) => {
  const protection = protectionSetting();
  res.json({ success: true, data: { required: protection.enabled, source: protection.source } });
});

app.get('/api/services', (req, res) => {
  try {
    const file = servicesFile();
    if (!fs.existsSync(file)) {
      return res.json({ success: true, data: [], raw: '', hash: null });
    }
    const content = fs.readFileSync(file, 'utf8');
    const data = yaml.load(content);
    res.json({ success: true, data, raw: content, hash: fileHash(file) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookmarks - read bookmarks.yaml
app.get('/api/bookmarks', (req, res) => {
  try {
    const file = bookmarksFile();
    if (!fs.existsSync(file)) {
      return res.json({ success: true, data: [], raw: '', hash: null });
    }
    const content = fs.readFileSync(file, 'utf8');
    const data = yaml.load(content);
    res.json({ success: true, data, raw: content, hash: fileHash(file) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Refuse a save when the file changed on disk since the browser loaded it.
function checkUnchanged(file, expected) {
  if (!expected) return null;
  const current = fileHash(file);
  if (current === expected) return null;
  return '設定檔在載入後被其他程式改動過，請先重新載入再編輯，以免覆蓋那些變更';
}

// PUT /api/services - write services.yaml with backup
app.put('/api/services', (req, res) => {
  try {
    const file = servicesFile();
    const conflict = checkUnchanged(file, req.body?.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });
    const { raw } = req.body;

    // Create backup with timestamp
    copyBackup(file, 'services');

    // Write new content
    writeFileSafe(file, raw);

    res.json({ success: true, hash: fileHash(file) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/bookmarks - write bookmarks.yaml with backup
app.put('/api/bookmarks', (req, res) => {
  try {
    const file = bookmarksFile();
    const conflict = checkUnchanged(file, req.body?.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });
    const { raw } = req.body;

    // Create backup with timestamp
    copyBackup(file, 'bookmarks');

    // Write new content
    writeFileSafe(file, raw);

    res.json({ success: true, hash: fileHash(file) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/settings - the runtime settings the editor is running with
app.get('/api/settings', (req, res) => {
  res.json({ success: true, data: settingsPayload() });
});

// PUT /api/settings - store the editor's settings
app.put('/api/settings', (req, res) => {
  try {
    const body = req.body || {};
    const next = { ...readCmsSettings() };

    if (typeof body.previewUrl === 'string') {
      const value = body.previewUrl.trim();
      if (value) {
        let parsed;
        try {
          parsed = new URL(value);
        } catch {
          return res.status(400).json({ success: false, error: '預覽網址格式不正確' });
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return res.status(400).json({ success: false, error: '預覽網址必須以 http:// 或 https:// 開頭' });
        }
        next.previewUrl = value;
      } else {
        // An empty value clears the setting, so the env var (or the unset state) applies.
        delete next.previewUrl;
      }
    }

    if (typeof body.bindAddress === 'string') {
      const value = body.bindAddress.trim();
      if (value) {
        if (!isValidBindAddress(value)) {
          return res.status(400).json({ success: false, error: '監聽位址格式不正確' });
        }
        next.bindAddress = value;
      } else {
        delete next.bindAddress;
      }
    }

    if (typeof body.port === 'string') {
      const value = body.port.trim();
      if (value) {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          return res.status(400).json({ success: false, error: '連接埠必須是 1 到 65535 的整數' });
        }
        next.port = String(port);
      } else {
        delete next.port;
      }
    }

    // Paths. An empty value means "use the default", so the key is removed and the
    // default applies again.
    for (const key of ['configPath', 'backupPath']) {
      if (typeof body[key] !== 'string') continue;
      const value = body[key].trim();
      if (value) next[key] = asAbsolutePath(value);
      else delete next[key];
    }

    // Where the settings file itself lives. The environment variable wins, so the
    // interface cannot move the file away from where the deployment expects it. An
    // empty value keeps the current location; the bootstrap file holds a pointer to
    // it so the next start finds the settings again.
    let targetPath = settingsFilePath();
    if (typeof body.settingsPath === 'string' && body.settingsPath.trim() && !process.env.HOMEPAGE_CMS_SETTINGS) {
      const value = body.settingsPath.trim();
      targetPath = asAbsolutePath(value);
    }

    // Access protection. The password is stored as a hash, never in plain text. A
    // password in the environment wins: it is the deployment's own lock.
    if (ENV_PASSWORD) {
      // The environment decides; the interface value is ignored.
    } else if (body.protection && typeof body.protection === 'object') {
      if (body.protection.enabled) {
        const password = typeof body.protection.password === 'string' ? body.protection.password : '';
        if (password) {
          const salt = makeSalt();
          next.protection = { enabled: true, salt, hash: hashPassword(password, salt) };
        } else if (!next.protection || !next.protection.hash) {
          return res.status(400).json({ success: false, error: '啟用存取保護時必須設定密碼' });
        } else {
          // No new password: the stored one stays, even if the switch was off before.
          next.protection = { enabled: true, salt: next.protection.salt, hash: next.protection.hash };
        }
      } else {
        // Turning protection off keeps the stored password: it is simply not
        // verified while the switch is off, and turning it back on does not need a
        // new one.
        if (next.protection && next.protection.hash) {
          next.protection = { enabled: false, salt: next.protection.salt, hash: next.protection.hash };
        } else {
          delete next.protection;
        }
      }
    }

    const currentPath = settingsFilePath();
    // The pointer to the settings file lives in the bootstrap file, not in the
    // settings themselves.
    delete next.settingsPath;
    copyBackup(currentPath, 'settings');
    if (path.dirname(targetPath) && !fs.existsSync(path.dirname(targetPath))) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    }
    writeFileSafe(targetPath, yaml.dump(next));

    if (targetPath !== currentPath) {
      // The bootstrap file keeps a pointer, so the next start finds the settings again.
      copyBackup(BOOTSTRAP_FILE, 'settings');
      writeFileSafe(BOOTSTRAP_FILE, yaml.dump({ settingsPath: targetPath }));
    }

    ensureConfigFiles();
    ensureBackupDir();
    res.json({ success: true, data: settingsPayload() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/backups - list available backups
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(backupDirSetting().value)
      .filter(f => (f.startsWith('services-') || f.startsWith('settings-')) && f.endsWith('.yaml'))
      .sort()
      .reverse();
    res.json({ success: true, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/restore - restore from backup
app.post('/api/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    const backupFile = path.join(backupDirSetting().value, filename);
    if (!fs.existsSync(backupFile)) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }
    // A settings backup restores the editor's own settings; everything else restores
    // services.yaml.
    const isSettings = filename.startsWith('settings-');
    const target = isSettings ? settingsFilePath() : servicesFile();
    // Backup current before restore
    if (fs.existsSync(target)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix = isSettings ? 'settings-' : 'services-';
      const currentBackup = path.join(backupDirSetting().value, prefix + timestamp + '-prerestore.yaml');
      fs.copyFileSync(target, currentBackup);
    }
    writeFileSafe(target, fs.readFileSync(backupFile));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(Number(EFFECTIVE_PORT), EFFECTIVE_BIND, () => {
  const preview = previewUrlSetting();
  console.log(`Homepage Editor running at http://localhost:${EFFECTIVE_PORT}`);
  console.log(`Listening on: ${EFFECTIVE_BIND}`);
  console.log(`Config path: ${configDirSetting().value}`);
  console.log(`Backup path: ${backupDirSetting().value}`);
  console.log(`Settings file: ${settingsFilePath()}`);
  console.log(`Preview target: ${preview.value || '(not set)'} (${preview.source})`);
  if (!settingsExist()) {
    console.log('No editor settings found yet - the setup dialog opens on the first visit.');
  }
});
