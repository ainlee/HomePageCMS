const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;

// Config path - can be set via env var or defaults to local dev path
const CONFIG_PATH = process.env.HOMEPAGE_CONFIG_PATH || path.join(__dirname, 'config');
const SERVICES_FILE = path.join(CONFIG_PATH, 'services.yaml');
const BOOKMARKS_FILE = path.join(CONFIG_PATH, 'bookmarks.yaml');
const BACKUP_DIR = path.join(__dirname, 'backups');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure directories exist
if (!fs.existsSync(CONFIG_PATH)) fs.mkdirSync(CONFIG_PATH, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

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
    if (fs.existsSync(SERVICES_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `services-${timestamp}.yaml`);
      fs.copyFileSync(SERVICES_FILE, backupFile);
    }
    
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
    if (fs.existsSync(BOOKMARKS_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `bookmarks-${timestamp}.yaml`);
      fs.copyFileSync(BOOKMARKS_FILE, backupFile);
    }
    
    // Write new content
    fs.writeFileSync(BOOKMARKS_FILE, raw, 'utf8');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/backups - list available backups
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('services-') && f.endsWith('.yaml'))
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
    // Backup current before restore
    if (fs.existsSync(SERVICES_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const currentBackup = path.join(BACKUP_DIR, 'services-' + timestamp + '-prerestore.yaml');
      fs.copyFileSync(SERVICES_FILE, currentBackup);
    }
    fs.copyFileSync(backupFile, SERVICES_FILE);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Homepage Editor running at http://localhost:${PORT}`);
  console.log(`Config path: ${CONFIG_PATH}`);
});
