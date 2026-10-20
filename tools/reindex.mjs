// Rebuilds the GitNexus index with semantic search enabled, using a local
// OpenAI-compatible embedding endpoint (Ollama by default).
//
// The model is a parameter, not a decision baked into the repository: different
// machines have different models installed, and the right one depends on the
// language of the code being indexed.
//
//   node tools/reindex.mjs                                  # defaults
//   node tools/reindex.mjs --model qwen3-embedding:0.6b
//   node tools/reindex.mjs --url http://192.168.1.10:11434/v1
//
// The endpoint's dimension count is probed from the API, so GITNEXUS_EMBEDDING_DIMS
// always matches what the model actually returns.
//
// The index records the vector width but not which model produced the vectors, so
// this tool keeps its own record of the model in use. Running with a different model
// wipes the old vectors (they would be in a different vector space); running with the
// same model keeps them, and only changed files are re-embedded.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const URL = arg('url', process.env.GITNEXUS_EMBEDDING_URL || 'http://localhost:11434/v1');
const MODEL = arg('model', process.env.GITNEXUS_EMBEDDING_MODEL || 'qwen3-embedding:0.6b');
const PROBE = arg('probe', '折疊預覽面板');
const FORCE = args.includes('--force');
const ALWAYS_DROP = args.includes('--drop-embeddings');

// Ask the endpoint how wide its vectors are, so the index schema is created at the
// right width. A mismatch forces a full rebuild on every later run.
const res = await fetch(URL.replace(/\/$/, '') + '/embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: MODEL, input: PROBE })
});
if (!res.ok) {
  console.error(`Embedding endpoint ${URL} returned ${res.status} for model ${MODEL}`);
  console.error('Is the server running, and is the model pulled?');
  process.exit(1);
}
const json = await res.json();
const dims = json.data?.[0]?.embedding?.length;
if (!dims) {
  console.error('Endpoint did not return an embedding vector.');
  process.exit(1);
}

console.log(`Embedding model: ${MODEL} (${dims} dims) via ${URL}`);

// Track which model produced the vectors currently in the index. Without this, a
// same-width model swap would silently mix two vector spaces.
const STATE_DIR = '.gitnexus';
const STATE_FILE = join(STATE_DIR, 'embedding-source.json');
let previous = null;
try {
  previous = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
} catch { /* no record yet */ }

const modelChanged = previous && (previous.model !== MODEL || previous.url !== URL);
const drop = ALWAYS_DROP || modelChanged;

if (modelChanged) {
  console.log(`Model changed (${previous.model} -> ${MODEL}); the old vectors are in a different`);
  console.log('vector space and will be discarded.');
} else if (previous) {
  console.log(`Same model as the last run (${MODEL}); existing vectors are kept and only`);
  console.log('changed files are re-embedded.');
}

const gitnexusArgs = [
  'analyze', '--embeddings', '--index-only',
  ...(drop ? ['--drop-embeddings'] : []),
  ...(FORCE ? ['--force'] : [])
];

// Record the model for the next run, but only after the run succeeds.
const writeState = () => {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify({ model: MODEL, url: URL, dims }, null, 2));
  } catch (err) {
    console.error('Could not record the embedding source:', err.message);
  }
};

// On Windows the npm shim is a .cmd file, which needs a shell to run. The arguments
// are validated and then passed plainly: cmd.exe's quoting rules for /s /c are
// easy to get wrong, so the safer route is to reject anything cmd would interpret
// rather than trying to escape it.
const isWindows = process.platform === 'win32';
const UNSAFE = /[\s&|<>^%"]/;
for (const [flag, value] of [['--url', URL], ['--model', MODEL]]) {
  if (UNSAFE.test(value)) {
    console.error(`${flag} must not contain spaces or shell metacharacters: ${value}`);
    process.exit(1);
  }
}
const env = {
  ...process.env,
  GITNEXUS_EMBEDDING_URL: URL,
  GITNEXUS_EMBEDDING_MODEL: MODEL,
  GITNEXUS_EMBEDDING_DIMS: String(dims)
};
const child = isWindows
  ? spawn(process.env.ComSpec || 'cmd.exe',
      ['/d', '/c', 'gitnexus ' + gitnexusArgs.join(' ')],
      { stdio: 'inherit', env })
  : spawn('gitnexus', gitnexusArgs, { stdio: 'inherit', env });
child.on('error', (err) => {
  console.error('Failed to run gitnexus:', err.message);
  process.exit(1);
});
child.on('exit', (code) => {
  if (code === 0) writeState();
  process.exit(code ?? 1);
});
