'use strict';

// The layout block of Homepage's settings.yaml: how the groups of
// services.yaml / bookmarks.yaml are arranged (tabs, columns, icons, ...)
// and the global switches that sit next to it.
//
// The editor only rewrites the keys it models. Everything else in the file
// (providers, quicklaunch, pwa, blockHighlights, ...) is left as it was.

// The group-level fields of a layout entry, in the order the form shows them.
const GROUP_FIELDS = ['icon', 'tab', 'style', 'columns', 'header', 'initiallyCollapsed', 'useEqualHeights'];
const STYLE_CHOICES = ['columns', 'row'];
const COLUMNS_MIN = 2;
const COLUMNS_MAX = 8;

// The global switches of settings.yaml that the editor models, as plain
// key/value pairs. The UI type decides how the value is validated.
const GLOBAL_SWITCHES = [
  { key: 'title', type: 'string' },
  { key: 'description', type: 'string' },
  { key: 'language', type: 'string' },
  { key: 'target', type: 'string', choices: ['_blank', '_self', '_top'] },
  { key: 'startUrl', type: 'string' },
  { key: 'favicon', type: 'string' },
  { key: 'base', type: 'string' },
  { key: 'instanceName', type: 'string' },
  { key: 'logpath', type: 'string' },
  { key: 'fullWidth', type: 'bool' },
  { key: 'maxGroupColumns', type: 'int' },
  { key: 'maxBookmarkGroupColumns', type: 'int' },
  { key: 'disableCollapse', type: 'bool' },
  { key: 'groupsInitiallyCollapsed', type: 'bool' },
  { key: 'useEqualHeights', type: 'bool' },
  { key: 'bookmarksStyle', type: 'string', choices: ['default', 'icons'] },
  { key: 'hideVersion', type: 'bool' },
  { key: 'disableUpdateCheck', type: 'bool' },
  { key: 'hideErrors', type: 'bool' },
  { key: 'disableIndexing', type: 'bool' },
  { key: 'statusStyle', type: 'string', choices: ['dot', 'basic'] },
  { key: 'showStats', type: 'bool' }
];

// One layout group, as the form edits it. The raw object is kept next to the
// modeled fields so a save only rewrites what the form knows.
function readLayoutGroups(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  let layout = source.layout;
  if (Array.isArray(layout)) {
    // Upstream accepts a list of single-key objects and maps it to the same
    // object form. The editor reads both, and writes back the object form.
    const asObject = {};
    for (const entry of layout) {
      if (entry && typeof entry === 'object') {
        // The list form holds one single-key object per group, the same way
        // services.yaml does. The first key is the group name.
        const [name, value] = Object.entries(entry)[0] || [];
        if (name) asObject[name] = value && typeof value === 'object' ? value : {};
      }
    }
    layout = asObject;
  }
  if (!layout || typeof layout !== 'object') layout = {};
  return Object.entries(layout).map(([name, value]) => ({
    name,
    style: value && typeof value === 'object' && value.style ? value.style : '',
    icon: value && typeof value === 'object' && value.icon ? value.icon : '',
    tab: value && typeof value === 'object' && value.tab ? value.tab : '',
    columns: value && typeof value === 'object' && value.columns ? value.columns : '',
    header: value && typeof value === 'object' && value.header !== undefined ? String(value.header) : '',
    initiallyCollapsed: value && typeof value === 'object' && value.initiallyCollapsed !== undefined ? String(value.initiallyCollapsed) : '',
    useEqualHeights: value && typeof value === 'object' && value.useEqualHeights !== undefined ? String(value.useEqualHeights) : '',
    source: value && typeof value === 'object' ? value : null
  }));
}

function readGlobalValues(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const out = {};
  for (const sw of GLOBAL_SWITCHES) {
    out[sw.key] = sw.type === 'int'
      ? (Number.isFinite(source[sw.key]) ? String(source[sw.key]) : (source[sw.key] !== undefined && source[sw.key] !== null ? String(source[sw.key]) : ''))
      : (source[sw.key] !== undefined && source[sw.key] !== null ? String(source[sw.key]) : '');
  }
  return out;
}

// Write the edited values back onto a settings object. Every value is a string
// from the form; '' means "not set" and the key is dropped. Keys the editor
// does not model keep whatever the file had.
function applyLayoutSettings(settings, values, groups) {
  const next = settings && typeof settings === 'object' ? { ...settings } : {};
  const source = values && typeof values === 'object' ? values : {};

  for (const sw of GLOBAL_SWITCHES) {
    const raw = source[sw.key];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      delete next[sw.key];
      continue;
    }
    const text = String(raw).trim();
    if (sw.type === 'bool') {
      if (text !== 'true' && text !== 'false') continue;
      next[sw.key] = text === 'true';
    } else if (sw.type === 'int') {
      if (!/^\d+$/.test(text)) continue;
      next[sw.key] = Number(text);
    } else {
      next[sw.key] = text;
    }
  }

  // The groups array is the complete set of layout entries the client wants in
  // the file. Each entry may carry a source object (the raw value it was loaded
  // from) so unmodelled nested subgroups survive the save.
  const layout = {};
  for (const group of groups || []) {
    const name = String(group.name || '').trim();
    if (!name) continue;
    const entry = { ...(group.source && typeof group.source === 'object' ? group.source : {}) };
    for (const field of GROUP_FIELDS) {
      const raw = group[field];
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        delete entry[field];
        continue;
      }
      const text = String(raw).trim();
      if (field === 'columns') {
        if (!/^\d+$/.test(text) || Number(text) < COLUMNS_MIN || Number(text) > COLUMNS_MAX) { delete entry[field]; continue; }
        entry[field] = Number(text);
      } else if (field === 'style') {
        if (STYLE_CHOICES.includes(text)) entry[field] = text;
        else delete entry[field];
      } else if (['header', 'initiallyCollapsed', 'useEqualHeights'].includes(field)) {
        // Tristate booleans: '' means "not set", true/false are real values.
        entry[field] = text === 'true';
      } else {
        entry[field] = text;
      }
    }
    layout[name] = entry;
  }
  if (Object.keys(layout).length) next.layout = layout;
  else delete next.layout;

  return next;
}

module.exports = {
  GROUP_FIELDS,
  STYLE_CHOICES,
  COLUMNS_MIN,
  COLUMNS_MAX,
  GLOBAL_SWITCHES,
  readLayoutGroups,
  readGlobalValues,
  applyLayoutSettings
};
