import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, copyFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// No registry requests or real publication: intercept fetch and replace pnpm.
await test('explicit token recovery publishes existing packages and skips published versions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'undms-publish-test-'));
  try {
    await copyFile(new URL('./publish.ts', import.meta.url), join(directory, 'publish.ts'));
    const dependencies: Record<string, string> = {};
    for (let index = 0; index < 6; index++) {
      const name = `@undms/platform-${index}`;
      dependencies[name] = '2.0.0';
      const platform = join(directory, 'npm', `platform-${index}`);
      await mkdir(platform, { recursive: true });
      await writeFile(
        join(platform, 'package.json'),
        JSON.stringify({ name, version: '2.0.0', main: 'binding.node' }),
      );
      await writeFile(join(platform, 'binding.node'), 'fixture');
    }
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ name: 'undms', version: '2.0.0', optionalDependencies: dependencies }),
    );
    for (const file of ['index.js', 'index.mjs', 'index.d.ts']) {
      await writeFile(join(directory, file), "bindingPackageVersion !== '2.0.0'");
    }
    await writeFile(
      join(directory, 'fetch.mjs'),
      `globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => ({ versions: url.includes('platform-0') ? { '2.0.0': {} } : {} }) });`,
    );
    await writeFile(
      join(directory, 'pnpm'),
      `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (!args.includes('--npmrc-auth-file')) process.exit(1);
if (process.env.NPM_BOOTSTRAP_TOKEN !== 'test-token') process.exit(2);
const auth = fs.readFileSync(args[args.indexOf('--npmrc-auth-file') + 1], 'utf8');
if (!auth.includes('$' + '{NPM_BOOTSTRAP_TOKEN}')) process.exit(3);
fs.appendFileSync(process.env.TEST_LOG, JSON.stringify(args) + '\\n');
`,
      { mode: 0o700 },
    );
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      NPM_BOOTSTRAP_TOKEN: 'test-token',
      TEST_LOG: join(directory, 'commands.jsonl'),
    };
    delete environment.ACTIONS_ID_TOKEN_REQUEST_URL;
    delete environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    const result = spawnSync(
      process.execPath,
      ['--import', './fetch.mjs', 'publish.ts', '--token-auth'],
      { cwd: directory, env: environment, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const commands = (await readFile(join(directory, 'commands.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => {
        const value: unknown = JSON.parse(line);
        assert(Array.isArray(value));
        return value.map((argument: unknown) => {
          assert(typeof argument === 'string');
          return argument;
        });
      });
    assert.equal(commands[0][0], 'whoami');
    assert.equal(commands.filter((args) => args[0] === 'publish').length, 6);
    assert.match(result.stdout, /Skipping @undms\/platform-0@2.0.0/);
    const tokenInTrustedMode = spawnSync(
      process.execPath,
      ['--import', './fetch.mjs', 'publish.ts', '--trusted-only'],
      { cwd: directory, env: environment, encoding: 'utf8' },
    );
    assert.notEqual(tokenInTrustedMode.status, 0);
    assert.match(tokenInTrustedMode.stderr, /--trusted-only must not receive NPM_BOOTSTRAP_TOKEN/);
    delete environment.NPM_BOOTSTRAP_TOKEN;
    delete environment.NPM_TOKEN;
    delete environment.NODE_AUTH_TOKEN;
    const missingOidc = spawnSync(
      process.execPath,
      ['--import', './fetch.mjs', 'publish.ts', '--trusted-only'],
      { cwd: directory, env: environment, encoding: 'utf8' },
    );
    assert.notEqual(missingOidc.status, 0);
    assert.match(missingOidc.stderr, /Trusted publishing requires GitHub Actions id-token: write/);
    const missingToken = spawnSync(
      process.execPath,
      ['--import', './fetch.mjs', 'publish.ts', '--token-auth'],
      { cwd: directory, env: environment, encoding: 'utf8' },
    );
    assert.notEqual(missingToken.status, 0);
    assert.match(missingToken.stderr, /--token-auth requires the NPM_TOKEN secret/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
