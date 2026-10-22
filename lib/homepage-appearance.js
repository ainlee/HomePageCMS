// Homepage's own appearance settings.
//
// Homepage has no theme files: the palette is built into the app as a set of
// Tailwind colour ramps (src/utils/styles/themes.js), and what a user can change
// lives in settings.yaml. This module holds the list of ramps with their colours
// (so the editor can show swatches) and the values the editor knows how to write.
//
// The ramp data is a copy of Homepage v2.6.0. A colour the running Homepage knows
// but this list does not is kept as it is, so a newer Homepage never loses a value.

'use strict';

const { OFFICIAL_SHADES } = require('./official-shades');

const PALETTE = {
  white: { light: '#ffffff', dark: '#ffffff', iconStart: '#ffffff', iconEnd: '#282828' },
  slate: { light: '#f8fafc', dark: '#1e293b', iconStart: '#94a3b8', iconEnd: '#334155' },
  gray: { light: '#f9fafb', dark: '#1f2937', iconStart: '#9ca3af', iconEnd: '#374151' },
  zinc: { light: '#fafafa', dark: '#27272a', iconStart: '#a1a1aa', iconEnd: '#3f3f46' },
  neutral: { light: '#fafafa', dark: '#262626', iconStart: '#a3a3a3', iconEnd: '#404040' },
  stone: { light: '#fafafa', dark: '#292524', iconStart: '#a8a29e', iconEnd: '#44403c' },
  red: { light: '#fef2f2', dark: '#991b1b', iconStart: '#f87171', iconEnd: '#b91c1c' },
  orange: { light: '#fff7ed', dark: '#9a3412', iconStart: '#fb923c', iconEnd: '#c2410c' },
  amber: { light: '#fffbeb', dark: '#92400e', iconStart: '#fbbf24', iconEnd: '#b45309' },
  yellow: { light: '#fefce8', dark: '#854d0e', iconStart: '#facc15', iconEnd: '#a16207' },
  lime: { light: '#f7fee7', dark: '#3f6212', iconStart: '#a3e635', iconEnd: '#4d7c0f' },
  green: { light: '#f0fdf4', dark: '#166534', iconStart: '#4ade80', iconEnd: '#15803d' },
  emerald: { light: '#ecfdf5', dark: '#065f46', iconStart: '#34d399', iconEnd: '#047857' },
  teal: { light: '#f0fdfa', dark: '#115e59', iconStart: '#2dd4bf', iconEnd: '#0f766e' },
  cyan: { light: '#ecfeff', dark: '#155e75', iconStart: '#22d3ee', iconEnd: '#0e7490' },
  sky: { light: '#f0f9ff', dark: '#075985', iconStart: '#38bdf8', iconEnd: '#0369a1' },
  blue: { light: '#eff6ff', dark: '#1e40af', iconStart: '#60a5fa', iconEnd: '#1d4ed8' },
  indigo: { light: '#eef2ff', dark: '#3730a3', iconStart: '#818cf8', iconEnd: '#4338ca' },
  violet: { light: '#f5f3ff', dark: '#5b21b6', iconStart: '#a78bfa', iconEnd: '#6d28d9' },
  purple: { light: '#faf5ff', dark: '#6b21a8', iconStart: '#c084fc', iconEnd: '#7e22ce' },
  fuchsia: { light: '#fdf4ff', dark: '#86198f', iconStart: '#e879f9', iconEnd: '#a21caf' },
  pink: { light: '#fdf2f8', dark: '#9d174d', iconStart: '#f472b6', iconEnd: '#be185d' },
  rose: { light: '#fff1f2', dark: '#9f1239', iconStart: '#fb7185', iconEnd: '#be123c' }
};

// The shape of Homepage's own ramps: 50 is almost white, 500 is the colour
// itself, 900 is almost black. The generator mixes the seed colour towards white
// and black by these amounts, which reproduces the shape of the built-in ramps
// while keeping the seed exactly on 500.
// The ramp maths lives in its own file, because the browser needs it too while
// the user drags the colour picker.
const {
  SHADE_NAMES,
  hexToRgb,
  rgbToHex,
  generateRamp,
  rampCss
} = require('./ramp');

// The CSS that gives one of Homepage's palettes a custom ramp.
//
// The selector carries an `html` prefix on purpose: custom.css is loaded before
// Homepage's own stylesheet, so a plain `.theme-slate` would lose against the
// built-in rule of the same name. The higher specificity wins, and because the
// rule is bound to one palette the other built-in palettes are untouched.
// The choices Homepage offers for the fields the editor writes. An empty value
// means "not set": Homepage then keeps its own default or shows the switcher.
const CHOICES = {
  theme: ['', 'light', 'dark'],
  cardBlur: ['', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'],
  headerStyle: ['', 'underlined', 'boxed', 'clean', 'boxedWidgets'],
  cardStyle: ['', 'default', 'hairline'],
  blockStyle: ['', 'default', 'refined'],
  iconStyle: ['', 'theme'],
  font: ['', 'manrope', 'plex', 'plexData']
};

// The fields that are a plain string in settings.yaml.
const STRING_FIELDS = ['theme', 'color', 'cardBlur', 'headerStyle', 'cardStyle', 'blockStyle', 'iconStyle', 'font'];

// The filters of the background image. saturate, brightness and opacity are
// numbers in Homepage's documentation, blur is a Tailwind class name.
const BACKGROUND_FILTERS = ['blur', 'saturate', 'brightness', 'opacity'];
const NUMERIC_FILTERS = ['saturate', 'brightness', 'opacity'];

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

// A number when the text is one, the text itself otherwise.
function numberOrText(value) {
  const trimmed = text(value);
  if (!trimmed) return '';
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

// The background can be a plain image or a map with the image and its filters.
function readBackground(value) {
  const out = { image: '', blur: '', saturate: '', brightness: '', opacity: '' };
  if (typeof value === 'string') {
    out.image = value.trim();
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  out.image = text(value.image);
  for (const key of BACKGROUND_FILTERS) out[key] = text(value[key]);
  return out;
}

// The appearance of a settings object, as the form shows it.
function readAppearance(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const values = {};
  for (const key of STRING_FIELDS) values[key] = text(source[key]);
  const background = readBackground(source.background);
  values.backgroundImage = background.image;
  values.backgroundBlur = background.blur;
  values.backgroundSaturate = background.saturate;
  values.backgroundBrightness = background.brightness;
  values.backgroundOpacity = background.opacity;
  return values;
}

// Put the edited values back onto the settings object. Only the fields the editor
// models are touched; everything else in the file stays as it was.
function applyAppearance(settings, values) {
  const next = settings && typeof settings === 'object' ? { ...settings } : {};
  const source = values && typeof values === 'object' ? values : {};

  for (const key of STRING_FIELDS) {
    const value = text(source[key]);
    if (value) next[key] = value;
    else delete next[key];
  }

  const image = text(source.backgroundImage);
  const filters = {};
  if (image) filters.image = image;
  for (const key of BACKGROUND_FILTERS) {
    const value = text(source['background' + key.charAt(0).toUpperCase() + key.slice(1)]);
    if (value) filters[key] = NUMERIC_FILTERS.includes(key) ? numberOrText(value) : value;
  }

  if (Object.keys(filters).length === 0) {
    delete next.background;
  } else if (next.background && typeof next.background === 'object') {
    // A background map can hold keys the editor does not know; they stay.
    for (const key of ['image', ...BACKGROUND_FILTERS]) {
      if (filters[key] !== undefined) next.background[key] = filters[key];
      else delete next.background[key];
    }
  } else {
    next.background = filters;
  }

  return next;
}

// The palette with its colours, for the swatches in the form.
function palette() {
  return Object.entries(PALETTE).map(([id, colors]) => ({ id, ...colors }));
}

// The ids of the built-in palettes, in the order Homepage lists them.
const PALETTE_IDS = Object.keys(PALETTE);

// The official colour of a palette: the 500 shade, which is the one Homepage
// uses for the accents. It is the seed the editor starts from.
function officialColor(paletteId) {
  const entry = OFFICIAL_SHADES[paletteId];
  if (!entry) return '';
  const triplet = entry.shades[5];
  if (!triplet) return '';
  const parts = triplet.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '';
  const hex = (n) => n.toString(16).padStart(2, '0');
  return ('#' + hex(parts[0]) + hex(parts[1]) + hex(parts[2])).toUpperCase();
}

// The whole official ramp of a palette, as the values Homepage ships.
function officialRamp(paletteId) {
  const entry = OFFICIAL_SHADES[paletteId];
  if (!entry) return null;
  const shades = {};
  const names = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  names.forEach((name, i) => {
    shades[name] = entry.shades[i] || '';
  });
  return { shades, logoStart: entry.logoStart, logoStop: entry.logoStop };
}

module.exports = {
  PALETTE,
  PALETTE_IDS,
  CHOICES,
  STRING_FIELDS,
  BACKGROUND_FILTERS,
  SHADE_NAMES,
  hexToRgb,
  rgbToHex,
  generateRamp,
  rampCss,
  officialColor,
  officialRamp,
  readAppearance,
  applyAppearance,
  palette
};
