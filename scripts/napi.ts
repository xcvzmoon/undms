import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './napi.config.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const cliManifestPath = require.resolve('@napi-rs/cli/package.json');
const cliManifest = object(JSON.parse(await readFile(cliManifestPath, 'utf8')));
const cli = resolve(dirname(cliManifestPath), string(object(cliManifest.bin).napi));
const [command, ...args] = process.argv.slice(2);

if (!command) throw new Error('Expected a napi command');

const configDir = await mkdtemp(resolve(tmpdir(), 'undms-napi-'));
const configPath = resolve(configDir, 'napi.config.json');

await writeFile(configPath, JSON.stringify(config));

const packageName = string(config.packageName);
const generatedPrefix = `${packageName}-`;
const scope = packageName.slice(0, packageName.indexOf('/') + 1);
const builds =
  command === 'build-all'
    ? [
        ['build', '--platform', '--release', '--js', 'index.js', ...args],
        ['build', '--platform', '--release', '--esm', '--js', 'index.mjs', ...args],
      ]
    : [[command, ...args]];

let exitCode = 0;

try {
  for (const invocation of builds) {
    const result = spawnSync(process.execPath, [cli, ...invocation, '--config-path', configPath], {
      cwd: root,
      stdio: 'inherit',
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  await rm(configDir, { recursive: true, force: true });
}

if (exitCode !== 0) process.exit(exitCode);

function option(name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

if (command === 'build' || command === 'build-all') {
  const loaders =
    command === 'build-all' ? ['index.js', 'index.mjs'] : [option('--js', 'index.js')];

  for (const name of loaders) {
    const loader = resolve(root, option('--output-dir', '.'), name);
    const source = await readFile(loader, 'utf8');
    await writeFile(loader, source.replaceAll(generatedPrefix, scope));
  }
}

if (command === 'create-npm-dirs') {
  const npmDir = resolve(root, option('--npm-dir', 'npm'));

  for (const entry of await readdir(npmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = resolve(npmDir, entry.name, 'package.json');
    const manifest = object(JSON.parse(await readFile(manifestPath, 'utf8')));

    manifest.name = string(manifest.name).replace(generatedPrefix, scope);

    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const readmePath = resolve(npmDir, entry.name, 'README.md');
    const readme = await readFile(readmePath, 'utf8');
    await writeFile(readmePath, readme.replaceAll(generatedPrefix, scope));
  }
}

if (command === 'version') {
  const manifestPath = resolve(root, 'package.json');
  const manifest = object(JSON.parse(await readFile(manifestPath, 'utf8')));
  const dependencies = object(manifest.optionalDependencies);

  for (const name of Object.keys(dependencies)) {
    if (name.startsWith(scope)) dependencies[name] = string(manifest.version);
  }

  manifest.optionalDependencies = dependencies;

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a JSON object');
  }

  return Object.fromEntries(Object.entries(value));
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string');
  return value;
}
