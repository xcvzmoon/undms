# Library development

Use this section only when changing genbumppush itself (this repo or a fork). Consumer-project setup belongs in the main SKILL.md and `config-recipes.md`.

## Toolchain

Vite+ unified toolchain (`vp`). Node/pnpm versions come from `devEngines` in `package.json` (downloaded on demand when available).

```bash
vp install    # after pulling remote changes
vp check      # format, lint, typecheck
vp test       # vitest suite
vp pack       # build dist/
vp toolchain  # show tool versions
vp env doctor # if setup looks wrong
```

Scripts in package.json map `build`/`dev`/`test`/`check` onto `vp`. Prefer `vp` over assuming global `npm test` alone; honor `devEngines.packageManager`.

**CHANGELOG.md must stay out of formatters.** `vp check` runs oxfmt; if a root `CHANGELOG.md` (or custom changelog path) exists, add it to `fmt.ignorePatterns` in `vite.config.ts` (e.g. `ignorePatterns: ['CHANGELOG.md']`) and never format that file by hand or via editor format-on-save. Release notes are generated; reformatting only creates noisy diffs and can break section extraction.

## Module map

| File                   | Role                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `src/bin.ts`           | CLI entry: parse → `runRelease` → human-readable result      |
| `src/cli.ts`           | Arg parsing, help text, conflict validation                  |
| `src/config.ts`        | `defineConfig`, defaults, `loadReleaseConfig` (c12 + dotenv) |
| `src/release.ts`       | Full pipeline orchestration                                  |
| `src/version.ts`       | SemVer parse/bump (`bumpVersion`)                            |
| `src/version-files.ts` | Adapters, recursive discovery, plan/apply/restore            |
| `src/git.ts`           | git subprocess, tag existence, hooks                         |
| `src/docker.ts`        | Docker image validation, tagging, and publication            |
| `src/github.ts`        | GitHub release API (github.com + GHES)                       |
| `src/gitlab.ts`        | GitLab release API + changelog section extract               |
| `src/env.ts`           | `GENBUMPPUSH_*` names + env readers                          |
| `src/error.ts`         | `ReleaseError` with `code`                                   |
| `src/types.ts`         | Public config/CLI/result types; `RELEASE_TYPES`              |
| `src/index.ts`         | Public exports                                               |

Dependencies of note: `c12` (config), `changelogen` (commit parse, semver detect, markdown). No heavy framework.

## Public API contract

Exported from package root (`dist/index.mjs`):

- `defineConfig`, `loadReleaseConfig`, `runRelease`, `ReleaseError`
- Types: `GenBumpPushConfig`, `CliOptions`, `ReleaseResult`, `ReleaseType`, `GitOptions`, `GitHubOptions`, `GitLabOptions`, `DockerOptions`, `DockerImageOptions`, `HookOptions`

`bin.genbumppush` → `dist/bin.mjs`. Keep `RELEASE_TYPES` aligned with changelogen `SemverBumpType`.

## Adding or changing behavior

1. Prefer extending `GenBumpPushConfig` + defaults in `config.ts` + docs table in README.
2. Version-file adapters live in `version-files.ts` — validation must stay fail-closed (no partial writes).
3. New `ReleaseError` codes must surface in `bin.ts` printing and be documented for operators.
4. Provider changes need retry-path compatibility: push success + API failure → `RELEASE_PUBLISHED_*_FAILED` with a `--retry-*` hint.
5. CLI flags that override config must flow through `runRelease` `overrides` (see how `push` becomes `overrides.git.push`).

## Test suite expectations

Tests under `tests/`:

- `cli.test.ts` — parsing, conflicts, preid validation
- `config.test.ts` — C12 load, package.json key, defaults
- `version.test.ts` — SemVer edges, prerelease promote rules
- `version-files.test.ts` — JSON/Cargo/lock adapters, recursive, mismatch, restore
- `release.test.ts` — dry-run, rollback, hooks, collisions, detached HEAD, upstream
- `github.test.ts` / `gitlab.test.ts` — token resolution, API behavior

When changing pipeline order, preserve these invariants:

1. Validate all version files before any write
2. Snapshot changelog; restore on commit failure
3. `git read-tree` restores index on prepare failure
4. Atomic push of branch + tag together
5. Tag collision checked local **and** remote before mutation
6. No releasable commits → success with zero mutation

## Security notes

- Hooks and git commands run with user privileges; never log secrets from env.
- Provider tokens only from env; `tokenEnv` disables fallbacks deliberately.
- Config paths are confined with realpath checks (`PATH_OUTSIDE_REPOSITORY`).
- Do not add “skip validation” flags that write partial version state.

## Release of the library itself

This package uses its own workflow philosophy: CI on PR/main; tag `v*` drives release/publish workflows. Local:

```bash
vp check && vp test && vp pack
```

Keep README option tables in sync with `defaults` and `types.ts` when changing config.

## When docs drift

Source of truth order:

1. `src/types.ts` + `src/config.ts` defaults + `src/release.ts` behavior
2. Unit tests
3. README
4. This skill’s references

If README and code disagree, trust the code and fix README.
