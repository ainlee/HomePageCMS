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

// The label we give a font we load ourselves. Nobody installs a font under this
// name, so it cannot fight with a font on the visitor's machine.
const OWN_FONT_FAMILY = 'homepagecmsfont';

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

// The settings of the font are written as a comment inside the font block. The
// block is the only place they are kept, so they have to be readable back out.
function fontSettingsComment(font) {
  const source = font || {};
  const families = Array.isArray(source.families) ? source.families.filter(Boolean) : [];
  return '/* font: cdn=' + String(source.cdn || '') +
    ' | kind=' + String(source.kind || '') +
    ' | families=' + families.join('; ') +
    ' | local=' + String(source.local || '') + ' */';
}

function parseFontSettings(comment) {
  const out = { cdn: '', kind: '', families: [], local: '' };
  const match = String(comment || '').match(
    /font:\s*cdn=(.*?)\s*\|\s*kind=(.*?)\s*\|\s*families=(.*?)\s*\|\s*local=(.*?)\s*\*\//
  );
  if (!match) return out;
  out.cdn = match[1].trim();
  out.kind = match[2].trim();
  out.families = match[3].trim()
    ? match[3].split(';').map((f) => f.trim()).filter(Boolean)
    : [];
  out.local = match[4].trim();
  return out;
}

// The settings of a block that was written before the settings comment existed.
// The values are read out of the CSS itself, so a file that was made by an older
// version of the editor keeps its font when it is read.
function readFontFromCss(body) {
  const out = { cdn: '', kind: '', families: [], local: '' };
  const importMatch = String(body || '').match(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?\s*;/);
  if (importMatch) {
    out.cdn = importMatch[1];
    out.kind = 'css';
    const familyMatch = String(body).match(/font-family:\s*([^;]+);/);
    if (familyMatch) {
      const list = familyMatch[1].split(',').map((f) => unquote(f)).filter(Boolean);
      // The first name is the one the stylesheet registers, the last is the
      // system font, and what is in between is the font of the visitor.
      const wanted = list.filter((f) => f.toLowerCase() !== 'sans-serif');
      if (wanted.length) out.families = [wanted[0]];
      if (wanted.length > 1) out.local = wanted.slice(1).join(', ');
    }
    return out;
  }
  const faceMatch = String(body || '').match(/@font-face[\s\S]*?src:\s*([^;]+);/);
  if (faceMatch) {
    out.kind = 'font';
    const urlMatch = faceMatch[1].match(/url\(\s*["']?([^"')\s;]+)/);
    if (urlMatch) out.cdn = urlMatch[1];
    const localMatch = faceMatch[1].match(/local\(\s*["']?([^"')\s;)]+)/);
    if (localMatch) out.local = unquote(localMatch[1]);
  }
  return out;
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

// The CSS for the font.
//
// The address is either a stylesheet or a font file:
//
//   a stylesheet brings its own @font-face rules, registered under the name the
//   author gave them. It is imported, and the page asks for that name first.
//
//   a font file is just the ink. It is loaded through a font-face rule of our
//   own, under a label nobody else uses, and the font the visitor has on their
//   own machine is the second source of that rule.
//
// Either way the order is the same: the address first, then the font on the
// visitor's machine, then the font of the system.
function fontCss(font) {
  const source = font || {};
  const cdn = String(source.cdn || '').trim();
  const local = String(source.local || '').trim();
  const families = Array.isArray(source.families) ? source.families.filter(Boolean) : [];
  const lines = [];

  if (cdn && source.kind === 'font') {
    const format = fontFormat(cdn);
    lines.push('@font-face {');
    lines.push('  font-family: "' + OWN_FONT_FAMILY + '";');
    const sources = ['url("' + cdn.replace(/"/g, '\\"') + '")' + (format ? ' format("' + format + '")' : '')];
    if (local) sources.push('local("' + local.replace(/"/g, '\\"') + '")');
    lines.push('  src: ' + sources.join(', ') + ';');
    lines.push('  font-display: swap;');
    lines.push('}');
  } else if (cdn) {
    // A stylesheet has to be imported, and an import only works at the top.
    lines.push("@import url('" + cdn.replace(/'/g, "\\'") + "');");
  }

  // The names the page asks for, in the order they are tried.
  const wanted = [];
  if (cdn && source.kind === 'font') wanted.push(OWN_FONT_FAMILY);
  else if (cdn) wanted.push(...families);
  if (local) wanted.push(local);
  if (wanted.length) {
    lines.push('html body {');
    lines.push('  font-family: ' +
      wanted.map((name) => '"' + name.replace(/"/g, '\\"') + '"').join(', ') + ', sans-serif;');
    lines.push('}');
  }

  return lines.join('\n');
}

// Take the file apart.
function parse(content) {
  const text = String(content || '');
  const result = { font: { cdn: '', kind: '', families: [], local: '' }, themes: {}, free: '' };
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
      const comment = body.match(/\/\*\s*font:[\s\S]*?\*\//);
      result.font = comment
        ? parseFontSettings(comment[0])
        : readFontFromCss(body);
    }
  }
  free.push(text.slice(last));
  result.free = free.join('').replace(/^\n+/, '').replace(/\s+$/, '');
  return result;
}

// Put the file together again. The font block comes first, then the palettes,
// then the user's own content.
function assemble(parts) {
  const source = parts && typeof parts === 'object' ? parts : {};
  const blocks = [];
  const font = fontCss(source.font);
  if (font) {
    blocks.push(FONT_START + '\n' + fontSettingsComment(source.font) + '\n' + font + '\n' + FONT_END);
  }
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
  OWN_FONT_FAMILY,
  themeStart,
  themeEnd,
  parse,
  assemble,
  fontCss,
  fontFormat,
  fontNameFrom,
  seedOf
};
