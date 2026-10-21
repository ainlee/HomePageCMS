// A small INI reader/writer for the editor's language packs and colour schemes.
//
// INI is the format users extend by hand: one file per language or theme, dropped
// into a directory, no code changes. It has to stay predictable, so the rules are
// deliberately narrow:
//
//   [section]      a section header
//   key = value    an entry, the value may be quoted
//   # comment      a comment line (# or ;)
//
// There are no inline comments: a colour value starts with '#', so stripping text
// after a '#' would eat the colours themselves.

'use strict';

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

// Parse INI text into { root, sections, warnings }.
//
// `root` holds the keys that appear before the first section header, `sections` maps a
// section name to its keys. A malformed line throws, with the line number, because a
// file that is half-read is worse than one that is rejected with a clear message.
function parseIni(text, fileName) {
  const source = stripBom(String(text == null ? '' : text));
  const root = {};
  const sections = {};
  const warnings = [];
  let current = root;
  let currentName = '';

  const lines = source.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNo = i + 1;
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    if (line.startsWith('[')) {
      if (!line.endsWith(']')) {
        throw new Error(`${fileName || 'INI'}:${lineNo} section header is not closed: ${line}`);
      }
      currentName = line.slice(1, -1).trim();
      if (!currentName) {
        throw new Error(`${fileName || 'INI'}:${lineNo} section header has no name`);
      }
      if (!sections[currentName]) sections[currentName] = {};
      current = sections[currentName];
      continue;
    }

    const eq = line.indexOf('=');
    if (eq === -1) {
      throw new Error(`${fileName || 'INI'}:${lineNo} expected "key = value": ${line}`);
    }
    const key = line.slice(0, eq).trim();
    const value = unquote(line.slice(eq + 1).trim());
    if (!key) {
      throw new Error(`${fileName || 'INI'}:${lineNo} key is empty`);
    }
    if (Object.prototype.hasOwnProperty.call(current, key)) {
      warnings.push(`${fileName || 'INI'}:${lineNo} duplicate key "${key}", the later value wins`);
    }
    current[key] = value;
  }

  return { root, sections, warnings };
}

// Flatten a parsed file into "section.key" pairs, so a catalogue can be handed to the
// browser as one object. Keys in the root section keep their plain name.
function flatten(parsed) {
  const out = {};
  for (const [key, value] of Object.entries(parsed.root || {})) out[key] = value;
  for (const [name, entries] of Object.entries(parsed.sections || {})) {
    for (const [key, value] of Object.entries(entries)) out[`${name}.${key}`] = value;
  }
  return out;
}

function escapeValue(value) {
  const text = value == null ? '' : String(value);
  if (text === '') return '';
  // Colours start with '#' and must stay readable, so only whitespace padding and
  // quotes force a value into quotes.
  if (/^\s|\s$|["']/.test(text)) return '"' + text.replace(/"/g, '\\"') + '"';
  return text;
}

// Write { sections: { name: { key: value } } } back out as INI text. The output is
// meant to be read by people as well as by the parser, so it keeps one entry per
// line and quotes anything that would otherwise be ambiguous.
function stringifyIni(sections, root) {
  const lines = [];
  for (const [key, value] of Object.entries(root || {})) {
    lines.push(`${key} = ${escapeValue(value)}`);
  }
  for (const [name, entries] of Object.entries(sections || {})) {
    if (lines.length) lines.push('');
    lines.push(`[${name}]`);
    for (const [key, value] of Object.entries(entries)) {
      lines.push(`${key} = ${escapeValue(value)}`);
    }
  }
  return lines.join('\n') + '\n';
}

module.exports = { parseIni, flatten, stringifyIni };

