// Loading and saving the editor's colour schemes.
//
// A theme is one INI file per scheme in the themes directory. The built-in schemes
// are files too, so there is a single place to look and a single format to learn.

'use strict';

const fs = require('fs');
const path = require('path');
const { parseIni, stringifyIni } = require('./ini');

// The colour tokens, in the order they are shown in the theme editor. They match the
// custom properties in style.css one for one.
const COLOR_TOKENS = [
  'bg', 'bg-card', 'bg-hover', 'border', 'text', 'text-dim',
  'accent', 'accent-hover', 'accent-text', 'danger', 'success', 'info', 'api'
];

const OPTION_TOKENS = ['radius', 'shadow'];

function isValidColor(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text)) return true;
  return /^rgba?\(\s*\d+%?\s*,\s*\d+%?\s*,\s*\d+%?\s*(,\s*[\d.]+\s*)?\)$/.test(text);
}

function isValidId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,48}$/.test(id);
}

function readThemeFile(dir, id) {
  const file = path.join(dir, id + '.ini');
  if (!fs.existsSync(file)) return null;
  const parsed = parseIni(fs.readFileSync(file, 'utf8'), file);
  const meta = parsed.sections.meta || {};
  const colors = parsed.sections.colors || {};
  const options = parsed.sections.options || {};
  return {
    id: (meta.id || id).trim(),
    name: (meta.name || meta.id || id).trim(),
    author: (meta.author || '').trim(),
    builtin: meta.builtin === 'true',
    colors: { ...colors },
    options: { ...options }
  };
}

// Every theme in the directory. A file that cannot be parsed is reported instead of
// being skipped, so a broken theme file is visible rather than mysterious.
function listThemes(dir) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.ini')) continue;
    const id = entry.slice(0, -4);
    try {
      const theme = readThemeFile(dir, id);
      if (!theme) continue;
      out.push(theme);
    } catch (err) {
      out.push({ id, name: id, builtin: false, error: err.message, colors: {}, options: {} });
    }
  }
  return out;
}

// The CSS custom properties for a theme, ready to be written into a style attribute
// or a <style> block.
function themeVars(theme) {
  const vars = {};
  for (const token of COLOR_TOKENS) {
    const value = theme.colors && theme.colors[token];
    if (value) vars['--' + token] = value;
  }
  for (const token of OPTION_TOKENS) {
    const value = theme.options && theme.options[token];
    if (value) vars['--' + token] = value;
  }
  return vars;
}

// Write a theme as INI. Built-in themes are written the same way; the builtin flag
// is what keeps the interface from offering to delete them.
function writeThemeFile(dir, theme) {
  const sections = {
    meta: {
      id: theme.id,
      name: theme.name,
      author: theme.author || '',
      builtin: theme.builtin ? 'true' : 'false'
    },
    colors: {},
    options: {}
  };
  for (const token of COLOR_TOKENS) {
    if (theme.colors && theme.colors[token]) sections.colors[token] = theme.colors[token];
  }
  for (const token of OPTION_TOKENS) {
    if (theme.options && theme.options[token]) sections.options[token] = theme.options[token];
  }
  const file = path.join(dir, theme.id + '.ini');
  fs.writeFileSync(file, stringifyIni(sections), 'utf8');
  return file;
}

// Check the values a theme editor sent. Returns a list of problems; an empty list
// means the theme is fine.
function validateTheme(theme) {
  const problems = [];
  if (!isValidId(theme.id)) problems.push('id must be lowercase letters, digits and dashes');
  if (!theme.name || !String(theme.name).trim()) problems.push('name is required');
  for (const token of COLOR_TOKENS) {
    const value = theme.colors && theme.colors[token];
    if (!value) problems.push('missing colour: ' + token);
    else if (!isValidColor(value)) problems.push('not a colour: ' + token);
  }
  for (const token of OPTION_TOKENS) {
    const value = theme.options && theme.options[token];
    if (value !== undefined && value !== null && String(value).trim() === '') {
      problems.push('empty option: ' + token);
    }
  }
  return problems;
}

module.exports = {
  COLOR_TOKENS,
  OPTION_TOKENS,
  isValidColor,
  isValidId,
  readThemeFile,
  listThemes,
  themeVars,
  writeThemeFile,
  validateTheme
};

