import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const registry = 'https://registry.npmjs.org/';
const root = object(JSON.parse(await readFile('package.json', 'utf8')));
const version = string(root.version);
const dependencies = object(root.optionalDependencies);
const tag = version.includes('-') ? 'next' : 'latest';
const dryRun = process.argv.includes('--dry-run');
const token = process.env.NPM_BOOTSTRAP_TOKEN;
const directories = (await readdir('npm', { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => `npm/${entry.name}`);
assert.equal(directories.length, 6, 'Expected all six platform packages');
// Validate every package and registry response before uploading anything.
const packages = await Promise.all(
  [...directories, '.'].map(async (directory) => {
    const manifest = object(JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')));
    const name = string(manifest.name);
    assert.equal(manifest.version, version, `${name}: version mismatch`);
    if (directory !== '.') {
      assert.equal(dependencies[name], version);
      assert(string(manifest.main).endsWith('.node'), `${name}: native entry point missing`);
      assert((await stat(join(directory, string(manifest.main)))).size > 0, 'Empty native binding');
    }
    const response = await fetch(`${registry}${encodeURIComponent(name)}?audit=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(30000),
    });
    assert(response.ok || response.status === 404, `${name}: registry HTTP ${response.status}`);
    const metadata = response.ok ? object(await response.json()) : null;
    const exists = metadata !== null;
    const published = metadata !== null && Object.hasOwn(object(metadata.versions), version);
    if (!exists && !dryRun) {
      assert(
        token,
        `${name}: initial publication requires the NPM_TOKEN secret with scope publishing permission`,
      );
    }
    return { directory, name, exists, published };
  }),
);

await Promise.all(
  ['index.js', 'index.mjs', 'index.d.ts'].map(async (file) => {
    const source = await readFile(file, 'utf8');
    assert(source.length > 0, `${file}: empty entry point`);
    if (file !== 'index.d.ts') {
      const expectedVersions = [...source.matchAll(/bindingPackageVersion !== '([^']+)'/g)];
      assert(expectedVersions.length > 0, `${file}: missing generated version checks`);
      assert(
        expectedVersions.every((match) => match[1] === version),
        `${file}: stale generated loader`,
      );
    }
  }),
);

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'undms-publish-'));
try {
  const authFile = join(temporaryDirectory, 'bootstrap.npmrc');
  if (token) {
    // Keep the secret out of command arguments and the generated file.
    await writeFile(authFile, '//registry.npmjs.org/:_authToken=${NPM_BOOTSTRAP_TOKEN}\n', {
      mode: 0o600,
    });
  }
  if (!dryRun && packages.some((pkg) => !pkg.exists)) {
    const authentication = spawnSync(
      'pnpm',
      ['whoami', '--registry', registry, '--npmrc-auth-file', authFile],
      { stdio: 'inherit' },
    );
    if (authentication.error) throw authentication.error;
    assert.equal(authentication.status, 0, 'NPM_TOKEN authentication failed before publication');
  }
  if (!dryRun && packages.some((pkg) => pkg.exists && !pkg.published)) {
    assert(
      process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
      'Trusted publishing requires GitHub Actions id-token: write',
    );
  }
  for (const pkg of packages) {
    if (pkg.published) {
      console.info(`Skipping ${pkg.name}@${version}: already published`);
      continue;
    }
    console.info(
      `${pkg.name}@${version}: ${pkg.exists ? 'trusted publishing' : 'initial token publication'}`,
    );
    const args = [
      'publish',
      pkg.directory,
      '--tag',
      tag,
      '--access',
      'public',
      '--provenance',
      '--no-git-checks',
      '--registry',
      registry,
    ];
    if (dryRun) args.push('--dry-run');
    else if (!pkg.exists) args.push('--npmrc-auth-file', authFile);
    // Existing packages use OIDC, not the bootstrap token.
    const environment = { ...process.env };
    if (pkg.exists || dryRun) delete environment.NPM_BOOTSTRAP_TOKEN;
    const result = spawnSync('pnpm', args, { stdio: 'inherit', env: environment });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Publishing ${pkg.name} failed`);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function object(value: unknown): Record<string, unknown> {
  assert(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    'Expected a JSON object',
  );
  return Object.fromEntries(Object.entries(value));
}

function string(value: unknown): string {
  assert(typeof value === 'string', 'Expected a string');
  return value;
}
