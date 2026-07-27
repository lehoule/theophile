import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MANIFEST = 'src/data/media-manifest.json';
const DEFAULT_BUCKET = 'theophile-media';
const DEFAULT_STATE = '.media-upload-state.json';
const UPLOAD_STATE_VERSION = 1;

export function resolveSourcePath(root, key) {
  if (
    typeof key !== 'string' ||
    !key ||
    key.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(key)
  )
    throw new Error(`Invalid media key: ${key}`);

  const absoluteRoot = path.resolve(root);
  const sourcePath = path.resolve(absoluteRoot, ...key.split(/[\\/]/));
  const relativePath = path.relative(absoluteRoot, sourcePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath))
    throw new Error(`Media key escapes the source directory: ${key}`);
  return sourcePath;
}

export function buildWranglerArgs(bucket, entry, sourcePath) {
  return [
    'r2',
    'object',
    'put',
    `${bucket}/${entry.key}`,
    '--file',
    sourcePath,
    '--content-type',
    entry.mime,
    '--remote',
    '--force',
  ];
}

export function loadManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest))
    throw new Error(`Media manifest must be an array: ${manifestPath}`);
  return manifest;
}

function checksumFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function runWrangler(args) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['--no-install', 'wrangler', ...args], {
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(
        new Error(
          `Wrangler upload failed${signal ? ` (${signal})` : ` with exit code ${code}`}`,
        ),
      );
    });
  });
}

export function createUploadState(bucket) {
  return {
    version: UPLOAD_STATE_VERSION,
    bucket,
    entries: {},
  };
}

export function isEntryUploaded(state, entry) {
  return state.entries?.[entry.key]?.checksum === entry.checksum;
}

export function markEntryUploaded(state, entry) {
  return {
    ...state,
    entries: {
      ...state.entries,
      [entry.key]: { checksum: entry.checksum },
    },
  };
}

export async function loadUploadState(statePath, bucket) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.promises.readFile(statePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return createUploadState(bucket);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read upload state ${statePath}: ${message}`, {
      cause: error,
    });
  }

  if (
    parsed?.version !== UPLOAD_STATE_VERSION ||
    typeof parsed.entries !== 'object' ||
    parsed.entries === null ||
    Array.isArray(parsed.entries)
  )
    throw new Error(`Invalid upload state file: ${statePath}`);

  return parsed.bucket === bucket ? parsed : createUploadState(bucket);
}

export async function saveUploadState(statePath, state) {
  await fs.promises.mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(
      temporaryPath,
      `${JSON.stringify(state, null, 2)}\n`,
      { flag: 'wx' },
    );
    await fs.promises.rename(temporaryPath, statePath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function verifySourceEntry(entry, root) {
  if (
    typeof entry?.key !== 'string' ||
    typeof entry.mime !== 'string' ||
    typeof entry.checksum !== 'string'
  )
    throw new Error('Manifest entry is missing key, MIME type, or checksum');

  const sourcePath = resolveSourcePath(root, entry.key);
  const stat = await fs.promises.stat(sourcePath);
  if (!stat.isFile())
    throw new Error(`Media source is not a file: ${sourcePath}`);

  const checksum = await checksumFile(sourcePath);
  if (checksum !== entry.checksum)
    throw new Error(
      `Checksum mismatch for ${entry.key}: expected ${entry.checksum}, got ${checksum}`,
    );
  return sourcePath;
}

export function parseOptions(argv) {
  const [sourceRoot, ...flags] = argv;
  const options = {
    sourceRoot,
    manifestPath: DEFAULT_MANIFEST,
    bucket: DEFAULT_BUCKET,
    statePath: DEFAULT_STATE,
    dryRun: false,
  };
  for (const flag of flags) {
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag.startsWith('--manifest='))
      options.manifestPath = flag.slice('--manifest='.length);
    else if (flag.startsWith('--bucket=')) options.bucket = flag.slice(9);
    else if (flag.startsWith('--state='))
      options.statePath = flag.slice('--state='.length);
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!options.sourceRoot)
    throw new Error(
      'Usage: npm run media:upload -- path/to/wp-content/uploads [--dry-run] [--manifest=path] [--bucket=name] [--state=path]',
    );
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const root = path.resolve(options.sourceRoot);
  const manifestPath = path.resolve(options.manifestPath);
  const statePath = path.resolve(options.statePath);
  const rootStat = await fs.promises.stat(root);
  if (!rootStat.isDirectory())
    throw new Error(`Media source is not a directory: ${root}`);

  const manifest = loadManifest(manifestPath);
  let state = options.dryRun
    ? createUploadState(options.bucket)
    : await loadUploadState(statePath, options.bucket);
  let uploaded = 0;
  let skipped = 0;
  console.log(
    `${options.dryRun ? 'Checking' : 'Uploading'} ${manifest.length} media files to ${options.bucket}...`,
  );
  for (const [index, entry] of manifest.entries()) {
    console.log(`[${index + 1}/${manifest.length}] ${entry.key}`);
    const sourcePath = await verifySourceEntry(entry, root);
    if (!options.dryRun && isEntryUploaded(state, entry)) {
      console.log('  already uploaded with the same checksum; skipping');
      skipped += 1;
      continue;
    }
    if (!options.dryRun) {
      await runWrangler(buildWranglerArgs(options.bucket, entry, sourcePath));
      state = markEntryUploaded(state, entry);
      await saveUploadState(statePath, state);
      uploaded += 1;
    }
  }
  console.log(
    options.dryRun
      ? 'Dry run complete. No files were uploaded.'
      : `Upload complete: ${uploaded} uploaded, ${skipped} skipped. State saved to ${statePath}.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
