# Config recipes

Full option surface, defaults, and scenario templates for genbumppush.

## Config sources and precedence

1. CLI flags (`--no-push`, `--preid`, positional release type, …)
2. Explicit `--config <path>` C12 file
3. Auto-discovered C12 file named `genbumppush` in cwd (`genbumppush.config.ts`, `.js`, `.mjs`, …)
4. `"genbumppush"` key in `package.json`
5. Built-in defaults

`defineConfig` is a typed identity helper from the package. `loadReleaseConfig(cwd, configFile?, overrides?)` loads C12 + dotenv and returns the merged object.

## Defaults (as implemented)

| Key                               | Default                            |
| --------------------------------- | ---------------------------------- |
| `release`                         | detected from commits (unless set) |
| `preid`                           | `beta` (used only for pre* types)  |
| `changelog`                       | `'CHANGELOG.md'`                   |
| `excludeDependencyCommits`        | `true`                             |
| `recursive`                       | `false`                            |
| `files`                           | `['package.json']`                 |
| `git.remote`                      | `'origin'`                         |
| `git.push`                        | `true`                             |
| `git.sign`                        | `false`                            |
| `git.requireClean`                | `true`                             |
| `git.requireUpstream`             | `true`                             |
| `git.commitMessage`               | `'chore(release): v{{version}}'`   |
| `git.tagName`                     | `'v{{version}}'`                   |
| `git.tagMessage`                  | `'v{{version}}'`                   |
| `github.enabled`                  | `false`                            |
| `gitlab.enabled`                  | `false`                            |
| `github.remote` / `gitlab.remote` | unset (use `git.remote`)           |
| `hooks.before` / `hooks.after`    | unset                              |

`{{version}}` is replaced in `commitMessage`, `tagName`, `tagMessage`, and provider `releaseName`.

## Formatter ignore (required)

`changelog` output is machine-written. If the project uses oxfmt (`vp fmt` / `vp check`), Prettier, Biome, dprint, or editor format-on-save, **always exclude the changelog path** so formatters never rewrite it:

| Tool          | Ignore location                                            |
| ------------- | ---------------------------------------------------------- |
| Vite+ / oxfmt | `fmt.ignorePatterns: ['CHANGELOG.md']` in `vite.config.ts` |
| Prettier      | `CHANGELOG.md` in `.prettierignore`                        |
| Biome         | `files.ignore` / `formatter.ignore` in `biome.json`        |
| dprint        | `excludes` in `dprint.json`                                |
| Editor format | exclude the file or disable format-on-save for it          |

Use the actual `changelog` value (default `CHANGELOG.md`, or a custom path). Do not run formatters on the generated file after a release.

## Minimal / package / monorepo / Tauri

### Minimal npm package

```ts
import { defineConfig } from 'genbumppush';

export default defineConfig({
  files: ['package.json'],
});
```

### package-lock.json in sync

```ts
export default defineConfig({
  files: ['package.json', 'package-lock.json'],
});
```

`package-lock.json` updates root `version` and `packages[''].version`.

### Fixed-version monorepo

```ts
export default defineConfig({
  recursive: true,
  files: ['package.json', 'package-lock.json'],
});
```

Recursive discovery walks nested directories and finds every `package.json`, ignoring `.git`, `node_modules`, `dist`, `target`, `.output`. All discovered manifests must already share the root version (or fail with `VERSION_MISMATCH`). Independent-version packages are out of scope.

### Tauri desktop app

```ts
export default defineConfig({
  files: [
    'package.json',
    'src-tauri/tauri.conf.json',
    'src-tauri/Cargo.toml',
    'src-tauri/Cargo.lock',
  ],
});
```

Only the application Cargo package and its matching `Cargo.lock` entry are rewritten. Dependency versions in Cargo are not touched.

### Custom VERSION file

```ts
export default defineConfig({
  files: ['package.json', 'VERSION'],
});
```

Non-special files use exact text replacement: the current version string must appear **exactly once**. There is no general `pnpm-lock.yaml` adapter.

### Disable changelog

```ts
export default defineConfig({
  changelog: false,
});
```

### Force type + signed Git

```ts
export default defineConfig({
  release: 'patch',
  git: { sign: true },
});
```

### Local-only rehearsal (config, not only CLI)

```ts
export default defineConfig({
  git: { push: false },
});
```

Note: GitHub/GitLab release providers reject `push: false`.

## Version-file adapter matrix

| Path / shape                                                        | Adapter behavior                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `package.json`                                                      | Top-level `version`                                        |
| `package-lock.json`                                                 | Root `version` + `packages['']`                            |
| Other JSON with top-level string `version` (e.g. `tauri.conf.json`) | Structured top-level update                                |
| `Cargo.toml`                                                        | `version` under `[package]`                                |
| `Cargo.lock`                                                        | Entry for the package matching the adjacent Cargo manifest |
| Any other file                                                      | Exact single occurrence replace of current version         |

All configured files are **validated first**; mismatches abort without partial writes. Paths must stay inside the repository (symlink escape → `PATH_OUTSIDE_REPOSITORY`).

## Environment variables

Preferred prefix `GENBUMPPUSH_`. On each run, `.env` is loaded from cwd (changelogen-compatible). Process env already set wins over `.env`.

| Purpose        | Preferred                       | Fallbacks                                                            |
| -------------- | ------------------------------- | -------------------------------------------------------------------- |
| GitHub token   | `GENBUMPPUSH_GITHUB_TOKEN`      | `GITHUB_TOKEN`, `GH_TOKEN`, `CHANGELOGEN_TOKENS_GITHUB`              |
| GitHub host    | `GENBUMPPUSH_GITHUB_HOST`       | `GITHUB_API_URL`                                                     |
| GitHub repo    | `GENBUMPPUSH_GITHUB_REPOSITORY` | `GITHUB_REPOSITORY`, then remote via changelogen `resolveRepoConfig` |
| GitLab token   | `GENBUMPPUSH_GITLAB_TOKEN`      | `GITLAB_TOKEN`                                                       |
| GitLab host    | `GENBUMPPUSH_GITLAB_HOST`       | `GITLAB_HOST` → `https://gitlab.com`                                 |
| GitLab project | `GENBUMPPUSH_GITLAB_PROJECT`    | `GITLAB_PROJECT`                                                     |

If `tokenEnv` is set on the provider config, **only** that exact variable is read (no fallbacks).

```bash
# .env — do not commit
GENBUMPPUSH_GITHUB_TOKEN=ghp_...
```

CI should inject the same names via the job environment, not a file.

## Provider release config

### Docker — single image

```ts
export default defineConfig({
  docker: {
    enabled: true,
    source: 'ghcr.io/acme/app-build:{{version}}',
    image: 'ghcr.io/acme/app',
    tags: ['{{version}}', '{{tag}}'],
  },
});
```

### Docker — dual image (api + web)

```ts
export default defineConfig({
  docker: {
    enabled: true,
    tags: ['{{version}}', '{{tag}}'],
    images: [
      { source: 'ghcr.io/acme/api-build:{{version}}', image: 'ghcr.io/acme/api' },
      { source: 'ghcr.io/acme/web-build:{{version}}', image: 'ghcr.io/acme/web' },
    ],
  },
});
```

Do not mix `docker.images` with singular `docker.source`/`docker.image`. Root `tags`/`push`/`allowMutableTags` default into each entry. `--retry-docker <tag>` re-publishes every configured image.

### GitHub (incl. GHES)

```ts
export default defineConfig({
  git: { push: true },
  github: {
    enabled: true,
    // host: 'github.com',           // or GHES host → https://HOST/api/v3
    // repo: 'owner/name',
    // tokenEnv: 'MY_GITHUB_TOKEN',  // disables fallback chain
    releaseName: 'v{{version}}',
  },
});
```

Repo resolution: config `github.repo` → `GENBUMPPUSH_GITHUB_REPOSITORY` / `GITHUB_REPOSITORY` → git remote metadata. Description is the matching `## <tag>` section of the changelog.

### GitLab

```ts
export default defineConfig({
  git: { push: true },
  gitlab: {
    enabled: true,
    host: 'https://gitlab.com',
    project: 'group/project',
    releaseName: 'v{{version}}',
  },
});
```

Project path is required (config or env). Without a token: clear error telling the user which env var to set.

### Dual-host (GitHub origin + separate GitLab remote)

GitLab Releases require the tag to already exist on the GitLab project. When `git.remote` is GitHub, set `gitlab.remote` so the branch and tag are pushed there before the API call:

```ts
export default defineConfig({
  git: { push: true, remote: 'origin' },
  github: { enabled: true },
  gitlab: {
    enabled: true,
    project: 'group/project',
    remote: 'gitlab',
  },
});
```

`github.remote` is the symmetric option when GitHub is not the primary remote. The extra remote must already exist; genbumppush fails fast before commit/tag if it is missing. Retry flags (`--retry-gitlab` / `--retry-github`) resolve the tag on the provider remote when one is configured.

## Hooks

```ts
export default defineConfig({
  hooks: {
    before: ['vp check', 'vp test'], // string or string[]
    after: 'echo Release complete',
  },
});
```

- `before`: after tag-collision check, before version-file writes.
- `after`: after tag, optional atomic push, and provider releases.
- Run with `shell: true` in the repo cwd; non-zero → `HOOK_FAILED` (before hooks: no files written yet if they fail before apply; after hooks: release already pushed).

## What genbumppush does not do

- Does not publish to npm (use tag-triggered publish workflow).
- Does not support independent multi-package versioning in one run.
- Does not modify Cargo dependency versions.
- Does not disable tag collision checks when relaxing `requireClean` / `requireUpstream`.
