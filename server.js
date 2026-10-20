const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3456;

// Everything the editor needs to know about its environment comes from environment
// variables. The defaults are relative to the project directory, so a fresh clone works
// with no setup, and nothing here is tied to one particular deployment.
const ENV_BIND_ADDRESS = (process.env.HOST || '').trim();
const DEFAULT_BIND_ADDRESS = '0.0.0.0';
// Optional shared password. Without it the editor stays open, which is fine on a
// trusted network; with it every write needs the password.
const API_PASSWORD = (process.env.HOMEPAGE_CMS_PASSWORD || '').trim();
const CONFIG_PATH = process.env.HOMEPAGE_CONFIG_PATH || path.join(__dirname, 'config');
const BACKUP_DIR = process.env.HOMEPAGE_BACKUP_PATH || path.join(__dirname, 'backups');
// The editor's own settings live in the editor's directory, not in the Homepage config
// directory: that directory belongs to Homepage (often a container mount or a shared
// NAS folder), and the editor's settings are not part of it.
const SETTINGS_FILE = process.env.HOMEPAGE_CMS_SETTINGS || path.join(__dirname, 'cms-settings.yaml');
const LEGACY_SETTINGS_FILE = path.join(CONFIG_PATH, '.homepage-cms.yaml');
const SERVICES_FILE = path.join(CONFIG_PATH, 'services.yaml');
const BOOKMARKS_FILE = path.join(CONFIG_PATH, 'bookmarks.yaml');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// The browser needs a YAML writer, Vue and the icon font. All three are installed as
// packages and served from node_modules, so the editor works on a network without
// internet access.
app.use('/vendor/js-yaml', express.static(path.join(__dirname, 'node_modules', 'js-yaml', 'dist')));
app.use('/vendor/vue', express.static(path.join(__dirname, 'node_modules', 'vue', 'dist')));
app.use('/vendor/mdi', express.static(path.join(__dirname, 'node_modules', '@mdi', 'font')));

// Ensure directories exist
if (!fs.existsSync(CONFIG_PATH)) fs.mkdirSync(CONFIG_PATH, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// The editor's settings file. A broken file must not stop the editor from starting, so
// reading failures degrade to "no settings" and the preview falls back to the env value.
function readCmsSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    const data = yaml.load(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    console.warn(`Could not read ${SETTINGS_FILE}: ${err.message}`);
    return {};
  }
}

// Older installs kept the editor's settings inside the Homepage config directory. Move
// them to the editor's own directory so that directory holds Homepage's files only.
function migrateLegacySettings() {
  if (fs.existsSync(SETTINGS_FILE)) return;
  if (!fs.existsSync(LEGACY_SETTINGS_FILE)) return;
  if (path.resolve(LEGACY_SETTINGS_FILE) === path.resolve(SETTINGS_FILE)) return;
  try {
    fs.copyFileSync(LEGACY_SETTINGS_FILE, SETTINGS_FILE);
    fs.unlinkSync(LEGACY_SETTINGS_FILE);
    console.log(`Moved editor settings from ${LEGACY_SETTINGS_FILE} to ${SETTINGS_FILE}`);
  } catch (err) {
    console.warn(`Could not move ${LEGACY_SETTINGS_FILE}: ${err.message}`);
  }
}

migrateLegacySettings();

// Precedence: settings file > HOMEPAGE_PREVIEW_URL > nothing. There is no built-in
// default: a fresh install has no Homepage to point at, and guessing one would show an
// unrelated error page in the preview. The source is reported back so the UI can tell
// the user where the current value came from.
function resolvePreviewUrl() {
  const fromFile = readCmsSettings().previewUrl;
  if (typeof fromFile === 'string' && fromFile.trim()) {
    return { previewUrl: fromFile.trim(), source: 'settings-file' };
  }
  const fromEnv = (process.env.HOMEPAGE_PREVIEW_URL || '').trim();
  if (fromEnv) return { previewUrl: fromEnv, source: 'env' };
  return { previewUrl: '', source: 'unset' };
}

// The address the editor listens on. Opening it up beyond localhost means anyone who
// can reach it can rewrite the Homepage config, so the UI shows that next to the option.
function resolveBindAddress() {
  const fromFile = readCmsSettings().bindAddress;
  if (typeof fromFile === 'string' && fromFile.trim()) {
    return { bindAddress: fromFile.trim(), source: 'settings-file' };
  }
  if (ENV_BIND_ADDRESS) return { bindAddress: ENV_BIND_ADDRESS, source: 'env' };
  return { bindAddress: DEFAULT_BIND_ADDRESS, source: 'default' };
}

function isValidBindAddress(value) {
  if (net.isIP(value)) return true;
  // A hostname, e.g. "localhost" or "cms.lan".
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(value);
}

// What the server is actually bound to right now. A change to the bind address only
// takes effect after a restart, so the UI needs both numbers.
const EFFECTIVE_BIND = resolveBindAddress();
const EFFECTIVE_BIND_ADDRESS = EFFECTIVE_BIND.bindAddress;
const EFFECTIVE_BIND_SOURCE = EFFECTIVE_BIND.source;

function settingsPayload() {
  const { previewUrl, source } = resolvePreviewUrl();
  const configured = resolveBindAddress();
  return {
    previewUrl,
    previewUrlSource: source,
    bindAddress: configured.bindAddress,
    bindAddressConfiguredSource: configured.source,
    bindAddressSource: EFFECTIVE_BIND_SOURCE,
    bindAddressEffective: EFFECTIVE_BIND_ADDRESS,
    restartRequired: configured.bindAddress !== EFFECTIVE_BIND_ADDRESS,
    configPath: CONFIG_PATH,
    backupPath: BACKUP_DIR,
    settingsPath: SETTINGS_FILE
  };
}

// Copy the current file into the backup directory before it is overwritten. Used for
// both the Homepage config files and the editor's own settings file.
function copyBackup(file, prefix) {
  if (!fs.existsSync(file)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file, path.join(BACKUP_DIR, `${prefix}-${timestamp}.yaml`));
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
for (const name of ['services', 'bookmarks']) {
  const target = path.join(CONFIG_PATH, name + '.yaml');
  const example = path.join(__dirname, 'config', name + '.example.yaml');
  if (!fs.existsSync(target) && fs.existsSync(example)) {
    fs.copyFileSync(example, target);
    console.log(`Seeded ${target} from ${name}.example.yaml`);
  }
}

// GET /api/services - read services.yaml
// Every API needs the password when one is configured. The check is deliberately
// constant-time so a wrong password cannot be guessed by timing the response.
function passwordMatches(candidate) {
  if (!API_PASSWORD) return true;
  if (!candidate) return false;
  const given = Buffer.from(candidate);
  const expected = Buffer.from(API_PASSWORD);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

app.use('/api', (req, res, next) => {
  if (req.path === '/auth') return next();
  if (!API_PASSWORD) return next();
  const header = req.get('X-CMS-Password') || '';
  const bearer = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!passwordMatches(header || bearer)) {
    return res.status(401).json({ success: false, error: '需要存取密碼' });
  }
  next();
});

// GET /api/auth - tells the browser whether a password is needed, without needing one
app.get('/api/auth', (req, res) => {
  res.json({ success: true, data: { required: !!API_PASSWORD } });
});

app.get('/api/services', (req, res) => {
  try {
    if (!fs.existsSync(SERVICES_FILE)) {
      return res.json({ success: true, data: [], raw: '', hash: null });
    }
    const content = fs.readFileSync(SERVICES_FILE, 'utf8');
    const data = yaml.load(content);
    res.json({ success: true, data, raw: content, hash: fileHash(SERVICES_FILE) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookmarks - read bookmarks.yaml
app.get('/api/bookmarks', (req, res) => {
  try {
    if (!fs.existsSync(BOOKMARKS_FILE)) {
      return res.json({ success: true, data: [], raw: '', hash: null });
    }
    const content = fs.readFileSync(BOOKMARKS_FILE, 'utf8');
    const data = yaml.load(content);
    res.json({ success: true, data, raw: content, hash: fileHash(BOOKMARKS_FILE) });
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
    const conflict = checkUnchanged(SERVICES_FILE, req.body?.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });
    const { raw } = req.body;

    // Create backup with timestamp
    copyBackup(SERVICES_FILE, 'services');

    // Write new content
    fs.writeFileSync(SERVICES_FILE, raw, 'utf8');

    res.json({ success: true, hash: fileHash(SERVICES_FILE) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/bookmarks - write bookmarks.yaml with backup
app.put('/api/bookmarks', (req, res) => {
  try {
    const conflict = checkUnchanged(BOOKMARKS_FILE, req.body?.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });
    const { raw } = req.body;

    // Create backup with timestamp
    copyBackup(BOOKMARKS_FILE, 'bookmarks');

    // Write new content
    fs.writeFileSync(BOOKMARKS_FILE, raw, 'utf8');

    res.json({ success: true, hash: fileHash(BOOKMARKS_FILE) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/settings - the runtime settings the editor is running with
app.get('/api/settings', (req, res) => {
  res.json({ success: true, data: settingsPayload() });
});

// PUT /api/settings - store the preview target in the editor's settings file
app.put('/api/settings', (req, res) => {
  try {
    const next = { ...readCmsSettings() };

    if (typeof req.body?.previewUrl === 'string') {
      const value = req.body.previewUrl.trim();
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

    if (typeof req.body?.bindAddress === 'string') {
      const value = req.body.bindAddress.trim();
      if (value) {
        if (!isValidBindAddress(value)) {
          return res.status(400).json({ success: false, error: '監聽位址格式不正確' });
        }
        next.bindAddress = value;
      } else {
        delete next.bindAddress;
      }
    }

    copyBackup(SETTINGS_FILE, 'settings');
    fs.writeFileSync(SETTINGS_FILE, yaml.dump(next), 'utf8');
    res.json({ success: true, data: settingsPayload() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/backups - list available backups
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
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
    const backupFile = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(backupFile)) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }
    // A settings backup restores the editor's own settings; everything else restores
    // services.yaml.
    const isSettings = filename.startsWith('settings-');
    const target = isSettings ? SETTINGS_FILE : SERVICES_FILE;
    // Backup current before restore
    if (fs.existsSync(target)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix = isSettings ? 'settings-' : 'services-';
      const currentBackup = path.join(BACKUP_DIR, prefix + timestamp + '-prerestore.yaml');
      fs.copyFileSync(target, currentBackup);
    }
    fs.copyFileSync(backupFile, target);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, EFFECTIVE_BIND_ADDRESS, () => {
  const { previewUrl, source } = resolvePreviewUrl();
  console.log(`Homepage Editor running at http://localhost:${PORT}`);
  console.log(`Listening on: ${EFFECTIVE_BIND_ADDRESS}`);
  console.log(`Config path: ${CONFIG_PATH}`);
  console.log(`Backup path: ${BACKUP_DIR}`);
  console.log(`Settings file: ${SETTINGS_FILE}`);
  console.log(`Preview target: ${previewUrl} (${source})`);
});
