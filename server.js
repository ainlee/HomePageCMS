const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

// Everything the editor needs to know about its environment comes from environment
// variables. The defaults are relative to the project directory, so a fresh clone works
// with no setup, and nothing here is tied to one particular deployment.
const HOST = process.env.HOST || '0.0.0.0';
const CONFIG_PATH = process.env.HOMEPAGE_CONFIG_PATH || path.join(__dirname, 'config');
const BACKUP_DIR = process.env.HOMEPAGE_BACKUP_PATH || path.join(__dirname, 'backups');
// The editor's own settings (currently just the preview target) live in a YAML file next
// to the Homepage config, following the same "settings are files on disk" convention.
const SETTINGS_FILE = process.env.HOMEPAGE_CMS_SETTINGS || path.join(CONFIG_PATH, '.homepage-cms.yaml');
const SERVICES_FILE = path.join(CONFIG_PATH, 'services.yaml');
const BOOKMARKS_FILE = path.join(CONFIG_PATH, 'bookmarks.yaml');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

function settingsPayload() {
  const { previewUrl, source } = resolvePreviewUrl();
  return {
    previewUrl,
    previewUrlSource: source,
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
app.get('/api/services', (req, res) => {
  try {
    if (!fs.existsSync(SERVICES_FILE)) {
      return res.json({ success: true, data: [], raw: '' });
    }
    const content = fs.readFileSync(SERVICES_FILE, 'utf8');
    const data = yaml.load(content);
    res.json({ success: true, data, raw: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookmarks - read bookmarks.yaml
app.get('/api/bookmarks', (req, res) => {
  try {
    if (!fs.existsSync(BOOKMARKS_FILE)) {
      return res.json({ success: true, data: [], raw: '' });
    }
    const content = fs.readFileSync(BOOKMARKS_FILE, 'utf8');
    const data = yaml.load(content);
    res.json({ success: true, data, raw: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/services - write services.yaml with backup
app.put('/api/services', (req, res) => {
  try {
    const { raw } = req.body;

    // Create backup with timestamp
    copyBackup(SERVICES_FILE, 'services');

    // Write new content
    fs.writeFileSync(SERVICES_FILE, raw, 'utf8');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/bookmarks - write bookmarks.yaml with backup
app.put('/api/bookmarks', (req, res) => {
  try {
    const { raw } = req.body;

    // Create backup with timestamp
    copyBackup(BOOKMARKS_FILE, 'bookmarks');

    // Write new content
    fs.writeFileSync(BOOKMARKS_FILE, raw, 'utf8');

    res.json({ success: true });
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
    const value = typeof req.body?.previewUrl === 'string' ? req.body.previewUrl.trim() : '';
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
    }
    copyBackup(SETTINGS_FILE, 'settings');
    fs.writeFileSync(SETTINGS_FILE, yaml.dump({ previewUrl: value }), 'utf8');
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

app.listen(PORT, HOST, () => {
  const { previewUrl, source } = resolvePreviewUrl();
  console.log(`Homepage Editor running at http://localhost:${PORT}`);
  console.log(`Config path: ${CONFIG_PATH}`);
  console.log(`Backup path: ${BACKUP_DIR}`);
  console.log(`Settings file: ${SETTINGS_FILE}`);
  console.log(`Preview target: ${previewUrl} (${source})`);
});
