// Loading the editor's language packs.
//
// A language pack is one INI file per language in the locales directory. Users add
// their own by dropping a file in; nothing here needs to know about them in advance.

'use strict';

const fs = require('fs');
const path = require('path');
const { parseIni, flatten } = require('./ini');

// The language the editor falls back to. It is also the language the built-in
// language packs are written in, so a half-translated pack still shows a usable
// interface.
const DEFAULT_LOCALE = 'zh-TW';
const FALLBACK_LOCALE = 'zh-TW';

// The languages that ship with the editor. Anything else in the directory is a pack
// the user added, and is marked as such in the interface.
const BUILTIN_LOCALES = ['zh-TW', 'zh-CN', 'ja', 'en'];

// Server-side error messages that have a translation. The response format stays
// what it was - a plain string in `error` - only the wording follows the language.
const ERROR_KEYS = {
  '需要存取密碼': 'toast.needPassword',
  '預覽網址格式不正確': 'error.invalidPreviewUrl',
  '預覽網址必須以 http:// 或 https:// 開頭': 'error.previewUrlScheme',
  '監聽位址格式不正確': 'error.invalidBindAddress',
  '連接埠必須是 1 到 65535 的整數': 'error.invalidPort',
  '啟用存取保護時必須設定密碼': 'error.protectionPasswordRequired',
  '內建主題不能覆寫或刪除，請複製成自訂主題後修改': 'error.themeBuiltin'
};

// Error messages that carry a value. The value is put back into the translation,
// so the message reads the same in every language.
const ERROR_PATTERNS = [
  { pattern: /^找不到語系「(.+)」$/, key: 'error.localeNotFound', vars: (m) => ({ code: m[1] }) },
  { pattern: /^找不到主題「(.+)」$/, key: 'error.themeNotFound', vars: (m) => ({ code: m[1] }) },
  { pattern: /^主題格式不正確:\s*(.+)$/, key: 'error.themeInvalid', vars: (m) => ({ msg: m[1] }) }
];

function interpolate(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, key) =>
    (vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match));
}

function readLocaleFile(dir, code) {
  const file = path.join(dir, code + '.ini');
  if (!fs.existsSync(file)) return null;
  const parsed = parseIni(fs.readFileSync(file, 'utf8'), file);
  const meta = parsed.sections.meta || {};
  return {
    code: (meta.code || code).trim(),
    name: (meta.name || meta.code || code).trim(),
    catalog: flatten(parsed),
    warnings: parsed.warnings || []
  };
}

// Every language pack in the directory. A file that cannot be parsed is still listed,
// with the parse error as its name, so the problem is visible instead of silent.
function listLocales(dir) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.ini')) continue;
    const code = entry.slice(0, -4);
    try {
      const locale = readLocaleFile(dir, code);
      if (!locale) continue;
      out.push({
        code: locale.code,
        name: locale.name,
        builtin: BUILTIN_LOCALES.includes(code)
      });
    } catch (err) {
      out.push({ code, name: code, builtin: false, error: err.message });
    }
  }
  return out;
}

// The catalogue of one language, plus the fallback catalogue in the language the
// editor ships with. The browser needs both: a missing key falls back to the
// fallback language instead of showing a raw key.
function localePayload(dir, code) {
  const requested = (code || '').trim();
  const available = listLocales(dir);
  const known = available.find((l) => l.code === requested && !l.error);
  const chosen = known ? known.code : DEFAULT_LOCALE;
  const catalog = {};
  if (known) {
    const locale = readLocaleFile(dir, chosen);
    if (locale) Object.assign(catalog, locale.catalog);
  }
  const fallback = {};
  const fallbackLocale = readLocaleFile(dir, FALLBACK_LOCALE);
  if (fallbackLocale) Object.assign(fallback, fallbackLocale.catalog);
  return { locale: chosen, available, catalog, fallback };
}

// Translate a server error message. Unknown messages are returned unchanged: the
// wording is still better than a key.
function localizeMessage(catalog, message) {
  if (typeof message !== 'string' || !message) return message;
  const key = ERROR_KEYS[message];
  if (key) {
    const translated = catalog && catalog[key];
    return typeof translated === 'string' && translated ? translated : message;
  }
  for (const rule of ERROR_PATTERNS) {
    const match = message.match(rule.pattern);
    if (!match) continue;
    const translated = catalog && catalog[rule.key];
    if (typeof translated === 'string' && translated) {
      return interpolate(translated, rule.vars(match));
    }
  }
  return message;
}

module.exports = {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  BUILTIN_LOCALES,
  ERROR_KEYS,
  ERROR_PATTERNS,
  interpolate,
  readLocaleFile,
  listLocales,
  localePayload,
  localizeMessage
};

