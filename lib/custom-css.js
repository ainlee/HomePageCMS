// The document model of Homepage's custom.css.
//
// The file is made of three kinds of content:
//   - the font block, which has to come first because an @import only works at
//     the very top of a stylesheet
//   - one block per customised palette, each marked so it can be replaced
//   - whatever the user wrote themselves, which is kept as it is
//
// The editor works on those parts and assembles the file again, so the user
// never has to think about the order.

'use strict';

const FONT_MARK = 'font';
const THEME_PREFIX = 'theme:';

const FONT_START = '/* >>> HomePageCMS: ' + FONT_MARK + ' >>> */';
const FONT_END = '/* <<< HomePageCMS: ' + FONT_MARK + ' <<< */';

const themeStart = (id) => '/* >>> HomePageCMS: ' + THEME_PREFIX + id + ' >>> */';
const themeEnd = (id) => '/* <<< HomePageCMS: ' + THEME_PREFIX + id + ' <<< */';

// Every managed block, in one pattern, so the file can be taken apart in one
// pass and the gaps between the blocks are what is left of the user's content.
const BLOCK_PATTERN = /\/\* >>> HomePageCMS: ([^*]+?) >>> \*\/[\s\S]*?\/\* <<< HomePageCMS: \1 <<< \*\//g;

function unquote(value) {
  const text = String(value || '').trim();
  const match = text.match(/^["'](.*)["']$/);
  return match ? match[1] : text;
}

// The font name of a font-family list: the first entry, without its quotes.
function fontNameFrom(family) {
  const list = String(family || '').split(',');
  return unquote(list[0] || '');
}

// The name of a palette out of a block, or null when the block is not a palette.
function themeIdOf(mark) {
  const name = String(mark || '').trim();
  return name.startsWith(THEME_PREFIX) ? name.slice(THEME_PREFIX.length).trim() : null;
}

// The seed colour of a palette block: the 500 shade, which is the colour the
// user picked. Reading it back is what makes the file the only place the
// customisations are kept.
function seedOf(block) {
  const match = String(block || '').match(/--color-500:\s*(\d+)\s+(\d+)\s+(\d+)/);
  if (!match) return '';
  const hex = (n) => Number(n).toString(16).padStart(2, '0');
  return ('#' + hex(match[1]) + hex(match[2]) + hex(match[3])).toUpperCase();
}

// Take the file apart.
function parse(content) {
  const text = String(content || '');
  const result = { fontName: '', fontUrl: '', fontKind: '', themes: {}, free: '' };
  const free = [];
  let last = 0;
  BLOCK_PATTERN.lastIndex = 0;
  let match;
  while ((match = BLOCK_PATTERN.exec(text))) {
    free.push(text.slice(last, match.index));
    last = match.index + match[0].length;
    const mark = match[1].trim();
    const body = match[0].slice(match[0].indexOf('*/') + 2, match[0].lastIndexOf('/* <<<')).trim();
    const themeId = themeIdOf(mark);
    if (themeId) {
      result.themes[themeId] = body;
    } else if (mark === FONT_MARK) {
      const importMatch = body.match(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?\s*;/);
      if (importMatch) result.fontUrl = importMatch[1];
      const faceMatch = body.match(/@font-face[\s\S]*?src:\s*url\(["']?([^"')\s;]+)/);
      if (faceMatch) {
        result.fontUrl = faceMatch[1];
        result.fontKind = 'font';
      } else if (importMatch) {
        result.fontKind = 'css';
      }
      const familyMatch = body.match(/font-family:\s*([^;]+);/);
      if (familyMatch) result.fontName = fontNameFrom(familyMatch[1]);
    }
  }
  free.push(text.slice(last));
  result.free = free.join('').replace(/^\n+/, '').replace(/\s+$/, '');
  return result;
}

// The format of a font file, so the browser does not have to guess.
function fontFormat(url) {
  const path = String(url || '').split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.woff2')) return 'woff2';
  if (path.endsWith('.woff')) return 'woff';
  if (path.endsWith('.ttf')) return 'truetype';
  if (path.endsWith('.otf')) return 'opentype';
  return '';
}

// The CSS for the font, built from the name and the optional address.
//
// An address that points at a stylesheet is imported. An address that points at a
// font file needs a font-face rule instead, because a stylesheet cannot be
// imported as a font.
function fontCss(name, url, kind) {
  const family = String(name || '').trim();
  const source = String(url || '').trim();
  if (!family && !source) return '';
  const lines = [];
  if (source && kind === 'font') {
    lines.push('@font-face {');
    lines.push('  font-family: "' + family.replace(/"/g, '\\"') + '";');
    lines.push('  src: url("' + source.replace(/"/g, '\\"') + '")' +
      (fontFormat(source) ? ' format("' + fontFormat(source) + '")' : '') + ';');
    lines.push('  font-display: swap;');
    lines.push('}');
  } else if (source) {
    lines.push("@import url('" + source.replace(/'/g, "\\'") + "');");
  }
  if (family) {
    lines.push('html body {');
    lines.push('  font-family: "' + family.replace(/"/g, '\\"') + '", sans-serif;');
    lines.push('}');
  }
  return lines.join('\n');
}

// Put the file together again. The font block comes first, then the palettes,
// then the user's own content.
function assemble(parts) {
  const source = parts && typeof parts === 'object' ? parts : {};
  const blocks = [];
  const font = fontCss(source.fontName, source.fontUrl, source.fontKind);
  if (font) blocks.push(FONT_START + '\n' + font + '\n' + FONT_END);
  const themes = source.themes && typeof source.themes === 'object' ? source.themes : {};
  for (const [id, body] of Object.entries(themes)) {
    const text = String(body || '').trim();
    if (!text) continue;
    blocks.push(themeStart(id) + '\n' + text + '\n' + themeEnd(id));
  }
  const free = String(source.free || '').trim();
  if (free) blocks.push(free);
  return blocks.length ? blocks.join('\n\n') + '\n' : '';
}

module.exports = {
  FONT_MARK,
  THEME_PREFIX,
  FONT_START,
  FONT_END,
  themeStart,
  themeEnd,
  parse,
  assemble,
  fontCss,
  fontFormat,
  seedOf,
  fontNameFrom
};
