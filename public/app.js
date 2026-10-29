const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch } = Vue;
// The colour ramp maths, shared with the server (lib/ramp.js).
const ramp = window.HomepageRamp;
// The path the editor is mounted under (e.g. /cms); empty when it runs at the
// root. The server puts it in window.__META__ so page and code always agree.
const BASE = (window.__META__ || {}).basePath || '';

// Icon helpers for the live previews. Upstream resolves prefixed icons from a
// CDN (mdi-XX, si-XX, sh-XX, or a dashboard-icons name); a hex color suffix
// on an mdi / si icon recolors it. They live at module scope so the shared
// icon-field component and the in-list previews both reach them.
function isMdiIcon(icon) {
  const v = String(icon || '').trim();
  return v.startsWith('mdi-') && !/\.(png|webp|svg)$/i.test(v);
}

// The mdi class, without any color suffix: mdi-test-#f0d453 -> mdi-test.
function mdiClassOf(icon) {
  const v = String(icon || '').trim();
  const m = v.match(/^mdi-[\w-]+?(?:-#([a-fA-F0-9]{6}))?$/);
  return m ? 'mdi-' + m[0].replace(/^mdi-/, '').replace(/-#[a-fA-F0-9]{6}$/, '') : v;
}

// The URL to preview an icon value as an image: a real URL, or the CDN
// address of a prefixed / named icon. '' when nothing to show.
function iconPreviewUrl(icon, iconType) {
  const v = String(icon || '').trim();
  if (!v) return '';
  if (iconType === 'url' || v.startsWith('http') || v.startsWith('//') || v.startsWith('/')) return v;
  if (isMdiIcon(v)) return '';
  const colorMatch = v.match(/#([a-fA-F0-9]{6})$/);
  let name = colorMatch ? v.slice(0, -colorMatch[0].length) : v;
  const dash = name.indexOf('-');
  const prefix = dash > 0 ? name.slice(0, dash) : '';
  const base = dash > 0 ? name.slice(dash + 1) : name;
  const stripExt = (s) => s.replace(/\.(png|webp|svg)$/i, '');
  if (prefix === 'si') return 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/' + stripExt(base).toLowerCase() + '.svg';
  if (prefix === 'sh') return 'https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/' + stripExt(base) + '.png';
  return 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/' + stripExt(base) + '.png';
}

// One shared "icon input + live preview" that every group / item dialog
// renders instead of a private copy, so the forms cannot drift apart. It
// renders the whole .form-group (label, input, preview) - the shape the CSS
// and the tests already expect.
const IconField = {
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    inputId: { type: String, default: '' },
    iconType: { type: String, default: 'mdi' },
    enterToSubmit: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'submit'],
  setup(props, { emit }) {
    return {
      isMdiIcon,
      mdiClassOf,
      // The live preview recomputes with the bound value.
      previewUrl: computed(() => iconPreviewUrl(props.modelValue, props.iconType)),
      onEnter() { if (props.enterToSubmit) emit('submit'); }
    };
  },
  template:
    '<div class="form-group">' +
    '  <label>{{ label }}</label>' +
    '  <div class="icon-input-wrap">' +
    '    <input :id="inputId || undefined" :value="modelValue" type="text" :placeholder="placeholder" ' +
    '           @input="$emit(\'update:modelValue\', $event.target.value)" ' +
    '           @keyup.enter="onEnter">' +
    '    <div class="icon-preview" v-if="modelValue">' +
    '      <i v-if="isMdiIcon(modelValue)" class="mdi icon-preview-glyph" :class="mdiClassOf(modelValue)"></i>' +
    '      <img v-else-if="previewUrl" :src="previewUrl" class="icon-preview-img">' +
    '    </div>' +
    '  </div>' +
    '</div>'
};

const cmsApp = createApp({
  setup() {
    const loadLayout = () => {
      try {
        const raw = localStorage.getItem('hcms-layout');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (err) {
        return {};
      }
    };
    const savedLayout = loadLayout();

    // State
    const groups = ref([]);
    const bookmarkGroups = ref([]);
    const widgets = ref([]);
    const activeTab = ref('services');
    const showPreview = ref(savedLayout.showPreview !== false);
    // The preview target comes from the server (settings file > env var > unset), so no
    // deployment-specific URL is baked into the front end.
    const previewUrl = ref('');
    const previewUrlSource = ref('');
    const previewKey = ref(0);
    const previewCollapsed = ref(!!savedLayout.previewCollapsed);
    const isResizing = ref(false);
    // Share of .main-content given to the editor; the preview takes the rest.
    // 60/40 matches the original CSS default (preview panel was 40%).
    const splitRatio = ref(typeof savedLayout.splitRatio === 'number'
      ? Math.max(20, Math.min(80, savedLayout.splitRatio))
      : 60);
    const viewportWidth = ref(window.innerWidth);
    const saving = ref(false);
    const showGroupModal = ref(false);
    const showItemModal = ref(false);
    const showBookmarkGroupModal = ref(false);
    const showBookmarkItemModal = ref(false);
    const showWidgetModal = ref(false);
    const showMoveModal = ref(false);
    const showBackups = ref(false);
    const showSettings = ref(false);
    const editingGroupId = ref(null);
    const editingItemId = ref(null);
    const editingBookmarkGroupId = ref(null);
    const editingBookmarkItemId = ref(null);
    const editingWidgetIndex = ref(null);
    const movingItem = ref(null);
    const movingFromGroup = ref(null);
    const dragOverGroup = ref(null);
    let overlayPress = null;
    const dropIndex = ref(null);
    const draggingItem = ref(null);
    const backups = ref([]);
    // Hash of the config files as they were when they were loaded. A save sends it
    // back so the server can refuse to overwrite a file that changed in the meantime.
    const servicesHash = ref(null);
    const bookmarksHash = ref(null);
    const widgetsHash = ref(null);
    // Access password, when the server asks for one. Kept in the browser so it is
    // typed once per device.
    const apiPassword = ref(localStorage.getItem('hcms-password') || '');
    const showPasswordPrompt = ref(false);
    const passwordInput = ref('');
    // Access state. The editor asks for the password before it loads anything, so the
    // page never sits there empty while the requests come back unauthorized.
    const authState = reactive({ required: false, checked: false, locked: false });
    const toast = reactive({ show: false, msg: '', type: 'success' });

    // ---- Language ----
    // The server hands the language pack to the page together with the HTML, so the
    // first render already shows the right language. Switching languages fetches the
    // new pack and re-renders; nothing else on the page is disturbed.
    const i18n = reactive({
      locale: 'zh-TW',
      available: [],
      catalog: {},
      fallback: {}
    });
    (function initI18n() {
      const boot = window.__I18N__ || {};
      i18n.locale = boot.locale || 'zh-TW';
      i18n.available = boot.available || [];
      i18n.catalog = boot.catalog || {};
      i18n.fallback = boot.fallback || {};
    })();

    const warnedMissing = new Set();

    // The version and the repository the editor came from. The server puts them in
    // the page, so the number shown is the number that is running.
    const meta = reactive({ name: 'HomePageCMS', version: '', repo: '' });
    (function initMeta() {
      const boot = window.__META__ || {};
      meta.name = boot.name || meta.name;
      meta.version = boot.version || '';
      meta.repo = boot.repo || '';
    })();

    // Look up a string. A key the chosen language does not have falls back to the
    // language the editor ships with, so a half-finished translation still shows a
    // usable interface.
    function t(key, vars) {
      let text;
      if (i18n.catalog && i18n.catalog[key] != null) {
        text = i18n.catalog[key];
      } else if (i18n.fallback && i18n.fallback[key] != null) {
        text = i18n.fallback[key];
      } else {
        if (!warnedMissing.has(key)) {
          warnedMissing.add(key);
          console.warn('[i18n] missing translation for', key);
        }
        text = key;
      }
      if (!vars) return text;
      return String(text).replace(/\{(\w+)\}/g, (match, name) =>
        (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : match));
    }

    // ---- Colour scheme ----
    const themes = ref([]);
    // The server applies the colour scheme to the page before it is sent, so the
    // first paint is already in the right colours.
    const currentTheme = ref((window.__THEME__ && window.__THEME__.id) || 'midnight');
    const colorTokens = ref([]);
    const optionTokens = ref(['radius', 'shadow']);
    const showAppearance = ref(false);
    // The language menu in the top bar unfolds under its button.
    const langMenuOpen = ref(false);
    const themeEditor = reactive({
      open: false,
      isNew: false,
      id: '',
      name: '',
      colors: {},
      options: {}
    });
    // The custom properties the current scheme set on the document, so a new scheme
    // can take the old one's values away instead of leaving them behind.
    const appliedVars = new Set();

    function themeVarsOf(theme) {
      const vars = {};
      for (const token of colorTokens.value) {
        if (theme.colors && theme.colors[token]) vars['--' + token] = theme.colors[token];
      }
      for (const token of optionTokens.value) {
        if (theme.options && theme.options[token]) vars['--' + token] = theme.options[token];
      }
      return vars;
    }

    function applyThemeVars(vars) {
      const root = document.documentElement;
      for (const name of appliedVars) {
        if (!vars || !(name in vars)) root.style.removeProperty(name);
      }
      appliedVars.clear();
      for (const [name, value] of Object.entries(vars || {})) {
        root.style.setProperty(name, value);
        appliedVars.add(name);
      }
    }

    // The colours shown in the theme list, in the order they appear there.
    function swatchesOf(theme) {
      if (!theme || !theme.colors) return [];
      return ['bg', 'bg-card', 'accent', 'success', 'danger']
        .map((token) => theme.colors[token])
        .filter(Boolean);
    }

    const availableLocales = computed(() => i18n.available);
    const currentLocaleName = computed(() => {
      const found = i18n.available.find((l) => l.code === i18n.locale);
      return found ? found.name : i18n.locale;
    });
    const currentThemeName = computed(() => {
      const found = themes.value.find((th) => th.id === currentTheme.value);
      return found ? found.name : currentTheme.value;
    });

    // Saving a preference goes through the same settings file as everything else, so
    // it survives a restart.
    async function savePreference(prefs) {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || t('toast.unknownError'));
      return json;
    }

    // Switch language without reloading the page: the new pack arrives as JSON and
    // every string in the interface is replaced in place.
    async function changeLanguage(code) {
      if (!code || code === i18n.locale) return;
      try {
        const res = await apiFetch('/api/i18n?locale=' + encodeURIComponent(code));
        const json = await res.json();
        if (!json.success) throw new Error(json.error || t('toast.unknownError'));
        i18n.catalog = json.data.catalog || {};
        i18n.fallback = json.data.fallback || {};
        i18n.available = json.data.available || i18n.available;
        i18n.locale = json.data.locale || code;
        document.documentElement.lang = i18n.locale;
        // The error panel reads the pack from the page, so it follows the language.
        window.__I18N__ = {
          locale: i18n.locale,
          available: i18n.available,
          catalog: i18n.catalog,
          fallback: i18n.fallback
        };
        await savePreference({ locale: i18n.locale });
        // The colour schemes carry their display name in the language that is in
        // effect, so the list is read again now that the language is stored.
        await loadThemes();
      } catch (err) {
        showToast(t('toast.settingsSaveFailed', { msg: err.message }), 'error');
      }
    }

    function toggleLangMenu() {
      langMenuOpen.value = !langMenuOpen.value;
    }

    async function pickLanguage(code) {
      langMenuOpen.value = false;
      await changeLanguage(code);
    }

    // Clicking anywhere outside the menu closes it again.
    function onOverlayMouseDown(event) {
      const t = event.target;
      if (t && t.classList && t.classList.contains('modal-overlay')) {
        overlayPress = { target: t, x: event.clientX, y: event.clientY, moved: false };
      } else {
        overlayPress = null;
      }
    }
    function onOverlayMouseMove(event) {
      if (overlayPress && !overlayPress.moved) {
        const dx = event.clientX - overlayPress.x;
        const dy = event.clientY - overlayPress.y;
        if (dx * dx + dy * dy > 25) overlayPress.moved = true;
      }
    }
    function closeOnOverlayClick(event, closeFn) {
      if (overlayPress && !overlayPress.moved && overlayPress.target === event.target) {
        closeFn();
      }
      overlayPress = null;
    }

    function onDocumentPointerDown(event) {
      if (!langMenuOpen.value) return;
      const menu = document.querySelector('.lang-menu');
      if (menu && !menu.contains(event.target)) langMenuOpen.value = false;
    }

    async function loadThemes() {
      try {
        const res = await apiFetch('/api/themes');
        const json = await res.json();
        if (!json.success) return;
        themes.value = json.data.themes || [];
        if (json.data.tokens) colorTokens.value = json.data.tokens;
        if (json.data.options) optionTokens.value = json.data.options;
      } catch (err) {
        // The list is a convenience; the rest of the editor works without it.
      }
    }

    // Put a colour scheme on screen. The scheme is stored in the settings file, so
    // the next reload comes up in the same colours.
    async function applyThemeById(id) {
      const theme = themes.value.find((th) => th.id === id);
      if (!theme) return;
      currentTheme.value = theme.id;
      applyThemeVars(themeVarsOf(theme));
      try {
        await savePreference({ theme: theme.id });
      } catch (err) {
        showToast(t('toast.settingsSaveFailed', { msg: err.message }), 'error');
      }
    }

    function openAppearance() {
      showAppearance.value = true;
      loadThemes();
    }

    function editTheme(theme) {
      themeEditor.open = true;
      themeEditor.isNew = false;
      themeEditor.id = theme.id;
      themeEditor.name = theme.name;
      themeEditor.colors = { ...theme.colors };
      themeEditor.options = { ...theme.options };
    }

    // A new scheme starts from the colours on screen, so "make one like this" is one
    // click away.
    function newThemeFromCurrent() {
      const current = themes.value.find((th) => th.id === currentTheme.value);
      themeEditor.open = true;
      themeEditor.isNew = true;
      themeEditor.id = '';
      themeEditor.name = current ? current.name : '';
      themeEditor.colors = { ...(current ? current.colors : {}) };
      themeEditor.options = { ...(current ? current.options : {}) };
    }

    function duplicateTheme(theme) {
      themeEditor.open = true;
      themeEditor.isNew = true;
      themeEditor.id = '';
      themeEditor.name = theme.name;
      themeEditor.colors = { ...theme.colors };
      themeEditor.options = { ...theme.options };
    }

    // The id is the file name, so it has to be a plain name. A name that is already
    // taken gets a number behind it.
    function themeSlug(name) {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme';
      const taken = new Set(themes.value.map((th) => th.id));
      let id = base;
      let n = 2;
      while (taken.has(id)) { id = base + '-' + n; n++; }
      return id;
    }

    async function saveTheme() {
      const name = (themeEditor.name || '').trim();
      if (!name) { showToast(t('appearance.nameRequired'), 'error'); return; }
      const id = (themeEditor.id || '').trim() || (themeEditor.isNew ? themeSlug(name) : themeEditor.id);
      const theme = {
        id,
        name,
        author: '',
        builtin: false,
        colors: { ...themeEditor.colors },
        options: { ...themeEditor.options }
      };
      try {
        const res = await apiFetch('/api/themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(theme)
        });
        const json = await res.json();
        if (!json.success) {
          showToast(t('appearance.saveFailed', { msg: json.error }), 'error');
          return;
        }
        themes.value = json.data.themes || [];
        themeEditor.open = false;
        showToast(t('appearance.themeSaved', { name }));
        if (id === currentTheme.value) {
          const saved = themes.value.find((th) => th.id === id);
          if (saved) applyThemeVars(themeVarsOf(saved));
        }
      } catch (err) {
        showToast(t('appearance.saveFailed', { msg: err.message }), 'error');
      }
    }

    async function removeTheme(theme) {
      if (!confirm(t('appearance.deleteConfirm', { name: theme.name }))) return;
      try {
        const res = await apiFetch('/api/themes/' + encodeURIComponent(theme.id), { method: 'DELETE' });
        const json = await res.json();
        if (!json.success) {
          showToast(t('appearance.saveFailed', { msg: json.error }), 'error');
          return;
        }
        themes.value = json.data.themes || [];
        showToast(t('appearance.themeDeleted', { name: theme.name }));
        if (theme.id === currentTheme.value) {
          const fallback = themes.value.find((th) => !th.error) || themes.value[0];
          if (fallback) applyThemeById(fallback.id);
        }
      } catch (err) {
        showToast(t('appearance.saveFailed', { msg: err.message }), 'error');
      }
    }

    // Download a scheme as an INI file. The file is fetched with the same request
    // helper as everything else, so it works when the editor is password protected.
    async function exportTheme(theme) {
      try {
        const res = await apiFetch('/api/themes/' + encodeURIComponent(theme.id) + '/export');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || t('toast.unknownError'));
        const blob = new Blob([json.data.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = theme.id + '.ini';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(t('appearance.exported', { name: theme.name }));
      } catch (err) {
        showToast(t('appearance.saveFailed', { msg: err.message }), 'error');
      }
    }

    async function importThemeFile(event) {
      const input = event.target;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const content = await file.text();
        const res = await apiFetch('/api/themes/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        const json = await res.json();
        if (!json.success) {
          showToast(t('appearance.importFailed', { msg: json.error }), 'error');
          return;
        }
        themes.value = json.data.themes || [];
        showToast(t('appearance.imported', { name: json.data.imported }));
      } catch (err) {
        showToast(t('appearance.importFailed', { msg: err.message }), 'error');
      } finally {
        input.value = '';
      }
    }

    // Where the editor reads its config, where it writes backups, and where its own
    // settings live. Read-only, shown in the settings dialog so the operator can confirm
    // the deployment without reading the source.
    const runtimeInfo = reactive({
      configPath: '', configPathSource: '',
      backupPath: '', backupPathSource: '',
      settingsPath: '', settingsPathSource: '',
      port: '', portEffective: '', portSource: '',
      bindAddressEffective: '', bindAddressSource: '',
      placeholders: {}, fileValues: {},
      protection: { enabled: false, source: 'none', stored: false },
      initialized: false,
      restartRequired: false
    });
    const settingsForm = reactive({
      previewUrl: '', bindAddress: '', port: '',
      configPath: '', backupPath: '', settingsPath: '',
      protectionEnabled: false, password: '', locale: ''
    });
    const showPassword = ref(false);
    // True while the editor has no settings file yet: the setup dialog opens on the
    // first visit and stays until it is saved or explicitly skipped.
    const isFirstRun = ref(false);

    const editingGroup = reactive({ name: '', icon: '' });
    const editingItem = reactive({
      name: '', href: '', description: '', target: '',
      icon: '', iconType: 'mdi',
      siteMonitor: '', statusStyle: '', showStats: '',
      server: '', weight: '', namespace: '', app: '', podSelector: '',
      widgets: []
    });
    const editingBookmarkGroup = reactive({ name: '', icon: '' });
    const editingBookmarkItem = reactive({ name: '', href: '', abbr: '', description: '', icon: '', target: '' });
    // One information widget (widgets.yaml): its type and the options the
    // editor models. source keeps the raw object so unmodelled options
    // survive a save.
    const editingWidget = reactive({
      type: '', label: '', url: '', key: '', provider: '', target: '',
      latitude: '', longitude: '', cache: '', href: ''
    });
    // The group an edited bookmark belongs to. It is not a form field, so it stays
    // out of the reactive object the dialog binds to.
    let bookmarkItemGroupId = null;

    // Homepage's own appearance, read from the settings.yaml in the config
    // directory. The loaded values are kept next to the edited ones, so the editor
    // knows whether anything changed and only writes when it has to.
    const appearanceFields = [
      'theme', 'color', 'cardBlur', 'headerStyle', 'cardStyle', 'blockStyle',
      'iconStyle', 'font', 'backgroundImage', 'backgroundBlur',
      'backgroundSaturate', 'backgroundBrightness', 'backgroundOpacity'
    ];
    const appearance = reactive(Object.fromEntries(appearanceFields.map((f) => [f, ''])));
    const appearanceLoaded = reactive(Object.fromEntries(appearanceFields.map((f) => [f, ''])));
    const appearanceHash = ref(null);
    const appearanceMeta = ref({ palette: [], choices: {}, exists: false, path: '' });
    const appearanceReady = ref(false);

    // Homepage's custom.css. It is the official place for custom CSS and the only
    // way to change something Homepage has no setting for.
    //
    // The file is kept in parts: the font, one block per customised palette, and
    // the content the user wrote themselves. The editor changes the parts and
    // the server puts the file together again, so the order never goes wrong.
    const customCss = reactive({
      // The font: where it comes from, and the font on the visitor's own machine.
      // cdn is empty when there is no address, kind is 'css' for a stylesheet and
      // 'font' for a font file, and families are the names a stylesheet registers.
      font: { cdn: '', kind: '', families: [], local: '' },
      // What the probe found in the address.
      fontNote: '',
      // Palette id -> { css, seed }
      themes: {},
      free: '',
      hash: null,
      exists: false,
      // The official colour of every palette, and the parts as they were loaded,
      // so a change can be taken back.
      official: {},
      loadedParts: null
    });
    const customCssReady = ref(false);

    // The palette the custom CSS section works on: the one picked above.
    const customCssPalette = computed(() => appearance.color || 'slate');

    // The parts as they would be written right now.
    const customCssParts = computed(() => {
      const themes = {};
      for (const [id, entry] of Object.entries(customCss.themes)) {
        const css = typeof entry === 'string' ? entry : (entry && entry.css) || '';
        if (css.trim()) themes[id] = css;
      }
      return {
        font: {
          cdn: customCss.font.cdn,
          kind: customCss.font.kind,
          families: customCss.font.families,
          local: customCss.font.local
        },
        themes,
        free: customCss.free
      };
    });

    const customCssDirty = computed(() => {
      const loaded = customCss.loadedParts;
      if (!loaded) return false;
      return JSON.stringify(customCssParts.value) !== JSON.stringify(loaded);
    });

    // The seed colour of a palette: what the user picked, or the official colour
    // when the palette was not touched.
    function customCssSeed(paletteId) {
      const entry = customCss.themes[paletteId];
      if (entry && entry.seed) return entry.seed;
      const fromCss = ramp.readShades(entry ? entry.css : '')['500'];
      if (fromCss) return fromCss;
      return customCss.official[paletteId] || '#64748b';
    }

    // The CSS of the palette as it is now. A palette without a block shows what
    // it would look like, without that being written to the file.
    const customCssText = computed({
      get() {
        const id = customCssPalette.value;
        const entry = customCss.themes[id];
        if (entry) return typeof entry === 'string' ? entry : entry.css;
        const shades = ramp.generateRamp(customCssSeed(id));
        return shades ? ramp.rampCss(id, shades) : '';
      },
      set(value) {
        const id = customCssPalette.value;
        const entry = customCss.themes[id];
        if (entry && typeof entry === 'object') {
          entry.css = value;
          entry.seed = ramp.readShades(value)['500'] || entry.seed;
        } else {
          customCss.themes[id] = { css: value, seed: ramp.readShades(value)['500'] || customCssSeed(id) };
        }
      }
    });

    // The two rows of shades: the ones the seed gives, and the ones in the text.
    // The chip that is really in effect gets the outline.
    const customCssRampRows = computed(() => {
      const id = customCssPalette.value;
      const auto = ramp.generateRamp(customCssSeed(id)) || {};
      const manual = ramp.readShades(customCssText.value);
      return ramp.SHADE_NAMES.map((name) => {
        const autoValue = auto[name] || '';
        const manualValue = manual[name] || '';
        const differs = !!manualValue && manualValue.toUpperCase() !== autoValue.toUpperCase();
        return {
          name,
          auto: autoValue,
          manual: manualValue,
          // A shade the text does not set falls back to the official one.
          effective: differs ? 'manual' : 'auto'
        };
      });
    });

    // A new seed replaces the whole block of that palette, so the shades and
    // the text stay in step.
    function setCustomCssSeed(paletteId, seed) {
      const shades = ramp.generateRamp(seed);
      if (!shades) return;
      customCss.themes[paletteId] = { css: ramp.rampCss(paletteId, shades), seed };
    }

    // Put the palette back to the state that was loaded from the file.
    function restoreCustomCssTheme(paletteId) {
      const loaded = customCss.loadedParts;
      if (!loaded) return;
      const before = loaded.themes && loaded.themes[paletteId];
      if (before) {
        customCss.themes[paletteId] = { css: before.css, seed: before.seed || customCssSeed(paletteId) };
      } else {
        delete customCss.themes[paletteId];
      }
    }

    // Put the palette back to the colour Homepage ships.
    function resetCustomCssTheme(paletteId) {
      delete customCss.themes[paletteId];
    }

    // Throw away every customisation: the palettes and the font.
    function resetAllCustomCss() {
      customCss.themes = {};
      customCss.font = { cdn: '', kind: '', families: [], local: '' };
      customCss.fontNote = '';
    }

    // Throw everything away and write it at once, so there is no doubt about
    // what is on the disk.
    async function confirmResetAllCustomCss() {
      if (!confirm(t('appearance.resetAllConfirm'))) return false;
      resetAllCustomCss();
      try {
        await saveCustomCss();
        // The settings file is read again, so what is on the disk is what the
        // form shows.
        await loadAppearance();
        await revalidatePreview();
        showToast(t('toast.saved'));
        refreshPreview();
        return true;
      } catch (err) {
        showToast(t('toast.saveFailed', { msg: err.message }), 'error');
        return false;
      }
    }

    // Find out what the address holds: a stylesheet with font-face rules, or a
    // font file. A stylesheet registers its font under the name the author gave
    // it, and the page has to ask for that name, so it is read out here.
    async function probeFontUrl() {
      const url = (customCss.font.cdn || '').trim();
      if (!url) {
        customCss.font.kind = '';
        customCss.font.families = [];
        customCss.fontNote = '';
        return;
      }
      try {
        const res = await apiFetch('/api/homepage-font-probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || t('toast.unknownError'));
        const data = json.data || {};
        customCss.font.kind = data.kind || '';
        customCss.font.families = data.families || [];
        if (data.kind === 'font') {
          // A font file does not say what it is called, and it does not have to:
          // the editor gives it a label of its own.
          customCss.fontNote = t('appearance.fontIsFile');
        } else if (customCss.font.families.length) {
          customCss.fontNote = t('appearance.fontFound', { name: customCss.font.families.join(', ') });
        } else {
          customCss.fontNote = t('appearance.fontUnknown');
        }
      } catch (err) {
        customCss.font.kind = '';
        customCss.font.families = [];
        customCss.fontNote = t('appearance.fontProbeFailed', { msg: err.message });
      }
    }

    // Drag state
    let dragSource = null;

    // Computed
    const totalItems = computed(() => groups.value.reduce((sum, g) => sum + g.items.length, 0));
    // Both tabs reuse the same reorder, drag and group-move code, so the group
    // list those functions operate on follows the tab that is on screen.
    const activeGroups = computed(() => activeTab.value === 'bookmarks' ? bookmarkGroups.value : groups.value);
    const activeTotalItems = computed(() => activeGroups.value.reduce((sum, g) => sum + g.items.length, 0));
    // A tab switch would otherwise leave the drag indicator pointing at a group
    // that is no longer on screen, so it clears with the tab.
    watch(activeTab, () => {
      dropIndex.value = null;
      dragOverGroup.value = null;
      draggingItem.value = null;
    });
    const isColumn = computed(() => viewportWidth.value > 768);
    const hasPreviewUrl = computed(() => !!previewUrl.value);
    // An empty src would make the iframe load the editor itself, so fall back to a blank
    // document and let the overlay ask for a URL instead.
    // The counter in the query string keeps the preview from being served from the
    // browser cache, so a reload really asks the dashboard for the current state.
    const previewSrc = computed(() => {
      if (!previewUrl.value) return 'about:blank';
      const separator = previewUrl.value.includes('?') ? '&' : '?';
      return previewUrl.value + separator + '_hcms=' + previewKey.value;
    });
    const previewSourceLabel = computed(() => ({
      'settings-file': t('source.previewSettingsFile'),
      'env': t('source.previewEnv'),
      'unset': t('source.previewUnset')
    })[previewUrlSource.value] || t('source.unknown'));
    // Where a setting currently comes from, for the hint under each field.
    function sourceLabel(source) {
      return ({
        'settings-file': t('source.settingsFile'),
        'env': t('source.env'),
        'default': t('source.default'),
        'unset': t('source.unset'),
        'none': t('source.none')
      })[source] || t('source.unknown');
    }

    // Layout: the preview panel keeps a fixed flex-basis while the editor fills whatever
    // is left, so collapsing actually moves the divider instead of only hiding the iframe.
    const COLLAPSED_COLUMN_WIDTH = 44;
    const COLLAPSED_MOBILE_HEIGHT = 38;

    const editorPanelStyle = computed(() => {
      if (!showPreview.value) return {};
      return isColumn.value
        ? { flex: '1 1 0', width: 'auto', minWidth: '0' }
        : { flex: '1 1 0', height: 'auto', minHeight: '0' };
    });

    const previewPanelStyle = computed(() => {
      if (!showPreview.value) return {};
      if (isColumn.value) {
        const basis = previewCollapsed.value
          ? COLLAPSED_COLUMN_WIDTH + 'px'
          : (100 - splitRatio.value) + '%';
        return {
          flex: '0 0 ' + basis,
          width: basis,
          minWidth: '0',
          maxWidth: previewCollapsed.value ? COLLAPSED_COLUMN_WIDTH + 'px' : 'none'
        };
      }
      const basis = previewCollapsed.value
        ? COLLAPSED_MOBILE_HEIGHT + 'px'
        : (100 - splitRatio.value) + '%';
      return {
        flex: '0 0 ' + basis,
        height: basis,
        minHeight: '0',
        maxHeight: previewCollapsed.value ? COLLAPSED_MOBILE_HEIGHT + 'px' : 'none'
      };
    });

    // The shell must be exactly as tall as the area the user can see. dvh is only a
    // starting guess: on some mobile browsers it resolves to the layout viewport (the
    // URL-bar-hidden height) instead of the visible area, which pushes the bottom of the
    // shell - including the collapsed preview strip and the last service group - below
    // the reachable part of the screen while overflow is hidden. Measuring the visual
    // viewport directly is what keeps that from happening.
    function visibleHeight() {
      const vv = window.visualViewport;
      // When zoomed in, the visual viewport is only the magnified slice; lay out against
      // the layout viewport instead so the page is not shrunk to the zoom window.
      if (vv && vv.scale && vv.scale > 1.01) return window.innerHeight;
      // The reachable area is never larger than either viewport reports, so take the
      // smaller of the two. On mobile Chrome/Firefox innerHeight is the large layout
      // viewport while visualViewport is the visible area; on iOS innerHeight already
      // tracks the visible area. The minimum is correct in both cases.
      return vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight;
    }

    let syncScheduled = false;
    let lastAppliedHeight = 0;
    function applyViewport() {
      syncScheduled = false;
      viewportWidth.value = window.innerWidth;
      const h = Math.round(visibleHeight());
      // visualViewport scrolls constantly while the page is panned, so only write when the
      // measured height actually changes; a redundant write would force needless layout.
      if (h > 0 && h !== lastAppliedHeight) {
        lastAppliedHeight = h;
        document.documentElement.style.setProperty('--app-height', h + 'px');
      }
    }

    function syncViewport() {
      // Coalesce the burst of resize/scroll events the URL bar produces into one layout.
      if (syncScheduled) return;
      syncScheduled = true;
      requestAnimationFrame(applyViewport);
    }

    // The full list of widget types upstream knows, so the dialog can offer
    // every integration instead of only the few the editor models.
    const widgetTypes = ref((window.__WIDGET_TYPES__ || []).slice());

    // A known type shows its own name; an unmodelled one (a newer Homepage
    // type this editor does not know) shows the raw value with a marker.
    function widgetTypeLabel(type) {
      if (!type) return t('item.widgetNone');
      if (widgetTypes.value.includes(type)) return type;
      return type + ' *';
    }

    // The value one should type for a widget type, so the dialog can hint at
    // the right field.
    function widgetValueHint(type) {
      switch (type) {
        case 'docker': return t('item.widgetValueContainer');
        case 'ping': return t('item.widgetValuePing');
        case 'customapi': return t('item.widgetValueCustomApi');
        default: return t('item.widgetValue');
      }
    }

    // The icon preview helpers (isMdiIcon, mdiClassOf, iconPreviewUrl) live at
    // module scope next to the shared icon-field component; the return object
    // below still exposes them so the in-list previews can use them.

    // Helpers
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    function showToast(msg, type = 'success') {
      toast.msg = msg;
      toast.type = type;
      toast.show = true;
      setTimeout(() => { toast.show = false; }, 3000);
    }

    // The widget types a card shows as badges, the first three plus a count
    // of the rest.
    function itemWidgetBadges(item) {
      const types = (item.widgets || []).map((w) => w && w.type).filter(Boolean);
      if (!types.length) return null;
      const shown = types.slice(0, 3);
      const extra = types.length - shown.length;
      return extra > 0 ? [...shown, '+' + extra] : shown;
    }

    // The icon of a widget card: the mdi glyph of the type, falling back to a
    // generic widget.
    function widgetIconClass(type) {
      const known = {
        resources: 'mdi-speedometer', search: 'mdi-magnify', calendar: 'mdi-calendar',
        datetime: 'mdi-clock', greeting: 'mdi-account', logo: 'mdi-image',
        weather: 'mdi-weather-partly-cloudy', glances: 'mdi-gauge',
        kubernetes: 'mdi-sailboat', stocks: 'mdi-candle-variant',
        unifi_controller: 'mdi-router-network', openmeteo: 'mdi-weather-partly-cloudy',
        openweathermap: 'mdi-weather-partly-cloudy', feed: 'mdi-rss-box',
        iframe: 'mdi-view-agenda', customapi: 'mdi-api'
      };
      return 'mdi-' + (known[type] || 'widget');
    }

    // One line under the type: the options that are set, joined.
    function widgetCardSummary(w) {
      const parts = [];
      if (w.label) parts.push('label: ' + w.label);
      if (w.url) parts.push('url: ' + w.url);
      if (w.provider) parts.push('provider: ' + w.provider);
      if (w.key) parts.push('key: set');
      if (w.href) parts.push('href: ' + w.href);
      return parts.join('  ');
    }

    // The multi-widget editor inside the item dialog: add / remove a row.
    function addWidgetRow() {
      editingItem.widgets.push({ ...blankWidget() });
    }

    function removeWidgetRow(index) {
      editingItem.widgets.splice(index, 1);
    }

    // Load data
    async function loadServices() {
      try {
        const res = await apiFetch('/api/services');
        const json = await res.json();
        if (json.success && json.data) {
          groups.value = parseYamlData(json.data);
          servicesHash.value = json.hash || null;
        }
      } catch (err) {
        showToast(t('toast.loadFailed', { msg: err.message }), 'error');
      }
    }

    // Load bookmarks
    async function loadBookmarks() {
      try {
        const res = await apiFetch('/api/bookmarks');
        const json = await res.json();
        if (json.success && json.data) {
          bookmarkGroups.value = parseBookmarkData(json.data);
          bookmarksHash.value = json.hash || null;
        }
      } catch (err) {
        showToast(t('toast.loadBookmarksFailed', { msg: err.message }), 'error');
      }
    }

    function parseBookmarkData(data) {
      if (!Array.isArray(data)) return [];
      return data.map(groupObj => {
        const name = Object.keys(groupObj)[0];
        const items = groupObj[name] || [];
        return {
          id: uid(),
          name,
          sourceName: name,
          source: groupObj,
          collapsed: false,
          items: items.map(entry => {
            const itemName = Object.keys(entry)[0];
            const raw = entry[itemName];
            // Upstream stores the bookmark fields as a list holding one mapping.
            const conf = Array.isArray(raw) ? (raw[0] || {}) : (raw || {});
            return {
              id: uid(),
              name: itemName,
              abbr: conf.abbr || itemName.slice(0, 2).toUpperCase(),
              href: conf.href || '',
              description: conf.description || '',
              icon: conf.icon || '',
              target: conf.target || '',
              source: conf
            };
          })
        };
      });
    }

    // ---- YAML ----
    // The editor keeps the parsed YAML objects and writes them back with only the
    // fields it actually edited replaced. Fields the editor does not model
    // (siteMonitor, widget, server, ...) therefore survive a save untouched.
    const yamlLib = window.jsyaml;
    const SERVICES_HEADER =
      '---\n# For configuration options and examples, please see:\n' +
      '# https://gethomepage.dev/configs/services/\n\n';
    const BOOKMARKS_HEADER =
      '---\n# For configuration options and examples, please see:\n' +
      '# https://gethomepage.dev/configs/bookmarks\n\n';
    const WIDGETS_HEADER =
      '---\n# For configuration options and examples, please see:\n' +
      '# https://gethomepage.dev/configs/info-widgets/\n\n';

    function setOrDelete(obj, key, value) {
      if (value) obj[key] = value; else delete obj[key];
    }

    // Every API call carries the password when the server asks for one. A 401 opens
    // the password prompt instead of failing silently.
    async function apiFetch(url, options = {}) {
      const headers = Object.assign({}, options.headers || {});
      if (apiPassword.value) headers['X-CMS-Password'] = apiPassword.value;
      // The server replies in the language the editor is showing.
      headers['Accept-Language'] = i18n.locale;
      const res = await fetch(BASE + url, Object.assign({}, options, { headers, cache: 'no-store' }));
      if (res.status === 401) {
        // The stored password is wrong or gone: forget it and ask again.
        apiPassword.value = '';
        localStorage.removeItem('hcms-password');
        authState.locked = true;
        showPasswordPrompt.value = true;
        const err = new Error(t('toast.needPassword'));
        err.unauthorized = true;
        throw err;
      }
      // A server that does not know the route answers with an HTML error page.
      // That happens when the page is newer than the running backend, for example
      // after an update without a restart. Say that, instead of letting the JSON
      // parser choke on the markup.
      const type = res.headers.get('content-type') || '';
      if (!type.includes('application/json')) {
        const err = new Error(t('toast.backendOutdated'));
        err.outdated = true;
        throw err;
      }
      return res;
    }

    function submitPassword() {
      apiPassword.value = passwordInput.value;
      if (apiPassword.value) localStorage.setItem('hcms-password', apiPassword.value);
      else localStorage.removeItem('hcms-password');
      showPasswordPrompt.value = false;
      passwordInput.value = '';
      authState.locked = false;
      // Whatever was blocked by the 401 is loaded again, now with the password.
      loadSettings();
      loadServices();
      loadBookmarks();
      loadWidgets();
      loadLayoutSettings();
      checkForUpdates();
    }

    // The password is checked before anything else is loaded. Otherwise every request
    // would come back unauthorized, the editor would show an empty page and the
    // prompt would appear only after the user had already clicked around.
    async function initAuth() {
      try {
        const res = await fetch(BASE + '/api/auth', { cache: 'no-store' });
        const json = await res.json();
        authState.required = !!(json.data && json.data.required);
      } catch (err) {
        authState.required = false;
      }
      authState.checked = true;
      if (authState.required && !apiPassword.value) {
        authState.locked = true;
        showPasswordPrompt.value = true;
        return false;
      }
      return true;
    }

    // Dismissing the prompt leaves the editor in a clear "locked" state with a button
    // to come back, instead of a half-loaded page that asks for the password again.
    function dismissPasswordPrompt() {
      showPasswordPrompt.value = false;
      if (authState.required) authState.locked = true;
    }

    // The first visit opens the setup dialog. Skipping it leaves the editor without
    // a settings file, so the dialog opens again on the next visit.
    function skipSetup() {
      isFirstRun.value = false;
      showSettings.value = false;
    }

    function parseYamlData(data) {
      if (!Array.isArray(data)) return [];
      return data.map(groupObj => {
        const name = Object.keys(groupObj)[0];
        const items = groupObj[name] || [];
        return {
          id: uid(),
          name,
          sourceName: name,
          source: groupObj,
          collapsed: false,
          items: items.map(item => parseServiceItem(Object.keys(item)[0], item[Object.keys(item)[0]]))
        };
      });
    }

    function parseServiceItem(itemName, conf) {
      if (Array.isArray(conf)) {
        // A nested group (upstream allows groups inside groups). The editor cannot
        // model it, so it is kept exactly as it was.
        return { id: uid(), name: itemName, href: '', description: '', target: '',
          icon: '', iconType: 'mdi',
          server: '', weight: '', namespace: '', app: '', podSelector: '',
          siteMonitor: '', statusStyle: '', showStats: '',
          widgets: [], nested: true, source: conf };
      }
      const config = conf && typeof conf === 'object' ? conf : {};
      const icon = config.icon || '';
      // A URL icon is previewed as an image; everything else (mdi-, si-, sh-,
      // dashboard-icons names) is previewed as a class / best-effort.
      const iconType = (icon.startsWith('http') || icon.startsWith('//')) ? 'url' : 'mdi';
      return {
        id: uid(),
        name: itemName,
        href: config.href || '',
        description: config.description || '',
        target: config.target || '',
        icon, iconType,
        server: config.server || '',
        weight: (config.weight ?? '') === '' ? '' : String(config.weight),
        namespace: config.namespace || '',
        app: config.app || '',
        podSelector: config.podSelector || '',
        siteMonitor: config.siteMonitor || '',
        statusStyle: config.statusStyle || '',
        showStats: config.showStats === true ? 'true' : config.showStats === false ? 'false' : '',
        widgets: normalizeWidgets(config),
        nested: false,
        source: config
      };
    }

    // A widget entry, normalised for the dialog. `source` keeps the raw object
    // so the keys the editor does not model (headers, highlight, ...) survive a
    // save. `dialect` records which shape the value came from, so writing back
    // keeps the file's original style.
    const WIDGET_FIELDS = ['url', 'key', 'host', 'container', 'fields', 'hideErrors'];
    function blankWidget() {
      return { type: '', url: '', key: '', host: '', container: '', fields: '', hideErrors: '', source: {}, dialect: 'widget' };
    }
    function normalizeWidget(raw, dialect) {
      const o = raw && typeof raw === 'object' ? raw : {};
      return {
        type: o.type ? String(o.type) : '',
        url: o.url != null ? String(o.url) : '',
        key: o.key != null ? String(o.key) : '',
        host: o.host != null ? String(o.host) : '',
        container: o.container != null ? String(o.container) : '',
        fields: Array.isArray(o.fields) ? o.fields.join(', ') : (typeof o.fields === 'string' ? o.fields : ''),
        hideErrors: o.hideErrors === true ? 'true' : o.hideErrors === false ? 'false' : '',
        source: o,
        dialect
      };
    }

    // Every widget a service carries, whichever shape the file uses: the single
    // `widget` object, the legacy service-level `customapi`/`container`/`ping`
    // fields, and the plural `widgets` list.
    function normalizeWidgets(config) {
      const out = [];
      if (config.widget && typeof config.widget === 'object') {
        out.push(normalizeWidget(config.widget, 'widget'));
      } else if (config.customapi != null) {
        out.push({ ...blankWidget(), type: 'customapi', url: String(config.customapi), source: { customapi: config.customapi }, dialect: 'legacy-customapi' });
      } else if (config.container != null) {
        out.push({ ...blankWidget(), type: 'docker', container: String(config.container), source: { container: config.container }, dialect: 'legacy-container' });
      } else if (config.ping != null) {
        out.push({ ...blankWidget(), type: 'ping', host: String(config.ping), source: { ping: config.ping }, dialect: 'legacy-ping' });
      }
      if (Array.isArray(config.widgets)) {
        for (const w of config.widgets) out.push(normalizeWidget(w, 'widgets'));
      }
      return out;
    }

    // Rebuild the widget object from the dialog values, keeping the keys the
    // editor does not model.
    function buildWidgetObject(w) {
      const o = { ...(w.source && typeof w.source === 'object' ? w.source : {}) };
      WIDGET_FIELDS.forEach((k) => delete o[k]);
      o.type = w.type;
      const set = (k, v) => { v ? (o[k] = v) : delete o[k]; };
      set('url', w.url.trim());
      set('key', w.key.trim());
      set('host', w.host.trim());
      set('container', w.container.trim());
      const fields = w.fields.split(',').map((s) => s.trim()).filter(Boolean);
      if (fields.length) o.fields = fields; else delete o.fields;
      if (w.hideErrors === 'true') o.hideErrors = true;
      else if (w.hideErrors === 'false') o.hideErrors = false;
      else delete o.hideErrors;
      return o;
    }

    // A legacy single widget only keeps its original shape when it carries no
    // extra fields; otherwise it becomes a `widget` object.
    function legacyIsPlain(w) {
      const filled = WIDGET_FIELDS.filter((k) => {
        const v = w[k];
        return String(v || '').trim() !== '';
      });
      const primary = w.dialect === 'legacy-customapi' ? 'url' : w.dialect === 'legacy-container' ? 'container' : 'host';
      return filled.length === 1 && filled[0] === primary;
    }

    // Write the widgets back, clearing every representation first so a type
    // change does not leave the old one behind.
    function writeWidgets(conf, item) {
      delete conf.widget; delete conf.widgets;
      delete conf.customapi; delete conf.container; delete conf.ping;
      const widgets = (item.widgets || []).filter((w) => w && w.type);
      if (!widgets.length) return;
      if (widgets.length === 1) {
        const w = widgets[0];
        if (w.dialect.startsWith('legacy') && legacyIsPlain(w)) {
          if (w.dialect === 'legacy-customapi') conf.customapi = w.url.trim();
          else if (w.dialect === 'legacy-container') conf.container = w.container.trim();
          else conf.ping = w.host.trim();
          return;
        }
        conf.widget = buildWidgetObject(w);
        return;
      }
      conf.widget = buildWidgetObject(widgets[0]);
      conf.widgets = widgets.slice(1).map(buildWidgetObject);
    }

    // Save
    async function save() {
      saving.value = true;
      try {
        const yaml = buildYaml();
        const res = await apiFetch('/api/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: yaml, hash: servicesHash.value })
        });
        const json = await res.json();
        if (json.success) {
          servicesHash.value = json.hash || null;
          showToast(t('toast.saved'));
          refreshPreview();
        } else {
          showToast(t('toast.saveFailed', { msg: json.error }), 'error');
        }
      } catch (err) {
        showToast(t('toast.saveFailed', { msg: err.message }), 'error');
      }
      saving.value = false;
    }

    async function saveAll() {
      saving.value = true;
      try {
        // services.yaml and bookmarks.yaml are independent files, so they are
        // written in parallel; the custom stylesheet may go with them.
        const jobs = [
          apiFetch('/api/services', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: buildYaml(), hash: servicesHash.value })
          }),
          apiFetch('/api/bookmarks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: buildBookmarkYaml(), hash: bookmarksHash.value })
          })
        ];
        // The information widgets are a third independent file, written with the
        // others so a single save captures the whole dashboard.
        jobs.push(apiFetch('/api/widgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: buildWidgetsYaml(), hash: widgetsHash.value })
        }));
        if (customCssDirty.value) {
          jobs.push(apiFetch('/api/homepage-custom-css', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parts: customCssParts.value, hash: customCss.hash })
          }));
        }
        const results = await Promise.all(jobs);
        const svcJson = await results[0].json();
        const bmJson = await results[1].json();
        const widgetsJson = await results[2].json();
        const cssJson = results[3] ? await results[3].json() : null;
        if (!svcJson.success || !bmJson.success || !widgetsJson.success || (cssJson && !cssJson.success)) {
          const failed = [svcJson, bmJson, widgetsJson, cssJson].find((j) => j && !j.success);
          showToast(t('toast.saveFailed', { msg: (failed && failed.error) || '' }), 'error');
          saving.value = false;
          return;
        }
        servicesHash.value = svcJson.hash || null;
        bookmarksHash.value = bmJson.hash || null;
        widgetsHash.value = widgetsJson.hash || null;
        if (cssJson) {
          customCss.hash = cssJson.hash || null;
          customCss.exists = true;
          customCss.loadedParts = JSON.parse(JSON.stringify(customCssParts.value));
        }

        // Two tabs write settings.yaml: the visual fields and the layout
        // block. The file is written one step at a time and the second writer
        // takes the hash the first one returned, so the two saves do not
        // refuse each other.
        let settingsTouched = false;
        if (appearanceDirty.value) {
          const res = await apiFetch('/api/homepage-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              values: Object.fromEntries(appearanceFields.map((f) => [f, appearance[f] || ''])),
              hash: appearanceHash.value
            })
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || t('toast.unknownError'));
          appearanceHash.value = json.hash || null;
          layoutHash.value = json.hash || null;
          const saved = json.data.values || {};
          for (const field of appearanceFields) appearanceLoaded[field] = saved[field] || '';
          settingsTouched = true;
        }
        if (layoutDirty.value) {
          const res = await apiFetch('/api/homepage-layout', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              values: Object.fromEntries(LAYOUT_GLOBAL_KEYS.map((k) => [k, layoutValues[k] || ''])),
              groups: layoutGroups.value,
              hash: layoutHash.value
            })
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || t('toast.unknownError'));
          appearanceHash.value = json.hash || null;
          layoutHash.value = json.hash || null;
          const savedValues = (json.data && json.data.values) || {};
          for (const key of LAYOUT_GLOBAL_KEYS) layoutLoadedValues[key] = savedValues[key] || '';
          if (json.data && Array.isArray(json.data.groups)) {
            layoutGroups.value = json.data.groups.map((g) => ({ ...g }));
            layoutMeta.value.groups = json.data.groups;
          }
          settingsTouched = true;
        }

        // The dashboard caches its settings in the memory of its process, so
        // the preview would show the old values without this.
        if (settingsTouched || cssJson) {
          const revalidated = await revalidatePreview();
          if (!revalidated) {
            showToast(t('toast.revalidateNeeded'), 'error');
            saving.value = false;
            return;
          }
        }
        showToast(t('toast.saved'));
        refreshPreview();
      } catch (err) {
        showToast(t('toast.saveFailed', { msg: err.message }), 'error');
      }
      saving.value = false;
    }

    function buildYaml() {
      const doc = groups.value.map(group => {
        const items = group.items.map(item => {
          const entry = {};
          if (item.nested) {
            // A nested group stays exactly as it was.
            entry[item.name] = item.source;
            return entry;
          }
          const conf = { ...(item.source || {}) };
          writeWidgets(conf, item);
          setOrDelete(conf, 'href', item.href);
          setOrDelete(conf, 'target', item.target);
          setOrDelete(conf, 'description', item.description);
          setOrDelete(conf, 'icon', item.icon);
          setOrDelete(conf, 'siteMonitor', (item.siteMonitor || '').trim());
          setOrDelete(conf, 'statusStyle', (item.statusStyle || '').trim());
          setOrDelete(conf, 'server', (item.server || '').trim());
          setOrDelete(conf, 'namespace', (item.namespace || '').trim());
          setOrDelete(conf, 'app', (item.app || '').trim());
          setOrDelete(conf, 'podSelector', (item.podSelector || '').trim());
          if (item.showStats === 'true') conf.showStats = true;
          else if (item.showStats === 'false') conf.showStats = false;
          else delete conf.showStats;
          const weightRaw = String(item.weight ?? '').trim();
          if (weightRaw === '') delete conf.weight;
          else {
            const weightNum = Number(weightRaw);
            conf.weight = Number.isFinite(weightNum) ? weightNum : weightRaw;
          }
          entry[item.name] = conf;
          return entry;
        });
        const obj = {};
        // The group name has to stay the first key: upstream reads the first key of a
        // group object as the group name.
        obj[group.name] = items;
        for (const [key, value] of Object.entries(group.source || {})) {
          // col-span is not read by upstream; it flows through as an unmodelled
          // field like any other key in group.source.
          if (key === group.sourceName) continue;
          obj[key] = value;
        }
        return obj;
      });
      return SERVICES_HEADER + yamlLib.dump(doc, { lineWidth: -1 });
    }

    // Group CRUD

    // The settings.yaml layout entry of a group, shared by the service and the
    // bookmark group dialogs so the two cannot drift: read the icon the group's
    // layout entry carries, and (re)write it when the group is created or
    // renamed.
    function groupLayoutIconOf(name) {
      const entry = layoutGroups.value.find((g) => g.name === name);
      return entry ? (entry.icon || '') : '';
    }

    function syncGroupLayoutIcon(oldName, newName, icon) {
      const li = oldName ? layoutGroups.value.findIndex((x) => x.name === oldName) : -1;
      if (li >= 0) {
        layoutGroups.value[li].name = newName;
        setOrDelete(layoutGroups.value[li], 'icon', icon);
      } else if (icon) {
        layoutGroups.value.push({ name: newName, icon, source: {} });
      }
    }

    function addGroup() {
      editingGroupId.value = null;
      editingGroup.name = '';
      editingGroup.icon = '';
      showGroupModal.value = true;
    }

    function editGroup(group) {
      editingGroupId.value = group.id;
      editingGroup.name = group.name;
      editingGroup.icon = groupLayoutIconOf(group.name);
      showGroupModal.value = true;
    }

    function saveGroup() {
      if (!editingGroup.name.trim()) { showToast(t('group.nameRequired'), 'error'); return; }
      const newName = editingGroup.name.trim();
      const icon = editingGroup.icon.trim();
      if (editingGroupId.value) {
        const g = groups.value.find(g => g.id === editingGroupId.value);
        if (g) {
          const oldName = g.name;
          g.name = newName;
          syncGroupLayoutIcon(oldName, newName, icon);
        }
      } else {
        groups.value.push({ id: uid(), name: newName, collapsed: false, items: [] });
        syncGroupLayoutIcon(null, newName, icon);
      }
      showGroupModal.value = false;
    }

    function deleteGroup(gi) {
      const g = groups.value[gi];
      if (!confirm(t('group.confirmDelete', { name: g.name, count: g.items.length }))) return;
      groups.value.splice(gi, 1);
    }

    function toggleGroup(group) { group.collapsed = !group.collapsed; }

    // Bookmark CRUD
    function addBookmarkGroup() {
      editingBookmarkGroupId.value = null;
      editingBookmarkGroup.name = '';
      editingBookmarkGroup.icon = '';
      showBookmarkGroupModal.value = true;
    }

    function editBookmarkGroup(group) {
      editingBookmarkGroupId.value = group.id;
      editingBookmarkGroup.name = group.name;
      editingBookmarkGroup.icon = groupLayoutIconOf(group.name);
      showBookmarkGroupModal.value = true;
    }

    function saveBookmarkGroup() {
      const name = editingBookmarkGroup.name.trim();
      if (!name) { showToast(t('bookmark.groupNameRequired'), 'error'); return; }
      const icon = editingBookmarkGroup.icon.trim();
      if (editingBookmarkGroupId.value) {
        const group = bookmarkGroups.value.find(g => g.id === editingBookmarkGroupId.value);
        if (group) {
          const oldName = group.name;
          group.name = name;
          syncGroupLayoutIcon(oldName, name, icon);
        }
      } else {
        bookmarkGroups.value.push({
          id: uid(), name, sourceName: name, source: {}, collapsed: false, items: []
        });
        syncGroupLayoutIcon(null, name, icon);
      }
      showBookmarkGroupModal.value = false;
    }

    function deleteBookmarkGroup(gi) {
      const g = bookmarkGroups.value[gi];
      if (!confirm(t('bookmark.confirmDeleteGroup', { name: g.name, count: g.items.length }))) return;
      bookmarkGroups.value.splice(gi, 1);
    }

    function addBookmarkItem(group) {
      editingBookmarkItemId.value = null;
      Object.assign(editingBookmarkItem, { name: '', href: '', abbr: '', description: '', icon: '', target: '' });
      bookmarkItemGroupId = group.id;
      showBookmarkItemModal.value = true;
    }

    function editBookmarkItem(group, item) {
      editingBookmarkItemId.value = item.id;
      Object.assign(editingBookmarkItem, { name: item.name, href: item.href, abbr: item.abbr, description: item.description || '', icon: item.icon || '', target: item.target || '' });
      bookmarkItemGroupId = group.id;
      showBookmarkItemModal.value = true;
    }

    function saveBookmarkItem() {
      const name = editingBookmarkItem.name.trim();
      if (!name) { showToast(t('bookmark.nameRequired'), 'error'); return; }
      const href = editingBookmarkItem.href.trim();
      if (!href) { showToast(t('bookmark.hrefRequired'), 'error'); return; }
      const group = bookmarkGroups.value.find(g => g.id === bookmarkItemGroupId);
      if (!group) { showToast(t('item.groupNotFound'), 'error'); return; }
      const abbr = editingBookmarkItem.abbr.trim().toUpperCase() || name.slice(0, 2).toUpperCase();
      const description = (editingBookmarkItem.description || '').trim();
      const icon = (editingBookmarkItem.icon || '').trim();
      const target = editingBookmarkItem.target;
      if (editingBookmarkItemId.value) {
        const item = group.items.find(i => i.id === editingBookmarkItemId.value);
        if (item) {
          item.name = name;
          item.href = href;
          item.abbr = abbr;
          item.description = description;
          item.icon = icon;
          item.target = target;
        }
      } else {
        group.items.push({ id: uid(), name, href, abbr, description, icon, target, source: {} });
      }
      showBookmarkItemModal.value = false;
    }

    function deleteBookmarkItem(group, ii) {
      if (!confirm(t('bookmark.confirmDelete', { name: group.items[ii].name }))) return;
      group.items.splice(ii, 1);
    }

    function buildBookmarkYaml() {
      const doc = bookmarkGroups.value.map(group => {
        const items = group.items.map(item => {
          const props = { ...(item.source || {}) };
          setOrDelete(props, 'abbr', item.abbr);
          setOrDelete(props, 'href', item.href);
          setOrDelete(props, 'description', (item.description || '').trim());
          setOrDelete(props, 'icon', (item.icon || '').trim());
          setOrDelete(props, 'target', item.target);
          const entry = {};
          entry[item.name] = [props];
          return entry;
        });
        const obj = {};
        obj[group.name] = items;
        for (const [key, value] of Object.entries(group.source || {})) {
          if (key === group.sourceName) continue;
          obj[key] = value;
        }
        return obj;
      });
      return BOOKMARKS_HEADER + yamlLib.dump(doc, { lineWidth: -1 });
    }

    async function saveBookmarks() {
      try {
        const yaml = buildBookmarkYaml();
        const res = await apiFetch('/api/bookmarks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: yaml, hash: bookmarksHash.value })
        });
        const json = await res.json();
        if (json.success) {
          bookmarksHash.value = json.hash || null;
          showToast(t('toast.bookmarksSaved'));
        } else {
          showToast(t('toast.bookmarksSaveFailed', { msg: json.error }), 'error');
        }
      } catch (err) {
        showToast(t('toast.bookmarksSaveFailed', { msg: err.message }), 'error');
      }
    }

    // ---- Information widgets (widgets.yaml) ----
    // The dashboard's top strip. Upstream stores the file as a list of
    // single-key objects ( one key = the widget type ); the editor keeps
    // the options it does not model, so a save only replaces what was
    // actually edited.
    const WIDGET_OPTION_FIELDS = ['label', 'url', 'key', 'provider', 'target', 'latitude', 'longitude', 'cache', 'href'];

    function parseWidgetsData(data) {
      if (!Array.isArray(data)) return [];
      return data.map((entry) => {
        const name = Object.keys(entry || {})[0];
        const raw = entry && entry[name];
        const conf = raw && typeof raw === 'object' ? raw : {};
        return {
          id: uid(),
          type: name || '',
          label: conf.label || '',
          url: conf.url || '',
          key: conf.key != null ? String(conf.key) : '',
          provider: conf.provider || '',
          target: conf.target || '',
          latitude: conf.latitude != null ? String(conf.latitude) : '',
          longitude: conf.longitude != null ? String(conf.longitude) : '',
          cache: conf.cache != null ? String(conf.cache) : '',
          href: conf.href || '',
          source: conf
        };
      });
    }

    async function loadWidgets() {
      try {
        const res = await apiFetch('/api/widgets');
        const json = await res.json();
        if (json.success) {
          widgets.value = parseWidgetsData(json.data);
          widgetsHash.value = json.hash || null;
        }
      } catch (err) {
        showToast(t('toast.loadWidgetsFailed', { msg: err.message }), 'error');
      }
    }

    function buildWidgetsYaml() {
      const doc = widgets.value.map((w) => {
        const conf = { ...(w.source || {}) };
        WIDGET_OPTION_FIELDS.forEach((field) => setOrDelete(conf, field, w[field]));
        // numbers stay numbers: cache / latitude / longitude
        if (conf.latitude !== undefined) conf.latitude = Number(w.latitude) || w.latitude;
        if (conf.longitude !== undefined) conf.longitude = Number(w.longitude) || w.longitude;
        if (conf.cache !== undefined && conf.cache !== '') conf.cache = Number(w.cache) || conf.cache;
        const entry = {};
        entry[w.type] = conf;
        return entry;
      });
      return WIDGETS_HEADER + yamlLib.dump(doc, { lineWidth: -1 });
    }

    async function saveWidgets() {
      try {
        const yaml = buildWidgetsYaml();
        const res = await apiFetch('/api/widgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: yaml, hash: widgetsHash.value })
        });
        const json = await res.json();
        if (json.success) {
          widgetsHash.value = json.hash || null;
          showToast(t('toast.widgetsSaved'));
        } else {
          showToast(t('toast.widgetsSaveFailed', { msg: json.error }), 'error');
        }
      } catch (err) {
        showToast(t('toast.widgetsSaveFailed', { msg: err.message }), 'error');
      }
    }

    // Widget CRUD: the new widget is added to the list, the dialog edits the
    // selected one, reordering is the up/down buttons of the list.
    function addWidget() {
      editingWidgetIndex.value = null;
      Object.assign(editingWidget, { type: '', label: '', url: '', key: '', provider: '', target: '', latitude: '', longitude: '', cache: '', href: '' });
      showWidgetModal.value = true;
    }

    function editWidget(index) {
      editingWidgetIndex.value = index;
      const w = widgets.value[index];
      Object.assign(editingWidget, {
        type: w.type, label: w.label, url: w.url, key: w.key,
        provider: w.provider, target: w.target, latitude: w.latitude,
        longitude: w.longitude, cache: w.cache, href: w.href
      });
      showWidgetModal.value = true;
    }

    function saveWidget() {
      const type = editingWidget.type.trim();
      if (!type) { showToast(t('widget.typeRequired'), 'error'); return; }
      const values = {
        type,
        label: editingWidget.label.trim(),
        url: editingWidget.url.trim(),
        key: editingWidget.key.trim(),
        provider: editingWidget.provider.trim(),
        target: editingWidget.target,
        latitude: editingWidget.latitude.trim(),
        longitude: editingWidget.longitude.trim(),
        cache: editingWidget.cache.trim(),
        href: editingWidget.href.trim()
      };
      if (editingWidgetIndex.value === null) {
        widgets.value.push({ id: uid(), ...values, source: {} });
      } else {
        const w = widgets.value[editingWidgetIndex.value];
        Object.assign(w, values, { source: { ...(w.source || {}) } });
        w.type = type;
      }
      showWidgetModal.value = false;
    }

    function deleteWidget(index) {
      const w = widgets.value[index];
      if (!confirm(t('widget.confirmDelete', { name: w.type }))) return;
      widgets.value.splice(index, 1);
    }

    function moveWidgetUp(index) {
      if (index === 0) return;
      const arr = widgets.value;
      const tmp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = tmp;
    }

    function moveWidgetDown(index) {
      const arr = widgets.value;
      if (index >= arr.length - 1) return;
      const tmp = arr[index];
      arr[index] = arr[index + 1];
      arr[index + 1] = tmp;
    }

    // ---- Homepage appearance ----
    // Homepage has no theme files: the palette is built into the app and what can
    // be changed lives in the settings.yaml of the config directory. The editor
    // writes the visual fields of that file and leaves the rest of it alone.
    async function loadAppearance() {
      try {
        const res = await apiFetch('/api/homepage-settings');
        const json = await res.json();
        if (json.success) {
          const values = json.data.values || {};
          for (const field of appearanceFields) {
            appearance[field] = values[field] || '';
            appearanceLoaded[field] = values[field] || '';
          }
          appearanceHash.value = json.hash || null;
          appearanceMeta.value = json.data;
          appearanceReady.value = true;
          // The stylesheet sits next to the settings, so it is read at the same time.
          loadCustomCss();
        }
      } catch (err) {
        showToast(t('toast.loadAppearanceFailed', { msg: err.message }), 'error');
      }
    }

    // True when the form holds something the file does not. Saving only happens
    // then, so an ordinary save does not rewrite the file or churn the backups.
    const appearanceDirty = computed(() =>
      appearanceFields.some((field) => (appearance[field] || '') !== (appearanceLoaded[field] || ''))
    );

    const appearancePalette = computed(() => appearanceMeta.value.palette || []);
    const knownPaletteIds = computed(() => appearancePalette.value.map((c) => c.id));
    // The appearance is read when the tab is opened, not on every page load: the
    // file is only needed when the user goes looking at it.
    function openAppearanceTab() {
      activeTab.value = 'appearance';
      if (!appearanceReady.value) loadAppearance();
    }

    // The choices of a field, with the value that is set but not in the list added
    // to it. A newer Homepage may have values this editor does not know yet; they
    // are shown instead of being dropped.
    function appearanceChoices(field) {
      const list = (appearanceMeta.value.choices && appearanceMeta.value.choices[field]) || [];
      const current = appearance[field] || '';
      return current && !list.includes(current) ? [current, ...list] : list;
    }

    // The label of a choice. The values are Homepage's own names, so they are shown
    // as they are; only the ones with a clear meaning in this language are
    // translated.
    function appearanceChoiceLabel(field, value) {
      if (!value) return t('appearance.notSet');
      if (field === 'theme') {
        return value === 'light' ? t('appearance.themeLight') : t('appearance.themeDark');
      }
      return value;
    }

    async function saveAppearance() {
      try {
        // Two files live behind this button: the settings of the dashboard and the
        // stylesheet. Each is only written when it changed.
        if (appearanceDirty.value) {
          const values = {};
          for (const field of appearanceFields) values[field] = appearance[field] || '';
          const res = await apiFetch('/api/homepage-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values, hash: appearanceHash.value })
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || t('toast.unknownError'));
          appearanceHash.value = json.hash || null;
          const saved = json.data.values || values;
          for (const field of appearanceFields) appearanceLoaded[field] = saved[field] || '';
        }
        if (customCssDirty.value) {
          const written = await saveCustomCss();
          if (!written) return false;
        }
        // The dashboard keeps its settings in the memory of its process, so the
        // preview would show the old colours without this.
        const revalidated = await revalidatePreview();
        if (!revalidated) {
          showToast(t('toast.revalidateNeeded'), 'error');
          return true;
        }
        showToast(t('toast.saved'));
        refreshPreview();
        return true;
      } catch (err) {
        showToast(t('toast.saveFailed', { msg: err.message }), 'error');
        return false;
      }
    }

    // Ask the dashboard to forget its cached settings. The request goes through
    // the editor's server, so the browser's cross-origin rules do not stop it.
    async function revalidatePreview() {
      try {
        const res = await apiFetch('/api/homepage-revalidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();
        return !!(json.success && json.data && json.data.revalidated);
      } catch (err) {
        return false;
      }
    }

    // ---- Homepage layout (settings.yaml: layout block + global switches) ----
    // The layout entries and the global switches of settings.yaml, beside the
    // visual fields the appearance tab edits. They live in the same file, so
    // the two tabs each hold a hash and only write when their own values
    // changed.
    const layoutGroups = ref([]);
    const layoutValues = reactive({});
    const layoutLoadedValues = reactive({});
    const layoutHash = ref(null);
    const layoutReady = ref(false);
    const layoutMeta = ref({ choices: {}, exists: false, path: '' });
    const showLayoutGroupModal = ref(false);
    const editingLayoutGroupIndex = ref(null);
    const editingLayoutGroup = reactive({ name: '', tab: '', style: '', columns: '', icon: '', header: '', initiallyCollapsed: '', useEqualHeights: '' });

    // The group names that exist in services.yaml / bookmarks.yaml. A layout
    // entry that does not match any of them is an orphan: upstream still
    // honours it (auto-discovered groups, tabs), so the editor shows it with a
    // marker instead of hiding it.
    const knownGroupNames = computed(() => {
      const names = new Set();
      for (const g of groups.value) names.add(g.name);
      for (const g of bookmarkGroups.value) names.add(g.name);
      return names;
    });

    const LAYOUT_GLOBAL_KEYS = [
      'title', 'description', 'language', 'target', 'startUrl', 'favicon',
      'base', 'instanceName', 'logpath',
      'fullWidth', 'maxGroupColumns', 'maxBookmarkGroupColumns',
      'disableCollapse', 'groupsInitiallyCollapsed', 'useEqualHeights',
      'bookmarksStyle', 'hideVersion', 'disableUpdateCheck', 'hideErrors',
      'disableIndexing', 'statusStyle', 'showStats'
    ];

    const layoutDirty = computed(() => {
      if (!layoutReady.value) return false;
      for (const key of LAYOUT_GLOBAL_KEYS) {
        if ((layoutValues[key] || '') !== (layoutLoadedValues[key] || '')) return true;
      }
      const norm = (g) => { const o = { ...g }; delete o.source; return o; };
      return JSON.stringify(layoutGroups.value.map(norm)) !== JSON.stringify((layoutMeta.value.groups || []).map(norm));
    });

    async function loadLayoutSettings() {
      try {
        const res = await apiFetch('/api/homepage-layout');
        const json = await res.json();
        if (json.success) {
          layoutGroups.value = json.data.groups.map((g) => ({ ...g }));
          layoutMeta.value = json.data;
          layoutMeta.value.groups = json.data.groups;
          layoutHash.value = json.hash || null;
          layoutReady.value = true;
          for (const key of LAYOUT_GLOBAL_KEYS) {
            layoutValues[key] = (json.data.values || {})[key] || '';
            layoutLoadedValues[key] = (json.data.values || {})[key] || '';
          }
        }
      } catch (err) {
        showToast(t('toast.loadAppearanceFailed', { msg: err.message }), 'error');
      }
    }

    // The layout tab is read when it is opened, not on every page load.
    function openLayoutTab() {
      activeTab.value = 'layout';
      if (!layoutReady.value) loadLayoutSettings();
    }

    function addLayoutGroup() {
      editingLayoutGroupIndex.value = null;
      Object.assign(editingLayoutGroup, { name: '', tab: '', style: '', columns: '', icon: '', header: '', initiallyCollapsed: '', useEqualHeights: '' });
      showLayoutGroupModal.value = true;
    }

    function editLayoutGroup(lg, index) {
      editingLayoutGroupIndex.value = index;
      Object.assign(editingLayoutGroup, {
        name: lg.name, tab: lg.tab || '', style: lg.style || '',
        columns: String(lg.columns || ''), icon: lg.icon || '',
        header: lg.header || '', initiallyCollapsed: lg.initiallyCollapsed || '',
        useEqualHeights: lg.useEqualHeights || ''
      });
      showLayoutGroupModal.value = true;
    }

    function saveLayoutGroup() {
      const name = editingLayoutGroup.name.trim();
      if (!name) { showToast(t('layout.groupNameRequired'), 'error'); return; }
      const entry = { name };
      // The tristate fields carry '' (not set) or the strings 'true' / 'false'.
      const tristate = ['header', 'initiallyCollapsed', 'useEqualHeights'];
      for (const field of ['tab', 'style', 'icon', 'header', 'initiallyCollapsed', 'useEqualHeights']) {
        const value = String(editingLayoutGroup[field] || '').trim();
        if (value && (tristate.includes(field) ? value === 'true' || value === 'false' : true)) entry[field] = value;
      }
      const columnsRaw = String(editingLayoutGroup.columns || '').trim();
      if (columnsRaw) {
        const columnsNum = Number(columnsRaw);
        if (Number.isInteger(columnsNum) && columnsNum >= 2 && columnsNum <= 8) entry.columns = columnsNum;
      }
      // Editing an existing group keeps its source object, so unmodelled keys
      // (nested subgroups) survive the save.
      const source = editingLayoutGroupIndex.value !== null
        ? (layoutGroups.value[editingLayoutGroupIndex.value] || {}).source
        : undefined;
      entry.source = source && typeof source === 'object' ? source : {};
      if (editingLayoutGroupIndex.value === null) {
        layoutGroups.value.push(entry);
      } else {
        layoutGroups.value[editingLayoutGroupIndex.value] = entry;
      }
      showLayoutGroupModal.value = false;
    }

    function deleteLayoutGroup(li) {
      const entry = layoutGroups.value[li];
      if (confirm(t('layout.confirmDeleteGroup', { name: entry.name }))) {
        layoutGroups.value.splice(li, 1);
      }
    }

    async function saveLayoutSettings() {
      try {
        const res = await apiFetch('/api/homepage-layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            values: Object.fromEntries(LAYOUT_GLOBAL_KEYS.map((k) => [k, layoutValues[k] || ''])),
            groups: layoutGroups.value,
            hash: layoutHash.value
          })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || t('toast.unknownError'));
        layoutHash.value = json.hash || null;
        for (const key of LAYOUT_GLOBAL_KEYS) layoutLoadedValues[key] = ((json.data && json.data.values) || {})[key] || '';
        if (json.data && Array.isArray(json.data.groups)) {
          layoutGroups.value = json.data.groups.map((g) => ({ ...g }));
          layoutMeta.value.groups = json.data.groups;
        }
        const revalidated = await revalidatePreview();
        if (!revalidated) {
          showToast(t('toast.revalidateNeeded'), 'error');
        }
        showToast(t('toast.saved'));
        refreshPreview();
      } catch (err) {
        showToast(t('toast.saveFailed', { msg: err.message }), 'error');
      }
    }

    // ---- Custom CSS ----
    async function loadCustomCss() {
      try {
        const res = await apiFetch('/api/homepage-custom-css');
        const json = await res.json();
        if (json.success) {
          const parts = json.data.parts || {};
          const font = parts.font || {};
          customCss.font = {
            cdn: font.cdn || '',
            kind: font.kind || '',
            families: Array.isArray(font.families) ? font.families : [],
            local: font.local || ''
          };
          customCss.free = parts.free || '';
          const themes = {};
          for (const [id, entry] of Object.entries(parts.themes || {})) {
            themes[id] = { css: entry.css || '', seed: entry.seed || '' };
          }
          customCss.themes = themes;
          customCss.official = json.data.official || {};
          // A copy of what was loaded, so a change can be taken back.
          customCss.loadedParts = {
            font: JSON.parse(JSON.stringify(customCss.font)),
            themes: JSON.parse(JSON.stringify(themes)),
            free: customCss.free
          };
          customCss.hash = json.hash || null;
          customCss.exists = !!json.data.exists;
          customCssReady.value = true;
        }
      } catch (err) {
        showToast(t('toast.loadCustomCssFailed', { msg: err.message }), 'error');
      }
    }

    async function saveCustomCss() {
      const res = await apiFetch('/api/homepage-custom-css', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: customCssParts.value, hash: customCss.hash })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || t('toast.unknownError'));
      customCss.hash = json.hash || null;
      customCss.exists = true;
      // What is on the disk is now what the form holds, so it is the state a
      // change can be taken back to.
      customCss.loadedParts = JSON.parse(JSON.stringify(customCssParts.value));
      return true;
    }

    // Item CRUD
    function addItem(group) {
      editingItemId.value = null;
      Object.assign(editingItem, {
        name: '', href: '', description: '', target: '', icon: '', iconType: 'mdi',
        siteMonitor: '', statusStyle: '', showStats: '',
        server: '', weight: '', namespace: '', app: '', podSelector: '',
        widgets: []
      });
      editingItem._targetGroupId = group.id;
      showItemModal.value = true;
    }

    function editItem(group, item) {
      editingItemId.value = item.id;
      Object.assign(editingItem, {
        name: item.name, href: item.href, description: item.description,
        target: item.target, icon: item.icon, iconType: item.iconType,
        siteMonitor: item.siteMonitor || '', statusStyle: item.statusStyle || '',
        showStats: item.showStats || '',
        server: item.server || '', weight: item.weight || '',
        namespace: item.namespace || '', app: item.app || '', podSelector: item.podSelector || '',
        widgets: Array.isArray(item.widgets) ? item.widgets.map((w) => ({ ...w, headers: (w.headers || []).map((h) => ({ ...h })) })) : []
      });
      editingItem._targetGroupId = group.id;
      showItemModal.value = true;
    }

    function saveItem() {
      if (!editingItem.name.trim()) { showToast(t('item.nameRequired'), 'error'); return; }
      const group = groups.value.find(g => g.id === editingItem._targetGroupId);
      if (!group) { showToast(t('item.groupNotFound'), 'error'); return; }
      if (editingItemId.value) {
        const item = group.items.find(i => i.id === editingItemId.value);
        if (item) {
          Object.assign(item, {
            name: editingItem.name.trim(), href: editingItem.href.trim(),
            description: editingItem.description.trim(), target: editingItem.target,
            icon: editingItem.icon.trim(), iconType: editingItem.iconType,
            siteMonitor: editingItem.siteMonitor.trim(),
            statusStyle: editingItem.statusStyle,
            showStats: editingItem.showStats,
            server: editingItem.server.trim(), weight: editingItem.weight.trim(),
            namespace: editingItem.namespace.trim(), app: editingItem.app.trim(),
            podSelector: editingItem.podSelector.trim(),
            widgets: editingItem.widgets.map((w) => ({ ...w, headers: (w.headers || []).map((h) => ({ ...h })) }))
          });
        }
      } else {
        group.items.push({
          id: uid(), name: editingItem.name.trim(), href: editingItem.href.trim(),
          description: editingItem.description.trim(), target: editingItem.target,
          icon: editingItem.icon.trim(), iconType: editingItem.iconType,
          siteMonitor: editingItem.siteMonitor.trim(),
          statusStyle: editingItem.statusStyle,
          showStats: editingItem.showStats,
          server: editingItem.server.trim(), weight: editingItem.weight.trim(),
          namespace: editingItem.namespace.trim(), app: editingItem.app.trim(),
          podSelector: editingItem.podSelector.trim(),
          widgets: editingItem.widgets.map((w) => ({ ...w, headers: (w.headers || []).map((h) => ({ ...h })) })),
          nested: false, source: null
        });
      }
      showItemModal.value = false;
    }

    function deleteItem(group, ii) {
      if (!confirm(t('item.confirmDelete', { name: group.items[ii].name }))) return;
      group.items.splice(ii, 1);
    }

    // Move item
    function moveItemToGroup(group, item) {
      movingItem.value = item;
      movingFromGroup.value = group;
      showMoveModal.value = true;
    }

    function confirmMove(targetGroup) {
      if (movingFromGroup.value === targetGroup) { showMoveModal.value = false; return; }
      const idx = movingFromGroup.value.items.indexOf(movingItem.value);
      if (idx > -1) movingFromGroup.value.items.splice(idx, 1);
      targetGroup.items.push(movingItem.value);
      showMoveModal.value = false;
      showToast(t('toast.moved', { name: targetGroup.name }));
    }

    // Drag & Drop
    function moveItemUp(group, item) {
      const idx = group.items.indexOf(item);
      if (idx > 0) {
        const arr = group.items;
        const tmp = arr[idx - 1];
        arr[idx - 1] = arr[idx];
        arr[idx] = tmp;
      }
    }
    function moveItemDown(group, item) {
      const idx = group.items.indexOf(item);
      if (idx >= 0 && idx < group.items.length - 1) {
        const arr = group.items;
        const tmp = arr[idx + 1];
        arr[idx + 1] = arr[idx];
        arr[idx] = tmp;
      }
    }

    let dragGhost = null;
    // A finger on the handle records its press before the drag commits: the
    // card lifts only after the finger has moved a short distance, so a tap
    // is not mistaken for a drag.
    let dragPress = null;

    // One engine for every pointer: a mouse lifts the card on the press
    // itself, a finger has to travel a bit first.
    function startCardDrag(event, group, item) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragPress = {
        group, item,
        x: event.clientX, y: event.clientY,
        card: event.currentTarget && event.currentTarget.closest
          ? event.currentTarget.closest('.item-card')
          : null,
        committed: false
      };
      document.addEventListener('pointermove', onCardDragMove);
      document.addEventListener('pointerup', endCardDrag);
      document.addEventListener('pointercancel', cancelCardDrag);
      // A mouse lifts the card on the press itself; a finger first has to
      // travel a short distance, which commits the drag in onCardDragMove.
      if (event.pointerType !== 'touch') commitCardDrag(event.clientX, event.clientY);
    }

    function commitCardDrag(x, y) {
      const press = dragPress;
      if (!press || press.committed) return;
      press.committed = true;
      dragSource = { group: press.group, item: press.item };
      draggingItem.value = press.item;
      dropIndex.value = null;
      dragOverGroup.value = press.group.id;
      if (press.card) {
        dragGhost = press.card.cloneNode(true);
        dragGhost.classList.add('drag-ghost');
        dragGhost.style.width = press.card.offsetWidth + 'px';
        dragGhost.style.pointerEvents = 'none';
        document.body.appendChild(dragGhost);
        moveGhost(x, y);
      }
    }

    function moveGhost(x, y) {
      if (!dragGhost) return;
      dragGhost.style.left = (x + 14) + 'px';
      dragGhost.style.top = (y + 14) + 'px';
    }

    function onCardDragMove(event) {
      if (!dragPress) return;
      // A committed pointer just follows. A fresh touch press commits once the
      // finger has moved far enough to be more than a tap.
      if (!dragPress.committed) {
        const dx = event.clientX - dragPress.x;
        const dy = event.clientY - dragPress.y;
        if (dx * dx + dy * dy < 25) return;
        commitCardDrag(event.clientX, event.clientY);
      }
      moveGhost(event.clientX, event.clientY);
      autoScrollDuringDrag(event);
      updateDropIndexFromPoint(event.clientX, event.clientY);
    }

    function endCardDrag(event) {
      detachDragListeners();
      if (!dragPress) return;
      if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
      }

      if (!dragSource) {
        draggingItem.value = null;
        dropIndex.value = null;
        dragOverGroup.value = null;
        dragPress = null;
        return;
      }
      const { group: srcGroup, item: srcItem } = dragSource;

      // Determine the target from the release point. Only the groups of the tab
      // that is on screen are legal drop targets, so both branches look up the
      // active group list instead of the services list.
      let targetGroup = srcGroup;
      let insertIndex = srcGroup.items.length;
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const itemEl = el && el.closest ? el.closest('.item-card') : null;
      const groupEl = el && el.closest ? el.closest('.group-card') : null;
      if (itemEl) {
        const gid = itemEl.getAttribute('data-group-id') || (itemEl.closest('.group-card') && itemEl.closest('.group-card').getAttribute('data-group-id'));
        const iid = itemEl.getAttribute('data-item-id');
        const g = activeGroups.value.find((gg) => gg.id === gid);
        if (g) {
          targetGroup = g;
          const targetItem = g.items.find((i) => i.id === iid);
          const rect = itemEl.getBoundingClientRect();
          const idx = targetItem ? g.items.indexOf(targetItem) : g.items.length;
          insertIndex = event.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
        }
      } else if (groupEl) {
        const gid = groupEl.getAttribute('data-group-id');
        const g = activeGroups.value.find((gg) => gg.id === gid);
        if (g) {
          targetGroup = g;
          insertIndex = g.items.length;
        }
      }

      const srcIdx = srcGroup.items.indexOf(srcItem);
      if (srcIdx > -1) srcGroup.items.splice(srcIdx, 1);
      if (srcGroup === targetGroup && srcIdx >= 0 && srcIdx < insertIndex) insertIndex -= 1;
      insertIndex = Math.max(0, Math.min(targetGroup.items.length, insertIndex));
      targetGroup.items.splice(insertIndex, 0, srcItem);

      dragSource = null;
      dragPress = null;
      draggingItem.value = null;
      dropIndex.value = null;
      dragOverGroup.value = null;
    }

    // The system interrupts the gesture (a notification, a second finger):
    // the card goes back where it started instead of landing wherever the
    // finger happened to be.
    function cancelCardDrag() {
      detachDragListeners();
      if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
      }
      dragSource = null;
      dragPress = null;
      draggingItem.value = null;
      dropIndex.value = null;
      dragOverGroup.value = null;
    }

    function detachDragListeners() {
      document.removeEventListener('pointermove', onCardDragMove);
      document.removeEventListener('pointerup', endCardDrag);
      document.removeEventListener('pointercancel', cancelCardDrag);
    }

    function autoScrollDuringDrag(event) {
      const container = document.querySelector('.editor-panel');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const threshold = 70;
      const step = 14;
      if (event.clientY < rect.top + threshold) {
        container.scrollTop = Math.max(0, container.scrollTop - step);
      } else if (event.clientY > rect.bottom - threshold) {
        container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + step);
      }
    }

    function updateDropIndexFromPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      const itemEl = el && el.closest ? el.closest('.item-card') : null;
      const groupEl = el && el.closest ? el.closest('.group-card') : null;
      if (itemEl) {
        const gid = itemEl.getAttribute('data-group-id') || (itemEl.closest('.group-card') && itemEl.closest('.group-card').getAttribute('data-group-id'));
        const iid = itemEl.getAttribute('data-item-id');
        const group = activeGroups.value.find((g) => g.id === gid);
        if (!group) return;
        const item = group.items.find((i) => i.id === iid);
        if (!item) return;
        const rect = itemEl.getBoundingClientRect();
        const idx = group.items.indexOf(item);
        const position = y < rect.top + rect.height / 2 ? idx : idx + 1;
        dragOverGroup.value = group.id;
        dropIndex.value = { groupId: group.id, index: position };
      } else if (groupEl) {
        const gid = groupEl.getAttribute('data-group-id');
        const group = activeGroups.value.find((g) => g.id === gid);
        if (!group) return;
        dragOverGroup.value = group.id;
        // Resolve to the nearest item boundary instead of always appending:
        // a tiny gap between two cards otherwise makes the indicator jump to
        // the end of the group.
        const cards = groupEl.querySelectorAll('.item-card');
        let index = group.items.length;
        for (let i = 0; i < cards.length; i++) {
          const rect = cards[i].getBoundingClientRect();
          if (y < rect.top + rect.height / 2) { index = i; break; }
          if (y < rect.bottom) { index = i + 1; break; }
        }
        // If the cursor is below every card, append.
        if (cards.length && y >= cards[cards.length - 1].getBoundingClientRect().bottom) {
          index = group.items.length;
        }
        dropIndex.value = { groupId: group.id, index };
      }
    }

    // Preview
    function saveLayout() {
      try {
        localStorage.setItem('hcms-layout', JSON.stringify({
          showPreview: showPreview.value,
          previewCollapsed: previewCollapsed.value,
          splitRatio: splitRatio.value
        }));
      } catch (err) {
      }
    }
    function refreshPreview() { previewKey.value++; }
    function togglePreviewCollapsed() { previewCollapsed.value = !previewCollapsed.value; saveLayout(); }

         // ---- Upgrade check ----
    const hasUpdate = ref(false);
    const upgradeLoading = ref(false);
    const upgradeOffline = ref(false);
    // docker when the answer came from the updater sidecar: the app
    // container restarts after the reply, so the reload needs to wait
    // longer than in the local, in-process case.
    const upgradeEnv = ref('local');

    async function checkForUpdates() {
      try {
        const res = await apiFetch('/api/check-upgrade');
        const json = await res.json();
        if (json.success) {
          upgradeOffline.value = !!json.data.offline;
          hasUpdate.value = !!(json.data && json.data.hasUpdate);
          upgradeEnv.value = json.data && json.data.env === 'docker' ? 'docker' : 'local';
        }
      } catch (err) {
        console.warn('[upgrade] check failed:', err.message);
      }
    }

    async function checkAndUpgrade() {
      if (!hasUpdate.value || upgradeLoading.value) return;
      upgradeLoading.value = true;
      try {
        const res = await apiFetch('/api/upgrade', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast(t('toast.upgradeSuccess'));
          hasUpdate.value = false;
          const waitMs = upgradeEnv.value === 'docker' ? 12000 : 3000;
          // Local: the new server instance backs off until the old one frees
          // the port. Docker: the sidecar restarts the app container after
          // the answer, so the reload has to outlast that.
          setTimeout(() => location.reload(), waitMs);
        } else {
          // The server already answered in the editor's language.
          showToast(json.error || t('toast.unknownError'), 'error');
        }
      } catch (err) {
        showToast(t('toast.unknownError'), 'error');
      } finally {
        upgradeLoading.value = false;
      }
    }

    // Runtime settings
    async function loadSettings() {
      try {
        const res = await apiFetch('/api/settings');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || t('toast.loadSettingsFailed', { msg: '' }));
        applySettings(json.data);
        // No settings file yet: this is a first visit, so the setup dialog opens.
        if (!json.data.initialized && !showSettings.value) {
          isFirstRun.value = true;
          showPassword.value = false;
          showSettings.value = true;
        }
      } catch (err) {
        showToast(t('toast.loadSettingsFailed', { msg: err.message }), 'error');
      }
    }

    // The form shows the values that are in effect, so a field with a value never
    // shows its placeholder. The placeholder is the fallback for a field the user
    // clears, and the hint line underneath says where the value came from.
    function applySettings(data) {
      previewUrl.value = data.previewUrl || '';
      previewUrlSource.value = data.previewUrlSource || '';

      runtimeInfo.placeholders = data.placeholders || {};
      runtimeInfo.fileValues = data.fileValues || {};
      runtimeInfo.bindAddressEffective = data.bindAddressEffective || '';
      runtimeInfo.bindAddressSource = data.bindAddressSource || '';
      runtimeInfo.restartRequired = !!data.restartRequired;
      runtimeInfo.port = data.port || '';
      runtimeInfo.portEffective = data.portEffective || '';
      runtimeInfo.portSource = data.portSource || '';
      runtimeInfo.configPath = data.configPath || '';
      runtimeInfo.configPathSource = data.configPathSource || '';
      runtimeInfo.backupPath = data.backupPath || '';
      runtimeInfo.backupPathSource = data.backupPathSource || '';
      runtimeInfo.settingsPath = data.settingsPath || '';
      runtimeInfo.settingsPathSource = data.settingsPathSource || '';
      runtimeInfo.protection = data.protection || { enabled: false, source: 'none', stored: false };
      runtimeInfo.initialized = !!data.initialized;

      settingsForm.previewUrl = data.previewUrl || '';
      settingsForm.bindAddress = data.bindAddress || '';
      settingsForm.port = data.port || '';
      settingsForm.configPath = data.configPath || '';
      settingsForm.backupPath = data.backupPath || '';
      settingsForm.settingsPath = data.settingsPath || '';
      settingsForm.protectionEnabled = !!(data.protection && data.protection.enabled);
      settingsForm.locale = data.locale || i18n.locale;
      if (data.theme) currentTheme.value = data.theme;
    }

    function openSettings() {
      // The password is never shown by default, and that is not remembered between
      // visits to the dialog.
      showPassword.value = false;
      settingsForm.password = '';
      showSettings.value = true;
    }

    async function saveSettings() {
      try {
        const res = await apiFetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            previewUrl: settingsForm.previewUrl,
            bindAddress: settingsForm.bindAddress,
            port: settingsForm.port,
            configPath: settingsForm.configPath,
            backupPath: settingsForm.backupPath,
            settingsPath: settingsForm.settingsPath,
            protection: { enabled: settingsForm.protectionEnabled, password: settingsForm.password }
          })
        });
        const json = await res.json();
        if (!json.success) {
          showToast(t('toast.settingsSaveFailed', { msg: json.error || t('toast.unknownError') }), 'error');
          return;
        }
        applySettings(json.data);
        settingsForm.password = '';
        showSettings.value = false;
        isFirstRun.value = false;
        showToast(t('toast.settingsSaved'));
        refreshPreview();
        // The config directory may have changed, so the services are read again.
        loadServices();
        loadBookmarks();
        loadWidgets();
        loadLayoutSettings();
        checkForUpdates();
      } catch (err) {
        showToast(t('toast.settingsSaveFailed', { msg: err.message }), 'error');
      }
    }

    // Resize logic
    function startResize(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();
      isResizing.value = true;
      // Dragging the divider is a request to see both panes, so restore the preview first.
      if (previewCollapsed.value) previewCollapsed.value = false;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onResize);
      document.addEventListener('mouseup', stopResize);
      document.addEventListener('mouseleave', stopResize);
      window.addEventListener('blur', stopResize);
      document.addEventListener('touchmove', onResize, { passive: false });
      document.addEventListener('touchend', stopResize);
      document.addEventListener('touchcancel', stopResize);
    }

    function onResize(e) {
      if (!isResizing.value) return;
      const mainContent = document.querySelector('.main-content');
      if (!mainContent) return;
      const rect = mainContent.getBoundingClientRect();
      let ratio;
      if (isColumn.value) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        ratio = ((clientX - rect.left) / rect.width) * 100;
      } else {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ratio = ((clientY - rect.top) / rect.height) * 100;
      }
      splitRatio.value = Math.max(20, Math.min(80, ratio));
    }

    function stopResize() {
      isResizing.value = false;
      saveLayout();
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('mouseleave', stopResize);
      window.removeEventListener('blur', stopResize);
      document.removeEventListener('touchmove', onResize);
      document.removeEventListener('touchend', stopResize);
      document.removeEventListener('touchcancel', stopResize);
    }


    // Backups
    async function loadBackups() {
      try {
        const res = await apiFetch('/api/backups');
        const json = await res.json();
        if (json.success) backups.value = json.backups;
        showBackups.value = true;
      } catch (err) {
        showToast(t('toast.loadBackupsFailed'), 'error');
      }
    }

    async function restoreBackup(filename) {
      if (!confirm(t('backups.confirmRestore', { name: filename }))) return;
      try {
        const res = await apiFetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const json = await res.json();
        if (json.success) {
          showToast(t('toast.restored'));
          loadServices();
          // Restoring a settings backup changes the preview target, so re-read it.
          loadSettings();
          showBackups.value = false;
        } else {
          showToast(t('toast.restoreFailed', { msg: json.error }), 'error');
        }
      } catch (err) {
        showToast(t('toast.restoreFailed', { msg: err.message }), 'error');
      }
    }

    onMounted(async () => {
      syncViewport();
      if (await initAuth()) {
        loadSettings();
        loadServices();
        loadBookmarks();
        loadWidgets();
        loadLayoutSettings();
        checkForUpdates();
      }
      // The colour schemes are needed for the appearance dialog and for knowing
      // which scheme is in use.
      loadThemes().then(() => {
        const theme = themes.value.find((th) => th.id === currentTheme.value);
        if (theme) applyThemeVars(themeVarsOf(theme));
      });
      window.addEventListener('resize', syncViewport);
      window.addEventListener('orientationchange', syncViewport);
      window.addEventListener('pagehide', saveLayout);
      window.addEventListener('beforeunload', saveLayout);
      document.addEventListener('mousedown', onDocumentPointerDown);
      document.addEventListener('mousedown', onOverlayMouseDown);
      document.addEventListener('mousemove', onOverlayMouseMove);
      // Mobile URL-bar show/hide does not always fire window resize, and can also arrive
      // as a visual-viewport scroll, so listen for both.
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport);
        window.visualViewport.addEventListener('scroll', syncViewport);
      }
    });

    onUnmounted(() => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      document.removeEventListener('mousedown', onDocumentPointerDown);
      document.removeEventListener('mousedown', onOverlayMouseDown);
      document.removeEventListener('mousemove', onOverlayMouseMove);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', syncViewport);
        window.visualViewport.removeEventListener('scroll', syncViewport);
      }
    });

    return {
      groups, bookmarkGroups, activeTab, showPreview, previewUrl, previewKey, saving,
      previewSrc, hasPreviewUrl, previewSourceLabel, runtimeInfo, settingsForm,
      sourceLabel, showPassword, isFirstRun,
      apiPassword, showPasswordPrompt, passwordInput,
      authState,
      showGroupModal, showItemModal, showMoveModal, showBackups, showSettings,
      editingGroupId, editingItem, editingGroup,
      showBookmarkGroupModal, showBookmarkItemModal,
      editingBookmarkGroupId, editingBookmarkItemId, editingBookmarkGroup, editingBookmarkItem,
      widgets, widgetsHash, showWidgetModal, editingWidgetIndex, editingWidget,
      loadWidgets, saveWidgets, addWidget, editWidget, saveWidget, deleteWidget,
      moveWidgetUp, moveWidgetDown, widgetIconClass, widgetCardSummary,
      appearance, appearanceMeta, appearancePalette, knownPaletteIds, appearanceDirty, appearanceReady,
      appearanceChoices, appearanceChoiceLabel, loadAppearance, saveAppearance, openAppearanceTab,
      layoutGroups, layoutValues, layoutReady, layoutDirty, layoutMeta, knownGroupNames,
      showLayoutGroupModal, editingLayoutGroup, editingLayoutGroupIndex,
      openLayoutTab, loadLayoutSettings, addLayoutGroup, editLayoutGroup, saveLayoutGroup,
      deleteLayoutGroup, saveLayoutSettings,
      customCss, customCssDirty, customCssReady, loadCustomCss, saveCustomCss, revalidatePreview,
      customCssPalette, customCssText, customCssRampRows, customCssSeed, customCssParts,
      setCustomCssSeed, restoreCustomCssTheme, resetCustomCssTheme,
      resetAllCustomCss, confirmResetAllCustomCss, probeFontUrl,
      movingItem, movingFromGroup, dragOverGroup, dropIndex, draggingItem, backups, toast,
      totalItems, activeGroups, activeTotalItems,
      widgetTypes, widgetTypeLabel, widgetValueHint, itemWidgetBadges,
      addWidgetRow, removeWidgetRow, iconPreviewUrl, isMdiIcon, mdiClassOf,
      loadServices, loadBookmarks, save, saveAll, addGroup, editGroup, saveGroup, deleteGroup, toggleGroup,
      addItem, editItem, saveItem, deleteItem,
      moveItemToGroup, confirmMove,
      startCardDrag, moveItemUp, moveItemDown,
      togglePreviewCollapsed, refreshPreview, loadBackups, restoreBackup,
      hasUpdate, upgradeLoading, upgradeOffline, checkForUpdates, checkAndUpgrade,
      upgradeEnv,
      
      loadSettings, openSettings, saveSettings, skipSetup, submitPassword,
      initAuth, dismissPasswordPrompt, closeOnOverlayClick,
      previewCollapsed, isColumn, isResizing, splitRatio, startResize, onResize, stopResize,
      editorPanelStyle, previewPanelStyle,
      addBookmarkGroup, editBookmarkGroup, deleteBookmarkGroup,
      saveBookmarkGroup,
      addBookmarkItem, editBookmarkItem, saveBookmarkItem, deleteBookmarkItem,
      // Language
      t, i18n, availableLocales, currentLocaleName, changeLanguage,
      langMenuOpen, toggleLangMenu, pickLanguage,
      meta,
      // Colour scheme
      themes, currentTheme, currentThemeName, colorTokens, optionTokens,
      showAppearance, themeEditor, swatchesOf, openAppearance, applyThemeById,
      editTheme, duplicateTheme, newThemeFromCurrent, saveTheme, removeTheme,
      exportTheme, importThemeFile, loadThemes
    };
  }
});

// One shared icon input + live preview for every group / item dialog.
cmsApp.component('icon-field', IconField);

// Vue catches render errors itself, so the global error handler never sees them and
// the page would just go blank. Registering the handler here as well turns a failed
// render into a readable message (and a reload button) instead of a white screen.
cmsApp.config.errorHandler = (err) => {
  if (window.__fatal) window.__fatal((err && err.message) || String(err));
};

cmsApp.mount('#app');
