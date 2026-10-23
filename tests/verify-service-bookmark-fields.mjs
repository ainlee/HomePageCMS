// Round-trip check for complete-service-bookmark-fields: new service/bookmark fields
// survive YAML dump/load, weight stays numeric, widgets array is preserved.
import yaml from '../node_modules/js-yaml/dist/js-yaml.mjs';

let passed = 0; const failures = [];
function check(name, cond, detail) { if (cond) { passed++; console.log('PASS  ' + name); } else { failures.push(name); console.log('FAIL  ' + name + '  ' + (detail || '')); } }

function setOrDelete(obj, key, value) { if (value) obj[key] = value; else delete obj[key]; }

// service with all new fields
const svc = { href: 'https://x/', description: 'd', server: 'srv1', namespace: 'ns1', app: 'myapp', podSelector: 'app=myapp', icon: 'mdi-test' };
const weightRaw = '100'; const weightNum = Number(weightRaw);
svc.weight = Number.isFinite(weightNum) ? weightNum : weightRaw;
svc.widget = { type: 'docker', server: 'srv1', container: 'c1' };
svc.widgets = [{ type: 'customapi', url: 'https://x/api', mappings: [{ field: 'a' }] }];
const doc = [{ G: [{ S: svc }] }];
const dumped = yaml.dump(doc);
const back = yaml.load(dumped);
const b = back[0].G[0].S;
check('server round-trips', b.server === 'srv1', dumped);
check('weight stays numeric', b.weight === 100, JSON.stringify(b.weight));
check('namespace/app/podSelector round-trip', b.namespace === 'ns1' && b.app === 'myapp' && b.podSelector === 'app=myapp');
check('widgets array preserved', Array.isArray(b.widgets) && b.widgets.length === 1 && b.widgets[0].type === 'customapi', JSON.stringify(b.widgets));

// bookmark with description + icon
const bm = {}; setOrDelete(bm, 'abbr', 'GH'); setOrDelete(bm, 'href', 'https://github.com/');
setOrDelete(bm, 'description', 'code'); setOrDelete(bm, 'icon', 'mdi-github');
const bmDoc = [{ Dev: [{ Github: [bm] }] }];
const bmBack = yaml.load(yaml.dump(bmDoc));
const bb = bmBack[0].Dev[0].Github[0];
check('bookmark description round-trips', bb.description === 'code');
check('bookmark icon round-trips', bb.icon === 'mdi-github');
check('empty bookmark description is dropped', (() => { const o = {}; setOrDelete(o, 'description', ''); return !('description' in o); })());

console.log('');
if (failures.length) { console.log(failures.length + ' checks failed'); process.exit(1); }
console.log(passed + '/' + passed + ' checks passed');
