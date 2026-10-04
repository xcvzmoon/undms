---
name: genbumppush
description: Expert guidance for genbumppush — Conventional Commits release tooling that bumps SemVer, updates version files, writes CHANGELOG.md, commits, tags, and atomically pushes (optional GitHub/GitLab releases). Use when configuring releases (defineConfig, genbumppush.config.ts, package.json genbumppush key), running or recovering a release (dry-run, no-push, retry-github, retry-gitlab, dirty worktree, tag collision), wiring CI/CD for npm or app releases, or developing the genbumppush library itself (vp check/test, adapters, release pipeline). Triggers include "genbumppush", "release config", "bump version and push", "conventional commits release", "Tauri version bump", "fixed-version monorepo release".
---

# genbumppush

`genbumppush` is a release orchestrator: detect or force a SemVer bump from Conventional Commits (via changelogen), update configured version files, prepend a changelog section, create an annotated tag, and `git push --atomic` the branch + tag. It does **not** publish npm packages or create provider releases by itself unless you opt into GitHub/GitLab release APIs; publication stays in tag-triggered CI.

## Important

- Never put tokens in config files. Credentials come only from the process environment (or `.env` loaded from the repo cwd; real env wins).
- Prefer `--dry-run --yes` before any real release when helping a user.
- Do not force-overwrite a published tag. Fix the release commit or use the retry flags instead.
- Hooks run arbitrary shell in the repo directory — only wire trusted commands.
- Version-file and commit-preparation failures roll back files and the index. A failed tag or network push leaves the release commit local for inspection.
- **Never format the changelog.** If the project uses oxfmt, Prettier, Biome, dprint, or any other formatter, `CHANGELOG.md` (and any custom `changelog` path) must always be excluded. Do not run formatters on it, do not include it in format-on-save, and do not "fix" its whitespace. Changelog content is machine-written (changelogen) and version-section extraction depends on its structure; formatting rewrites create noisy release diffs and can break GitLab release notes parsing.

## Instructions

### Step 1: Classify the request

| User intent                     | Path                                         |
| ------------------------------- | -------------------------------------------- |
| Set up or change release config | Step 2 + `references/config-recipes.md`      |
| Cut a release now               | Step 3                                       |
| Fix a failed / partial release  | Step 4 + `references/cli-and-errors.md`      |
| Wire GitHub Actions / GitLab CI | Step 5 + `references/ci-integration.md`      |
| Change genbumppush source       | Step 6 + `references/library-development.md` |

### Step 2: Configure a consumer project

1. Install as a dev dependency and add a script:

```bash
npm install --save-dev genbumppush
# package.json
# { "scripts": { "release": "genbumppush" } }
```

2. Create `genbumppush.config.ts` (or put the same object under `"genbumppush"` in `package.json`):

```ts
import { defineConfig } from 'genbumppush';

export default defineConfig({
  // release: 'patch',          // omit for Conventional Commits detection
  // preid: 'beta',
  // changelog: 'CHANGELOG.md', // false to disable
  // excludeDependencyCommits: true,
  // recursive: false,
  // files: ['package.json'],
  git: {
    remote: 'origin',
    push: true,
    // sign: false,
    // requireClean: true,
    // requireUpstream: true,
    // commitMessage: 'chore(release): v{{version}}',
    // tagName: 'v{{version}}',
    // tagMessage: 'v{{version}}',
  },
  // hooks: { before: ['npm run check'], after: 'echo done' },
  // github: { enabled: true },
  // gitlab: { enabled: true, project: 'group/name' },
  // docker: {
  //   enabled: true,
  //   // single: source: 'acme/app:build', image: 'acme/app'
  //   // multi (api + web):
  //   // tags: ['{{version}}', '{{tag}}'],
  //   // images: [
  //   //   { source: 'acme/api-build:{{version}}', image: 'ghcr.io/acme/api' },
  //   //   { source: 'acme/web-build:{{version}}', image: 'ghcr.io/acme/web' },
  //   // ],
  // },
});
```

3. Resolution order: CLI flags → C12 config file → `package.json` `"genbumppush"` → defaults. A flag such as `--no-push` always wins.
4. Node engine: `>=20.19.0`.
5. **Exclude the changelog from formatters.** If the project runs oxfmt (`vp fmt` / `vp check`), Prettier, Biome, dprint, or format-on-save, add the configured changelog path to that tool's ignore list before any release run. Examples:

   - Vite+ / oxfmt: `fmt.ignorePatterns: ['CHANGELOG.md']` in `vite.config.ts`
   - Prettier: `CHANGELOG.md` in `.prettierignore`
   - Biome: include the path under `files.ignore` / `formatter.ignore` in `biome.json`
   - Editor: disable format-on-save for that file if the formatter cannot ignore it

   Apply the same ignore to a custom `changelog` path (not only the default `CHANGELOG.md`). Never hand-format or auto-format the generated file after a release.

6. For monorepo, Tauri, Cargo, or custom version files, read `references/config-recipes.md` before guessing adapters.

### Step 3: Run a release

Default detection (from `1.2.3`):

| Commits since last tag               | Result              |
| ------------------------------------ | ------------------- |
| `feat` / non-breaking                | minor               |
| `fix` / patch-level                  | patch               |
| `feat!` / `BREAKING CHANGE:`         | major               |
| only `chore(deps)` (default exclude) | no release (exit 0) |

Safe sequence when assisting a human:

```bash
# 1. Preview
npx genbumppush --dry-run --yes

# 2. Local rehearsal (commit + tag, no remote mutation)
npx genbumppush patch --no-push --yes

# 3. Real release
npx genbumppush --yes
# or force type / prerelease channel
npx genbumppush preminor --preid beta --yes
npx genbumppush prerelease --preid beta --yes
```

Other useful flags: `--cwd <path>`, `--config <path>`, `--retry-github <tag>`, `--retry-gitlab <tag>`, `--retry-docker <tag>`, `--no-docker`, `-y`. Retry flags cannot combine with a release type or each other.

Programmatic API (same package):

```ts
import { runRelease, loadReleaseConfig, defineConfig } from 'genbumppush';

const result = await runRelease({
  cwd: process.cwd(),
  dryRun: true,
  yes: true,
});
// result: { currentVersion, newVersion?, releaseType?, tag?, pushed, dryRun, commitCount, ... }
```

### Step 4: Recover from failures

Map `ReleaseError.code` printed as `[CODE] message`:

| Code                                              | Meaning                                    | Action                                                                                           |
| ------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `DIRTY_WORKTREE`                                  | Uncommitted changes                        | `git status`; commit or stash                                                                    |
| `TAG_EXISTS`                                      | Local or remote tag already exists         | Do not force-delete published tags; fix version or choose next bump                              |
| `VERSION_MISMATCH`                                | A version file disagrees with root version | Align every configured file with root `package.json` version                                     |
| `DETACHED_HEAD`                                   | No branch checked out                      | `git checkout <branch>`                                                                          |
| `NOT_A_REPOSITORY`                                | cwd is not a Git repo                      | Point `--cwd` at the repo                                                                        |
| `HOOK_FAILED`                                     | before/after hook non-zero                 | Fix the failing command                                                                          |
| `RELEASE_PUBLISHED_GITHUB_FAILED`                 | Git push OK, GitHub release failed         | Fix token/repo, then `genbumppush --retry-github <tag>`                                          |
| `RELEASE_PUBLISHED_GITLAB_FAILED`                 | Git push OK, GitLab release failed         | Fix token/project, then `genbumppush --retry-gitlab <tag>`                                       |
| `RELEASE_PUBLISHED_DOCKER_FAILED`                 | Git push OK, Docker publication failed     | Error names the image; fix Docker/registry, then `genbumppush --retry-docker <tag>` (all images) |
| `GITHUB_RELEASE_FAILED` / `GITLAB_RELEASE_FAILED` | Provider not ready                         | Enable provider, set token/project, or disable and use tag-only flow                             |
| `GIT_COMMAND_FAILED`                              | Underlying git failed                      | Inspect `git status`, `git log`, `git show`                                                      |
| `CANCELLED`                                       | User declined confirm                      | Rerun when ready                                                                                 |
| `INVALID_PREID` / `INVALID_VERSION`               | Bad SemVer / preid                         | Fix package version or `--preid` (letters, numbers, hyphens only)                                |

If push fails after commit+tag: leave the commit, inspect, then either `git push --atomic <remote> HEAD:<branch> refs/tags/<tag>` or deliberately remove the local tag and retry.

Full recovery notes: `references/cli-and-errors.md`.

### Step 5: CI / CD integration

Principles:

- genbumppush (or a human) pushes a `v*` tag; separate workflows react to the tag for release notes / npm publish / app deploy.
- A release **commit message alone does not trigger** tag workflows — the tag must be pushed (`git push origin main v1.2.3`).
- CI releases: `genbumppush --yes` with protected credentials and a clean checkout.
- Preview-only in CI: `npx genbumppush --dry-run --yes`.
- GitLab/GitHub provider release creation requires `git.push: true`.
- npm trusted publishing: `id-token: write`, trusted publisher matched to repo/workflow; private source repos need `NPM_CONFIG_PROVENANCE=false`.

Templates and job graphs: `references/ci-integration.md`.

### Step 6: Develop genbumppush itself

Only when the user is working **inside this library** (or a fork):

1. Toolchain is Vite+ (`vp`). After pulling: `vp install`.
2. Validate: `vp check` then `vp test` (never assume npm alone; honor `devEngines`).
3. Source map: `src/release.ts` orchestrates the pipeline; adapters in `src/version-files.ts`; SemVer in `src/version.ts`; providers in `src/github.ts` / `src/gitlab.ts`; CLI parse in `src/cli.ts`.
4. Public exports (`src/index.ts`): `defineConfig`, `loadReleaseConfig`, `runRelease`, `ReleaseError`, and types.
5. Tests live under `tests/` and cover CLI, config, adapters, rollback, hooks, tag collisions, atomic push.

Architecture detail: `references/library-development.md`.

## Examples

**User: "Set up genbumppush for our npm package"**  
→ Install devDependency, add `release` script, write minimal `genbumppush.config.ts` (default `files: ['package.json']`), suggest `--dry-run --yes`, then real `--yes`.

**User: "Also bump tauri.conf.json and Cargo.lock"**  
→ Add those paths to `files` per Tauri recipe in `references/config-recipes.md`. Do not invent a pnpm-lock adapter.

**User: "Release failed after push — GitLab release missing"**  
→ Confirm `[RELEASE_PUBLISHED_GITLAB_FAILED]`, fix `GENBUMPPUSH_GITLAB_TOKEN` / project, run `genbumppush --retry-gitlab v1.2.4`.

**User: "Only chore(deps) commits since last tag"**  
→ Expected: "No releasable commits found." Exit 0, no mutation. Set `excludeDependencyCommits: false` if they should count.

## Troubleshooting

- **Skill should not fire for unrelated release tools** (semantic-release, release-it, standard-version) unless the user also mentions genbumppush.
- **CHANGELOG.md keeps getting reformatted**: a formatter is still touching it. Add `CHANGELOG.md` (or the custom changelog path) to the project's formatter ignore (`fmt.ignorePatterns` for oxfmt/Vite+, `.prettierignore` for Prettier, Biome/dprint ignore, editor exclude). Do not revert formatting by hand — fix the ignore so `vp check` / format-on-save leave the file alone.
- **Config not picked up**: C12 name is `genbumppush` — file must be `genbumppush.config.{ts,js,mjs,...}` or package.json key `"genbumppush"`. Use `--config` for a custom path.
- **`chore(deps)` ignored**: default `excludeDependencyCommits: true`.
- **Independent-version packages in a monorepo**: genbumppush assumes one shared version when `recursive: true`. Point the user at a multi-package strategy (per-package release scripts) instead of forcing `recursive`.
- **Tag/version mismatch on publish**: publisher expects `v${package.json.version}`. Compare with `node -p "require('./package.json').version"` and `git describe --tags --exact-match HEAD`.
- **Need the full config table or recipes**: read `references/config-recipes.md`.
- **Need every CLI flag and error code**: read `references/cli-and-errors.md`.
- **Need workflow YAML**: read `references/ci-integration.md`.
- **Working on the library codebase**: read `references/library-development.md`.
