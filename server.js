const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const i18n = require('./lib/i18n');
const themeLib = require('./lib/themes');
const appearanceLib = require('./lib/homepage-appearance');
const layoutLib = require('./lib/homepage-layout');
const customCssLib = require('./lib/custom-css');
const { parseIni } = require('./lib/ini');
// The version and the repository come from the package file, so the version in the
// interface is always the version that is running.
const pkg = require('./package.json');

const app = express();
// The whole editor can be mounted under a subpath (e.g. /cms behind a tunnel) so the
// dashboard stays at the root of the domain. Every route lives in one router and is
// mounted at BASE_PATH; Express strips that prefix so the handlers below are unchanged.
// An empty BASE_PATH mounts at the root (current behaviour).
const appRouter = express.Router();
// Runtime state such as the access-password policy must never be served from a cache,
// so disable ETags entirely and rely on the explicit Cache-Control headers below.
app.set('etag', false);
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
// The language packs and the colour schemes live in their own directories, next to
// the editor, so a user can add their own file without touching the Homepage config.
const DEFAULT_LOCALES_DIR = path.join(PROJECT_DIR, 'locales');
const DEFAULT_THEMES_DIR = path.join(PROJECT_DIR, 'themes');
const DEFAULT_THEME = 'midnight';
// Homepage's own default port. It is the suggestion shown in the setup form, not a
// value the editor uses on its own: a fresh install has no Homepage to point at.
const SUGGESTED_PREVIEW_URL = 'http://localhost:3000';

// Where the editor looks for its settings file. The file may point somewhere else
// (settingsPath), in which case this path only holds that pointer.
const BOOTSTRAP_FILE = process.env.HOMEPAGE_CMS_SETTINGS || DEFAULT_SETTINGS_FILE;

app.use(express.json({ limit: '10mb' }));
// The page is served with the current language and colour scheme already applied,
// so a reload does not show the default dark theme or the wrong language first.
appRouter.get('/', renderIndex);
appRouter.get('/index.html', renderIndex);
// The editor is a single page made of a hand-written template and a hand-written
// script. A browser that keeps an old copy of one of them and a new copy of the other
// makes Vue render with bindings that no longer exist, which kills the whole page.
// The files are tiny, so they are always fetched fresh instead of being cached.
appRouter.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store')
}));
// The browser needs a YAML writer, Vue and the icon font. All three are installed as
// packages and served from node_modules, so the editor works on a network without
// internet access.
appRouter.use('/vendor/js-yaml', express.static(path.join(__dirname, 'node_modules', 'js-yaml', 'dist')));
appRouter.use('/vendor/vue', express.static(path.join(__dirname, 'node_modules', 'vue', 'dist')));
appRouter.use('/vendor/mdi', express.static(path.join(__dirname, 'node_modules', '@mdi', 'font')));
// The colour ramp maths, shared with the browser so both use the same one.
appRouter.get('/vendor/ramp.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/javascript').send(fs.readFileSync(path.join(PROJECT_DIR, 'lib', 'ramp.js'), 'utf8'));
});

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
const ENV_LOCALES_PATH = (process.env.HOMEPAGE_CMS_LOCALES_PATH || '').trim();
const ENV_THEMES_PATH = (process.env.HOMEPAGE_CMS_THEMES_PATH || '').trim();
const ENV_LOCALE = (process.env.HOMEPAGE_CMS_LOCALE || '').trim();
const REVALIDATE_URL = (process.env.HOMEPAGE_CMS_REVALIDATE_URL || '').trim();
// The updater sidecar, when deployed as a separate container (the docker
// layout). When set, the upgrade API forwards to it instead of pulling this
// checkout: the sidecar owns the git repo and the published snapshots.
const UPDATE_PROXY = (process.env.HOMEPAGE_CMS_UPDATE_PROXY || '').trim();
// Mount prefix for the editor ('/cms'); '' means the root. Leading slash, no trailing.
const RAW_BASE = (process.env.HOMEPAGE_CMS_BASE_PATH || '').trim();
const BASE_PATH = RAW_BASE ? '/' + RAW_BASE.replace(/^\/+/, '').replace(/\/+$/, '') : '';

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

// Where the language packs live. A path, so the environment variable wins.
function localesDirSetting() {
  const r = resolveDeploymentSetting('localesPath', ENV_LOCALES_PATH, DEFAULT_LOCALES_DIR);
  return { value: asAbsolutePath(r.value), source: r.source };
}

// Where the colour schemes live. A path, so the environment variable wins.
function themesDirSetting() {
  const r = resolveDeploymentSetting('themesPath', ENV_THEMES_PATH, DEFAULT_THEMES_DIR);
  return { value: asAbsolutePath(r.value), source: r.source };
}

// The interface language. The settings file wins over the environment: choosing a
// language in the interface is a deliberate act.
function localeSetting() {
  return resolveUserSetting('locale', ENV_LOCALE, i18n.DEFAULT_LOCALE);
}

// The colour scheme. Same rule: what the user picked wins.
function themeSetting() {
  return resolveUserSetting('theme', '', DEFAULT_THEME);
}

// The catalogue of one language, or of the language in effect.
function catalogFor(code) {
  return i18n.localePayload(localesDirSetting().value, code || localeSetting().value).catalog;
}

// Every colour scheme, with the display name the current language uses.
function themeList() {
  const catalog = catalogFor(localeSetting().value);
  return themeLib.listThemes(themesDirSetting().value).map((theme) => ({
    ...theme,
    name: catalog['themes.' + theme.id] || theme.name
  }));
}

// The colour scheme in effect.
function activeTheme() {
  const list = themeList();
  const wanted = themeSetting().value;
  return list.find((t) => t.id === wanted && !t.error)
    || list.find((t) => t.id === DEFAULT_THEME && !t.error)
    || list.find((t) => !t.error)
    || null;
}

// JSON inside a <script> tag must not be able to close the tag.
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

// The page is rendered with the language and the colour scheme already applied, so a
// reload shows the right theme straight away instead of flashing the default one.
function renderIndex(req, res) {
  const file = path.join(PROJECT_DIR, 'public', 'index.html');
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return res.status(500).type('text/plain').send('Could not read index.html: ' + err.message);
  }
  const payload = i18n.localePayload(localesDirSetting().value, localeSetting().value);
  const theme = activeTheme();
  const vars = theme ? themeLib.themeVars(theme) : {};
  const styleBlock = '<style id="hcms-theme">:root{' +
    Object.entries(vars).map(([name, value]) => name + ':' + value).join(';') + '}</style>';
  html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    '<link rel="stylesheet" href="style.css">\n    ' + styleBlock
  );
  html = html.replace('<html lang="zh-TW">', '<html lang="' + payload.locale + '">');
  // <base> makes the relative asset URLs in the page resolve under the mount
  // path (e.g. /cms/); at the root it simply points at '/'.
  html = html.replace('<head>', '<head><base href="' + (BASE_PATH ? BASE_PATH + '/' : '/') + '">');
  const boot = '<script>window.__I18N__=' + safeJson(payload) + ';window.__THEME__=' +
    safeJson({ id: theme ? theme.id : '', name: theme ? theme.name : '', vars }) +
    ';window.__META__=' + safeJson({
      name: 'HomePageCMS',
      version: pkg.version,
      repo: (pkg.repository && pkg.repository.url) || '',
      basePath: BASE_PATH
    }) + ';</script>';
  html = html.replace('<script src="app.js"></script>', boot + '\n  <script src="app.js"></script>');
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(html);
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

// Homepage's information widgets, shown in a strip at the top of the dashboard.
function widgetsFile() {
  return path.join(configDirSetting().value, 'widgets.yaml');
}

// Homepage's own settings file. It holds the appearance of the dashboard, and the
// editor writes the visual fields of it.
function homepageSettingsFile() {
  return path.join(configDirSetting().value, 'settings.yaml');
}

// The stylesheet Homepage loads on top of its own. It is the official place for
// custom CSS, and the only way to change a colour that Homepage has no setting for.
function homepageCustomCssFile() {
  return path.join(configDirSetting().value, 'custom.css');
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
  const locale = localeSetting();
  const theme = themeSetting();
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
    // The interface language and the colour scheme are user preferences, so they
    // come from the settings file first.
    locale: locale.value,
    localeSource: locale.source,
    theme: theme.value,
    themeSource: theme.source,
    localesDir: localesDirSetting().value,
    themesDir: themesDirSetting().value,
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
// both the Homepage config files and the editor's own settings file. The extension
// says what kind of file the backup holds.
function copyBackup(file, prefix, extension) {
  if (!fs.existsSync(file)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDirSetting().value, `${prefix}-${timestamp}.${extension || 'yaml'}`);
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
  for (const name of ['services', 'bookmarks', 'widgets']) {
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

appRouter.use('/api', (req, res, next) => {
  // The password policy and every other piece of runtime state are decided on the
  // server and must not be cached by a browser or an intermediate proxy: a stale
  // /api/auth answer is exactly how one device ends up thinking no password is
  // needed while another device asks for one.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  // The browser tells the server which language it is showing, so the messages that
  // come back are in the same language.
  const requested = (req.query && typeof req.query.locale === 'string' ? req.query.locale : '').trim()
    || (req.get('Accept-Language') || '').split(',')[0].split(';')[0].trim();
  const catalog = catalogFor(requested || localeSetting().value);
  const send = res.json.bind(res);
  res.json = (payload) => {
    if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
      payload.error = i18n.localizeMessage(catalog, payload.error);
    }
    return send(payload);
  };
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
appRouter.get('/api/auth', (req, res) => {
  const protection = protectionSetting();
  res.json({ success: true, data: { required: protection.enabled, source: protection.source } });
});

appRouter.get('/api/services', (req, res) => {
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
appRouter.get('/api/bookmarks', (req, res) => {
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
appRouter.put('/api/services', (req, res) => {
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
appRouter.put('/api/bookmarks', (req, res) => {
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

// GET /api/widgets - read widgets.yaml
appRouter.get('/api/widgets', (req, res) => {
  try {
    const file = widgetsFile();
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

// PUT /api/widgets - write widgets.yaml with backup
appRouter.put('/api/widgets', (req, res) => {
  try {
    const file = widgetsFile();
    const conflict = checkUnchanged(file, req.body?.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });
    const { raw } = req.body;

    copyBackup(file, 'widgets');
    writeFileSafe(file, raw);
    res.json({ success: true, hash: fileHash(file) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Homepage's settings.yaml has a comment header that points at the documentation.
// It is kept as it is, so a file the user wrote by hand does not lose its comments.
const HOMEPAGE_SETTINGS_HEADER =
  '---\n# For configuration options and examples, please see:\n' +
  '# https://gethomepage.dev/configs/settings/\n\n';

function settingsHeader(content) {
  const lines = String(content || '').split('\n');
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed === '---' || trimmed.startsWith('#')) {
      kept.push(line);
      continue;
    }
    break;
  }
  return kept.join('\n').replace(/\n+$/, '');
}

// GET /api/homepage-settings - the appearance of the Homepage dashboard
appRouter.get('/api/homepage-settings', (req, res) => {
  try {
    const file = homepageSettingsFile();
    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file, 'utf8') : '';
    let settings = {};
    if (exists) {
      const parsed = yaml.load(content);
      if (parsed && typeof parsed === 'object') settings = parsed;
    }
    res.json({
      success: true,
      data: {
        values: appearanceLib.readAppearance(settings),
        palette: appearanceLib.palette(),
        shades: appearanceLib.SHADE_NAMES,
        choices: appearanceLib.CHOICES,
        exists,
        path: file
      },
      hash: fileHash(file)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/homepage-settings - write the appearance fields of settings.yaml
appRouter.put('/api/homepage-settings', (req, res) => {
  try {
    const file = homepageSettingsFile();
    const conflict = checkUnchanged(file, req.body && req.body.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });

    const values = (req.body && req.body.values) || {};
    // A value that is not a single line cannot go into the file, and a value that
    // long is not one of Homepage's choices.
    for (const [key, value] of Object.entries(values)) {
      if (typeof value !== 'string') continue;
      if (/[\r\n]/.test(value) || value.length > 300) {
        return res.status(400).json({ success: false, error: '設定值格式不正確: ' + key });
      }
    }

    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file, 'utf8') : '';
    let settings = {};
    if (exists) {
      const parsed = yaml.load(content);
      if (parsed && typeof parsed === 'object') settings = parsed;
    }
    const next = appearanceLib.applyAppearance(settings, values);
    const header = settingsHeader(content) || HOMEPAGE_SETTINGS_HEADER.trimEnd();
    const output = header + '\n\n' + yaml.dump(next);

    // Nothing changed: leave the file alone, so saving does not churn the file or
    // the backups.
    if (exists && content === output) {
      return res.json({ success: true, data: { values: appearanceLib.readAppearance(next), unchanged: true }, hash: fileHash(file) });
    }

    copyBackup(file, 'homepage-settings');
    writeFileSafe(file, output);
    res.json({
      success: true,
      data: { values: appearanceLib.readAppearance(next) },
      hash: fileHash(file)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/homepage-layout - the layout block and the global switches of settings.yaml
appRouter.get('/api/homepage-layout', (req, res) => {
  try {
    const file = homepageSettingsFile();
    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file, 'utf8') : '';
    let settings = {};
    if (exists) {
      const parsed = yaml.load(content);
      if (parsed && typeof parsed === 'object') settings = parsed;
    }
    res.json({
      success: true,
      data: {
        groups: layoutLib.readLayoutGroups(settings),
        values: layoutLib.readGlobalValues(settings),
        choices: {
          style: layoutLib.STYLE_CHOICES,
          target: ['_blank', '_self', '_top'],
          bookmarksStyle: ['default', 'icons'],
          statusStyle: ['dot', 'basic']
        },
        exists,
        path: file
      },
      hash: fileHash(file)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/homepage-layout - write the layout block and the global switches back
appRouter.put('/api/homepage-layout', (req, res) => {
  try {
    const file = homepageSettingsFile();
    const conflict = checkUnchanged(file, req.body && req.body.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });
    const body = req.body || {};
    const values = body.values || {};
    const groups = Array.isArray(body.groups) ? body.groups : [];
    for (const group of groups) {
      if (!group || typeof group.name !== 'string') {
        return res.status(400).json({ success: false, error: '版面群組名稱不正確' });
      }
      if (group.name.length > 120 || /[\r\n]/.test(group.name)) {
        return res.status(400).json({ success: false, error: '版面群組名稱不正確' });
      }
    }

    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file, 'utf8') : '';
    let settings = {};
    if (exists) {
      const parsed = yaml.load(content);
      if (parsed && typeof parsed === 'object') settings = parsed;
    }
    const next = layoutLib.applyLayoutSettings(settings, values, groups);
    const header = settingsHeader(content) || HOMEPAGE_SETTINGS_HEADER.trimEnd();
    const output = header + '\n\n' + yaml.dump(next);

    if (exists && content === output) {
      return res.json({ success: true, data: { groups: layoutLib.readLayoutGroups(next), values: layoutLib.readGlobalValues(next), unchanged: true }, hash: fileHash(file) });
    }

    copyBackup(file, 'homepage-settings');
    writeFileSafe(file, output);
    res.json({
      success: true,
      data: { groups: layoutLib.readLayoutGroups(next), values: layoutLib.readGlobalValues(next) },
      hash: fileHash(file)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/homepage-custom-css - the stylesheet Homepage loads on top of its own
appRouter.get('/api/homepage-custom-css', (req, res) => {
  try {
    const file = homepageCustomCssFile();
    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file, 'utf8') : '';
    // The file is taken apart, so the editor can work on the font, on each
    // palette and on the content the user wrote themselves.
    const parts = customCssLib.parse(content);
    const themes = {};
    for (const [id, body] of Object.entries(parts.themes)) {
      themes[id] = { css: body, seed: customCssLib.seedOf(body) };
    }
    res.json({
      success: true,
      data: {
        content,
        parts: { font: parts.font, themes, free: parts.free },
        official: appearanceLib.PALETTE_IDS.reduce((out, id) => {
          out[id] = appearanceLib.officialColor(id);
          return out;
        }, {}),
        exists,
        path: file
      },
      hash: fileHash(file)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/homepage-custom-css - write custom.css with a backup
//
// The editor sends the parts it holds, and the server assembles them: the font
// block first (an @import only works at the top of a stylesheet), then one block
// per customised palette, then the content the user wrote themselves.
appRouter.put('/api/homepage-custom-css', (req, res) => {
  try {
    const file = homepageCustomCssFile();
    const conflict = checkUnchanged(file, req.body && req.body.hash);
    if (conflict) return res.status(409).json({ success: false, error: conflict });

    const body = req.body || {};
    const parts = body.parts;
    if (!parts || typeof parts !== 'object') {
      return res.status(400).json({ success: false, error: '設定值格式不正確: parts' });
    }
    const themes = {};
    const given = parts.themes && typeof parts.themes === 'object' ? parts.themes : {};
    for (const [id, value] of Object.entries(given)) {
      const css = typeof value === 'string' ? value : (value && typeof value.css === 'string' ? value.css : '');
      if (!css.trim()) continue;
      if (!appearanceLib.PALETTE[id]) {
        return res.status(400).json({ success: false, error: '設定值格式不正確: theme' });
      }
      themes[id] = css;
    }
    const font = parts.font && typeof parts.font === 'object' ? parts.font : {};
    const content = customCssLib.assemble({
      font: {
        cdn: String(font.cdn || ''),
        kind: String(font.kind || ''),
        families: Array.isArray(font.families) ? font.families.map(String) : [],
        local: String(font.local || '')
      },
      themes,
      free: String(parts.free || '')
    });
    // The file is served to every visitor of the dashboard, so it stays small.
    if (content.length > 1024 * 1024) {
      return res.status(400).json({ success: false, error: '設定值格式不正確: content' });
    }

    const exists = fs.existsSync(file);
    if (exists && fs.readFileSync(file, 'utf8') === content) {
      return res.json({ success: true, data: { unchanged: true }, hash: fileHash(file) });
    }

    copyBackup(file, 'homepage-custom-css', 'css');
    writeFileSafe(file, content);
    res.json({ success: true, data: { content }, hash: fileHash(file) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/homepage-custom-css/ramp - a colour ramp for a seed colour
appRouter.post('/api/homepage-custom-css/ramp', (req, res) => {
  try {
    const body = req.body || {};
    const paletteId = String(body.palette || '').trim();
    const seed = String(body.seed || '').trim();
    if (!appearanceLib.PALETTE[paletteId]) {
      return res.status(400).json({ success: false, error: '設定值格式不正確: palette' });
    }
    const shades = appearanceLib.generateRamp(seed);
    if (!shades) {
      return res.status(400).json({ success: false, error: '設定值格式不正確: seed' });
    }
    res.json({ success: true, data: { shades, css: appearanceLib.rampCss(paletteId, shades) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/homepage-font-probe - find out what a font address holds
//
// The address the user types is either a stylesheet with font-face rules, or a
// font file. The editor needs to know which, and for a stylesheet it needs the
// family names inside it, so the user does not have to spell them out.
appRouter.post('/api/homepage-font-probe', async (req, res) => {
  const url = String((req.body && req.body.url) || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ success: false, error: '設定值格式不正確: url' });
  }
  // Only a part of the file is read: a font file is bigger than what is needed
  // to recognise it, and the editor is a local tool, so the read is kept small.
  const LIMIT = 512 * 1024;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomePageCMS)' },
      signal: AbortSignal.timeout(15000)
    });
    const type = (response.headers.get('content-type') || '').toLowerCase();
    const looksLikeFont = /font|woff|ttf|otf/.test(type) ||
      /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url);
    if (!response.ok) {
      return res.status(400).json({ success: false, error: '無法讀取該網址（' + response.status + '）' });
    }
    if (looksLikeFont) {
      return res.json({
        success: true,
        // A font file does not say what it is called, and it does not have to:
        // the editor gives it a label of its own.
        data: { kind: 'font', families: [], status: response.status }
      });
    }
    const text = await readAtMost(response, LIMIT);
    const families = [];
    const pattern = /font-family:\s*["']?([^;"']+)["']?\s*;/g;
    let match;
    while ((match = pattern.exec(text))) {
      const name = match[1].trim();
      if (name && !families.includes(name)) families.push(name);
    }
    res.json({
      success: true,
      data: { kind: families.length ? 'css' : 'unknown', families, status: response.status }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: '無法讀取該網址: ' + err.message });
  }
});

// Read at most a number of bytes from a response.
async function readAtMost(response, limit) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let read = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      read += value.length;
      if (read >= limit) break;
    }
  } finally {
    try { await reader.cancel(); } catch { /* the rest is not needed */ }
  }
  return text + decoder.decode();
}

// POST /api/homepage-revalidate - make the dashboard forget its cached settings
//
// Homepage keeps the whole dashboard payload in the memory of its process, and
// only /api/revalidate clears it. Without this the preview would keep showing the
// old colours after a save. The call goes out from the server, so it is not
// stopped by the browser's cross-origin rules.
appRouter.post('/api/homepage-revalidate', async (req, res) => {
  // The dedicated revalidate URL (HOMEPAGE_CMS_REVALIDATE_URL) wins, so a container can
  // point at the Homepage service name on the shared docker network; otherwise the
  // preview URL is used (current behaviour).
  const targetBase = REVALIDATE_URL || previewUrlSetting().value;
  if (!targetBase) {
    return res.status(400).json({ success: false, error: '尚未設定預覽網址' });
  }
  let target;
  try {
    target = new URL('/api/revalidate', targetBase).toString();
  } catch (err) {
    return res.status(400).json({ success: false, error: '預覽網址格式不正確' });
  }
  try {
    const response = await fetch(target, { method: 'GET', headers: { Accept: 'application/json' } });
    // The endpoint answers with JSON when it worked. When the dashboard has
    // access protection, it answers with something else and the caller has to
    // press the refresh button on the dashboard itself.
    const ok = response.ok && (response.headers.get('content-type') || '').includes('application/json');
    res.json({ success: !!ok, data: { status: response.status, revalidated: !!ok } });
  } catch (err) {
    res.json({ success: false, data: { error: err.message } });
  }
});

// GET /api/settings - the runtime settings the editor is running with
appRouter.get('/api/settings', (req, res) => {
  res.json({ success: true, data: settingsPayload() });
});

// PUT /api/settings - store the editor's settings
appRouter.put('/api/settings', (req, res) => {
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
    // The interface language and the colour scheme. Both are user preferences, so
    // they are stored in the settings file and survive a restart.
    if (typeof body.locale === 'string') {
      const value = body.locale.trim();
      if (value) {
        const known = i18n.listLocales(localesDirSetting().value)
          .some((l) => l.code === value && !l.error);
        if (!known) {
          return res.status(400).json({ success: false, error: '找不到語系「' + value + '」' });
        }
        next.locale = value;
      } else {
        delete next.locale;
      }
    }

    if (typeof body.theme === 'string') {
      const value = body.theme.trim();
      if (value) {
        const known = themeList().some((t) => t.id === value && !t.error);
        if (!known) {
          return res.status(400).json({ success: false, error: '找不到主題「' + value + '」' });
        }
        next.theme = value;
      } else {
        delete next.theme;
      }
    }

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

// GET /api/i18n - the language packs in the directory and the catalogue of one of them
appRouter.get('/api/i18n', (req, res) => {
  const code = String((req.query && req.query.locale) || localeSetting().value || '').trim();
  res.json({ success: true, data: i18n.localePayload(localesDirSetting().value, code) });
});

// GET /api/themes - every colour scheme, built-in and user-made
appRouter.get('/api/themes', (req, res) => {
  res.json({
    success: true,
    data: {
      themes: themeList(),
      tokens: themeLib.COLOR_TOKENS,
      options: themeLib.OPTION_TOKENS
    }
  });
});

// GET /api/themes/:id/export - the scheme as INI text, so it can be shared
appRouter.get('/api/themes/:id/export', (req, res) => {
  const id = String(req.params.id || '').trim();
  const file = path.join(themesDirSetting().value, id + '.ini');
  if (!themeLib.isValidId(id) || !fs.existsSync(file)) {
    return res.status(404).json({ success: false, error: '找不到主題「' + id + '」' });
  }
  res.json({ success: true, data: { id, content: fs.readFileSync(file, 'utf8') } });
});

// POST /api/themes/import - read an INI file the user picked and store it
appRouter.post('/api/themes/import', (req, res) => {
  try {
    const content = String((req.body && req.body.content) || '');
    if (!content.trim()) {
      return res.status(400).json({ success: false, error: '主題格式不正確: 檔案是空的' });
    }
    const parsed = parseIni(content, 'imported.ini');
    const meta = parsed.sections.meta || {};
    const theme = {
      id: String(meta.id || '').trim(),
      name: String(meta.name || meta.id || '').trim(),
      author: String(meta.author || '').trim(),
      builtin: false,
      colors: parsed.sections.colors || {},
      options: parsed.sections.options || {}
    };
    const problems = themeLib.validateTheme(theme);
    if (problems.length) {
      return res.status(400).json({ success: false, error: '主題格式不正確: ' + problems.join('; ') });
    }
    themeLib.writeThemeFile(themesDirSetting().value, theme);
    res.json({ success: true, data: { themes: themeList(), imported: theme.name } });
  } catch (err) {
    res.status(400).json({ success: false, error: '主題格式不正確: ' + err.message });
  }
});

// POST /api/themes - save a colour scheme as themes/<id>.ini
appRouter.post('/api/themes', (req, res) => {
  try {
    const body = req.body || {};
    const theme = {
      id: String(body.id || '').trim(),
      name: String(body.name || '').trim(),
      author: String(body.author || '').trim(),
      builtin: false,
      colors: body.colors || {},
      options: body.options || {}
    };
    const problems = themeLib.validateTheme(theme);
    if (problems.length) {
      return res.status(400).json({ success: false, error: '主題格式不正確: ' + problems.join('; ') });
    }
    const dir = themesDirSetting().value;
    const existing = themeLib.readThemeFile(dir, theme.id);
    if (existing && existing.builtin) {
      return res.status(400).json({ success: false, error: '內建主題不能覆寫或刪除，請複製成自訂主題後修改' });
    }
    themeLib.writeThemeFile(dir, theme);
    res.json({ success: true, data: { themes: themeList() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/themes/:id - remove a colour scheme the user made
appRouter.delete('/api/themes/:id', (req, res) => {
  try {
    const dir = themesDirSetting().value;
    const id = String(req.params.id || '').trim();
    const existing = themeLib.readThemeFile(dir, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: '找不到主題「' + id + '」' });
    }
    if (existing.builtin) {
      return res.status(400).json({ success: false, error: '內建主題不能覆寫或刪除，請複製成自訂主題後修改' });
    }
    fs.unlinkSync(path.join(dir, id + '.ini'));
    res.json({ success: true, data: { themes: themeList() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/backups - list available backups
appRouter.get('/api/backups', (req, res) => {
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



// A snapshot is a commit: when GitHub HEAD differs from this checkout an update is
// available. Both answers are null when git is missing (e.g. a Docker image) or the
// remote is unreachable, and the button stays locked in that case.
function gitSha(args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: PROJECT_DIR, timeout: 20000 }, (err, stdout) => {
      if (err) return resolve(null);
      const m = String(stdout).match(/[0-9a-f]{40}/);
      resolve(m ? m[0] : null);
    });
  });
}

// GET /api/check-upgrade - is the GitHub snapshot ahead of this checkout?
appRouter.get('/api/check-upgrade', async (req, res) => {
  try {
    if (UPDATE_PROXY) {
      // Docker layout: the app container has no git checkout; the updater
      // sidecar owns the repo and answers with its own snapshot comparison.
      const r = await fetch(UPDATE_PROXY + '/api/update/status', { signal: AbortSignal.timeout(45000) });
      const data = await r.json();
      res.json({ success: true, data: { hasUpdate: !!data.hasUpdate, offline: data.offline === true, env: 'docker' } });
      return;
    }
    const local = await gitSha(['rev-parse', 'HEAD']);
    const remote = await gitSha(['ls-remote', 'origin', 'HEAD']);
    if (!local || !remote) {
      // No git checkout, or the remote is unreachable: keep the button locked -
      // a false positive would only waste a click.
      return res.json({ success: true, data: { hasUpdate: false, offline: true } });
    }
    const hasUpdate = local !== remote;
    res.json({ success: true, data: { hasUpdate, local, remote } });
  } catch (err) {
    res.json({ success: true, data: { hasUpdate: false, offline: true, error: err.message } });
  }
});

// POST /api/upgrade - pull the new snapshot and its dependencies. The browser
// reloads afterwards, so the served page and any new front-end code run at once.
appRouter.post('/api/upgrade', (req, res) => {
  if (UPDATE_PROXY) {
    // Docker layout: ask the sidecar to pull, publish a snapshot, and restart
    // the app container. Its answer only comes back once the new snapshot is
    // in place, so the front-end reload finds the new code already running.
    fetch(UPDATE_PROXY + '/api/update/pull', { method: 'POST', signal: AbortSignal.timeout(600000) })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        res.status(r.ok ? 200 : 500).json(body.success ? body : { success: false, error: body.error || '升級失敗: sidecar 回應不正確' });
      })
      .catch((e) => res.status(500).json({ success: false, error: '升級失敗: ' + (e.message || String(e)) }));
    return;
  }
  execFile('git', ['pull', '--ff-only'], { cwd: PROJECT_DIR, timeout: 60000 }, (err, stdout, stderr) => {
    if (err || /fatal|error/i.test(String(stderr || ''))) {
      const detail = String(stderr || (err && err.message) || '').trim();
      return res.status(500).json({ success: false, error: '升級失敗: ' + detail });
    }
    execFile('npm', ['install'], { cwd: PROJECT_DIR, timeout: 180000, shell: process.platform === 'win32' }, (err2) => {
      if (err2) {
        return res.status(500).json({ success: false, error: '依賴安裝失敗: ' + err2.message });
      }
      // The reply goes out first so the click feels instant. Then launch the
      // fresh process - it backs off until this one frees the port - and exit.
      // 500ms is enough for the response to flush; the caller waits its own 3s
      // before reloading, by which time the new instance is serving.
      const child = spawn(process.execPath, [path.join(PROJECT_DIR, 'server.js')], {
        cwd: PROJECT_DIR,
        env: process.env,
        detached: true,
        stdio: ['ignore', 'inherit', 'inherit']
      });
      child.unref();
      setTimeout(() => { if (httpServer) httpServer.close(); process.exit(0); }, 500);
    });
  });
});
// POST /api/restore - restore from backup
appRouter.post('/api/restore', (req, res) => {
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

if (BASE_PATH) {
  // /cms answers with a 301 to /cms/ so relative asset URLs resolve under it.
  // Match the exact prefix only, so /cms/ itself never redirects in a loop.
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.originalUrl.split('?')[0] === BASE_PATH) {
      return res.redirect(301, BASE_PATH + '/');
    }
    next();
  });
}
app.use(BASE_PATH || '/', appRouter);
// EADDRINUSE retry: after an in-place upgrade the new instance starts while
// this one still holds the port, so it backs off a few times instead of dying.
let httpServer;
function startServer(attempts) {
  const server = app.listen(Number(EFFECTIVE_PORT), EFFECTIVE_BIND, () => {
    const preview = previewUrlSetting();
    // The version is in the line on purpose: when two instances are running, this is
    // how you tell which one has the current code.
    console.log(`Homepage Editor v${pkg.version} running at http://localhost:${EFFECTIVE_PORT}`);
    console.log(`Listening on: ${EFFECTIVE_BIND}`);
    console.log(`Config path: ${configDirSetting().value}`);
    console.log(`Backup path: ${backupDirSetting().value}`);
    console.log(`Settings file: ${settingsFilePath()}`);
    console.log(`Preview target: ${preview.value || '(not set)'} (${preview.source})`);
    if (!settingsExist()) {
      console.log('No editor settings found yet - the setup dialog opens on the first visit.');
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts > 1) {
      setTimeout(() => startServer(attempts - 1), 1000);
    } else {
      throw err;
    }
  });
  httpServer = server;
}
startServer(6);
