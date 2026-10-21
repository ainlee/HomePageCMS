// Checks the INI reader/writer that the language packs and colour schemes are built
// on. These are plain Node checks: no browser, no server.
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseIni, flatten, stringifyIni } = require('../lib/ini.js');

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS  ' + name);
  } catch (err) {
    failures.push(name + ': ' + err.message);
    console.log('FAIL  ' + name + '\n      ' + err.message);
  }
}

check('sections and keys are read', () => {
  const parsed = parseIni('[meta]\ncode = ja\nname = 日本語\n\n[ui]\ntopbar.save = 保存\n');
  assert.equal(parsed.sections.meta.code, 'ja');
  assert.equal(parsed.sections.meta.name, '日本語');
  assert.equal(parsed.sections.ui['topbar.save'], '保存');
});

check('keys before the first section land in root', () => {
  const parsed = parseIni('loose = 1\n[a]\nb = 2\n');
  assert.equal(parsed.root.loose, '1');
  assert.equal(parsed.sections.a.b, '2');
});

check('comments and blank lines are ignored', () => {
  const parsed = parseIni('# a comment\n; another\n\n[a]\nkey = value\n');
  assert.deepEqual(Object.keys(parsed.sections.a), ['key']);
});

check('a colour value keeps its hash sign', () => {
  const parsed = parseIni('[colors]\nbg = #0f1117\n');
  assert.equal(parsed.sections.colors.bg, '#0f1117');
});

check('quoted values keep spaces and colons', () => {
  const parsed = parseIni('[a]\ntext = "  hello: world  "\npath = \'C:\\Program Files\'\n');
  assert.equal(parsed.sections.a.text, '  hello: world  ');
  assert.equal(parsed.sections.a.path, 'C:\\Program Files');
});

check('a UTF-8 BOM is ignored', () => {
  const parsed = parseIni('\ufeff[meta]\ncode = zh-TW\n');
  assert.equal(parsed.sections.meta.code, 'zh-TW');
});

check('an empty value is allowed', () => {
  const parsed = parseIni('[a]\nkey =\n');
  assert.equal(parsed.sections.a.key, '');
});

check('a duplicate key warns and keeps the later value', () => {
  const parsed = parseIni('[a]\nkey = one\nkey = two\n');
  assert.equal(parsed.sections.a.key, 'two');
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /duplicate key "key"/);
});

check('a malformed line reports the file and line number', () => {
  assert.throws(
    () => parseIni('[meta]\ncode = ja\nbroken line\n', 'ja.ini'),
    /ja\.ini:3 expected "key = value"/
  );
});

check('an unclosed section header is rejected', () => {
  assert.throws(() => parseIni('[meta\ncode = ja\n', 'ja.ini'), /ja\.ini:1 section header is not closed/);
});

check('flatten produces section.key pairs', () => {
  const flat = flatten(parseIni('top = 1\n[ui]\ntopbar.save = 儲存\n'));
  assert.equal(flat.top, '1');
  assert.equal(flat['ui.topbar.save'], '儲存');
});

check('written INI reads back the same', () => {
  const sections = { meta: { id: 'midnight', name: '深空' }, colors: { bg: '#0f1117' } };
  const parsed = parseIni(stringifyIni(sections));
  assert.deepEqual(parsed.sections.meta, sections.meta);
  assert.deepEqual(parsed.sections.colors, sections.colors);
});

check('written INI quotes values that need it', () => {
  const text = stringifyIni({ a: { text: ' padded ', hash: '#fff' } });
  assert.match(text, /text = " padded "/);
  assert.match(text, /hash = #fff/);
});

console.log('');
if (failures.length) {
  console.log(failures.length + ' of ' + (passed + failures.length) + ' checks failed');
  process.exit(1);
}
console.log(passed + '/' + passed + ' checks passed');

