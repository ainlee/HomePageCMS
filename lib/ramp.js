// The colour ramp of a palette, shared by the server and the browser.
//
// The browser needs it while the user drags the colour picker, so the maths
// lives here instead of in the server. The file is written so both can use it:
// the server loads it as a module, the page gets it as a plain script.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HomepageRamp = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The shape of Homepage's own ramps: 50 is almost white, 500 is the colour
  // itself, 900 is almost black. The generator mixes the seed colour towards
  // white and black by these amounts, which reproduces the shape of the
  // built-in ramps while keeping the seed exactly on 500.
  var SHADE_NAMES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  // How much of the seed colour is kept, for 50 to 500 (mixed towards white).
  var LIGHT_MIX = [0.045, 0.09, 0.187, 0.335, 0.69, 1];
  // And for 600 to 900 (mixed towards black).
  var DARK_MIX = [0.71, 0.51, 0.30, 0.15];

  function hexToRgb(hex) {
    var text = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(text)) return null;
    return {
      r: parseInt(text.slice(0, 2), 16),
      g: parseInt(text.slice(2, 4), 16),
      b: parseInt(text.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    var part = function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    };
    return '#' + part(r) + part(g) + part(b);
  }

  // A ramp of ten shades from one seed colour. The seed lands on 500.
  function generateRamp(seed) {
    var rgb = hexToRgb(seed);
    if (!rgb) return null;
    var shades = {};
    var mix = function (value, target, amount) {
      return target + (value - target) * amount;
    };
    SHADE_NAMES.forEach(function (name, i) {
      if (i < LIGHT_MIX.length) {
        var amount = LIGHT_MIX[i];
        shades[name] = rgbToHex(mix(rgb.r, 255, amount), mix(rgb.g, 255, amount), mix(rgb.b, 255, amount));
      } else {
        var dark = DARK_MIX[i - LIGHT_MIX.length];
        shades[name] = rgbToHex(mix(rgb.r, 0, dark), mix(rgb.g, 0, dark), mix(rgb.b, 0, dark));
      }
    });
    return shades;
  }

  // The colour of the icon gradient. Homepage takes the two ends as plain RGB
  // triplets, not as hex.
  function rgbTriplet(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return '0 0 0';
    return rgb.r + ' ' + rgb.g + ' ' + rgb.b;
  }

  // The CSS that gives one of Homepage's palettes a custom ramp.
  //
  // The selector carries an `html` prefix on purpose: custom.css is loaded
  // before Homepage's own stylesheet, so a plain `.theme-slate` would lose
  // against the built-in rule of the same name. The higher specificity wins, and
  // because the rule is bound to one palette the other built-in palettes are
  // untouched.
  function rampCss(paletteId, shades, options) {
    var opts = options || {};
    var logoStart = opts.logoStart || shades['400'];
    var logoStop = opts.logoStop || shades['700'];
    var lines = SHADE_NAMES.map(function (name) {
      return '  --color-' + name + ': ' + rgbTriplet(shades[name]) + ';';
    });
    lines.push('  --color-logo-start: ' + rgbTriplet(logoStart) + ';');
    lines.push('  --color-logo-stop: ' + rgbTriplet(logoStop) + ';');
    return 'html.theme-' + paletteId + ' {\n' + lines.join('\n') + '\n}';
  }

  // The shades of a block, read back from the text. A value may be an RGB
  // triplet or a hex colour. A shade the block does not set is null.
  function readShades(css) {
    var out = {};
    SHADE_NAMES.forEach(function (name) {
      var match = String(css || '').match(new RegExp('--color-' + name + ':\\s*([^;]+);'));
      if (!match) {
        out[name] = null;
        return;
      }
      var value = match[1].trim();
      var triplet = value.match(/^(\d+)\s+(\d+)\s+(\d+)/);
      if (triplet) {
        out[name] = rgbToHex(Number(triplet[1]), Number(triplet[2]), Number(triplet[3]));
        return;
      }
      var hex = value.match(/^#?([0-9a-fA-F]{6})$/);
      out[name] = hex ? ('#' + hex[1]).toUpperCase() : null;
    });
    return out;
  }

  return {
    SHADE_NAMES: SHADE_NAMES,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    generateRamp: generateRamp,
    rampCss: rampCss,
    readShades: readShades
  };
}));
