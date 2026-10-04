# CLI, SemVer, and error recovery

## Usage

```text
genbumppush [release] [options]
```

Positional release type (optional): `major | minor | patch | premajor | preminor | prepatch | prerelease`. Omit to detect from Conventional Commits.

| Option                 | Meaning                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `--cwd <path>`         | Repository directory (default: process cwd). Supports `--cwd=path`.                 |
| `--config <path>`      | Explicit C12 config file                                                            |
| `--preid <id>`         | Prerelease id: `^[0-9A-Za-z-]+$` only                                               |
| `--retry-gitlab <tag>` | Retry GitLab release for an existing **remote** tag                                 |
| `--retry-github <tag>` | Retry GitHub release for an existing **remote** tag                                 |
| `--retry-docker <tag>` | Retry Docker publication for an existing **remote** Git tag (all configured images) |
| `--dry-run`            | Print planned version + changelog markdown; no file/Git/remote changes              |
| `--no-push`            | Keep commit and tag local (`git.push = false`)                                      |
| `--no-docker`          | Disable configured Docker tagging for this invocation                               |
| `--yes`, `-y`          | Skip interactive confirmation                                                       |
| `--help`, `-h`         | Help text                                                                           |

Conflict rules (parse errors):

- `--retry-gitlab` cannot combine with a release type
- `--retry-github` cannot combine with a release type
- Provider retry options cannot combine with one another

CLI overrides config: `--no-push` forces `git.push` false even if config says true.

## Release type effects (from `1.2.3`)

| Type         | Result                                          |
| ------------ | ----------------------------------------------- |
| `major`      | `2.0.0`                                         |
| `minor`      | `1.3.0`                                         |
| `patch`      | `1.2.4`                                         |
| `premajor`   | `2.0.0-beta.0` (or `--preid`)                   |
| `preminor`   | `1.3.0-beta.0`                                  |
| `prepatch`   | `1.2.4-beta.0`                                  |
| `prerelease` | `1.2.4-beta.0` or increment existing prerelease |

SemVer quirks implemented in `bumpVersion`:

- Stripping a prerelease via stable `major`/`minor`/`patch` promotes to the corresponding stable version when the remaining numbers already match (e.g. `1.2.4-beta.0` + `patch` → `1.2.4`).
- `major` on `1.0.0-beta.0` promotes to `1.0.0` (does not jump to `2.0.0` when minor and patch are already 0).
- Invalid SemVer or numeric identifiers with leading zeros → `INVALID_VERSION`.

## Pipeline order (non-retry path)

1. Load config + dotenv; require Git repository
2. Read root `package.json` version
3. Reject dirty worktree / detached HEAD / missing upstream (if push)
4. Parse commits → detect or force release type; if none, exit success with no mutation
5. Compute planned version and tag template
6. Dry-run? print and return
7. Preflight Docker source image and resolve provider contexts
8. Confirm (unless `--yes`)
9. Check local + remote tag collision
10. Run `hooks.before`
11. Plan + apply version files; prepend changelog; `git add`; `git commit` (optional `-S`)
12. On failure during write/commit: restore files, restore changelog, `git read-tree` previous index, rethrow
13. `git tag -a` (optional `-s`)
14. `git push --atomic <remote> HEAD:<branch> refs/tags/<tag>` if push
15. Extra atomic pushes to `gitlab.remote` / `github.remote` when those differ from `git.remote`
16. Optional Docker tagging/publication
17. Optional GitHub/GitLab release API
18. Run `hooks.after`
19. Return `ReleaseResult`

## Error codes and recovery

CLI prints `[CODE] message` and exits 1.

| Code                                                                  | When                                                | Recovery                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `NOT_A_REPOSITORY`                                                    | cwd not a work tree                                 | Fix `--cwd`                                                         |
| `INVALID_PACKAGE`                                                     | package.json missing string `version`               | Add version field                                                   |
| `DIRTY_WORKTREE`                                                      | porcelain status non-empty and `requireClean`       | Commit/stash; or set `git.requireClean: false` deliberately         |
| `DETACHED_HEAD`                                                       | empty `branch --show-current`                       | Checkout a branch                                                   |
| `GIT_COMMAND_FAILED`                                                  | any git subprocess failed (incl. missing upstream)  | Read stderr; `git status`, `git rev-parse --abbrev-ref @{upstream}` |
| `TAG_EXISTS`                                                          | `refs/tags/<tag>` local or remote exists            | Do not clobber published tags; bump again or delete local-only tag  |
| `HOOK_FAILED`                                                         | hook exit non-zero                                  | Fix command; nothing may have been written if `before` failed early |
| `VERSION_MISMATCH`                                                    | adapter found different version in a file           | Align all configured files                                          |
| `PATH_OUTSIDE_REPOSITORY`                                             | file path escapes cwd/realpath root                 | Keep version files inside the repo                                  |
| `CANCELLED`                                                           | interactive no                                      | Re-run when ready                                                   |
| `INVALID_PREID` / `INVALID_RELEASE_TYPE` / `INVALID_VERSION`          | bad inputs                                          | Fix CLI/config                                                      |
| `GITHUB_RELEASE_FAILED`                                               | provider disabled, missing token/repo, or API error | Enable + env; or disable provider                                   |
| `GITLAB_RELEASE_FAILED`                                               | same for GitLab (project required)                  | Set project + token; push must be on                                |
| `RELEASE_PUBLISHED_GITHUB_FAILED`                                     | Git tag pushed, GitHub API failed                   | `genbumppush --retry-github <tag>`                                  |
| `RELEASE_PUBLISHED_GITLAB_FAILED`                                     | Git tag pushed, GitLab API failed                   | `genbumppush --retry-gitlab <tag>`                                  |
| `DOCKER_NOT_AVAILABLE` / `DOCKER_SOURCE_NOT_FOUND`                    | Docker CLI/source image missing                     | Install/start Docker; build or pull the configured source           |
| `DOCKER_CONFIG_INVALID` / `DOCKER_TAG_INVALID`                        | Unsafe or incomplete Docker config                  | Correct image repository/tag templates                              |
| `DOCKER_PUBLISH_FAILED`                                               | Retry Git remote/tag is unavailable                 | Correct the remote or push the Git tag first                        |
| `DOCKER_TAG_CONFLICT` / `DOCKER_TAG_FAILED` / `DOCKER_PUSH_FAILED`    | Local tag conflict or Docker operation failed       | Inspect the image/digest; authenticate to the registry              |
| `RELEASE_PUBLISHED_DOCKER_FAILED`                                     | Git tag pushed, Docker publication failed           | `genbumppush --retry-docker <tag>`                                  |
| `UNKNOWN_ARGUMENT` / `MISSING_OPTION_VALUE` / `CONFLICTING_ARGUMENTS` | CLI parse                                           | Follow help text                                                    |

## Partial-failure playbooks

### Push failed after commit + tag

Local release commit and tag remain. Inspect:

```bash
git status
git log -1
git show
git describe --tags --exact-match HEAD
```

Then either:

```bash
git push --atomic origin HEAD:$(git branch --show-current) refs/tags/v1.2.3
```

or, only if the tag was never published and the release must be redone:

```bash
git tag -d v1.2.3
# reset/revert the release commit deliberately if needed, then re-run
```

### Provider release failed after successful push

Do **not** re-run a full release (tag already exists). Fix credentials and:

```bash
genbumppush --retry-github v1.2.3
genbumppush --retry-gitlab v1.2.3
genbumppush --retry-docker v1.2.3
```

Retry requires the tag to exist on the configured remote (`gitlab.remote` / `github.remote` when set, otherwise `git.remote`) and the provider `enabled: true` with token/project/repo available.

In dual-host setups, configure `gitlab.remote` (for example `'gitlab'`) so the release tag is pushed to GitLab before the release API is called. GitLab's API returns `404 Tag Not Found` when the tag is only on `origin`.

### Version mismatch before any write

`planVersionChanges` validates all files first. Fix the odd file so every configured manifest reports the root version, then re-run.

## Successful no-op

If no releasable commits (or only excluded `chore(deps)`), output is `No releasable commits found.` Exit code 0. Nothing is mutated.

## Dry-run contract

- No file writes, no git mutations, no remote calls for versioning
- Prints planned bump and full changelog markdown to stdout
- `ReleaseResult.dryRun === true`, `pushed === false`

## Programmatic surface

```ts
import { defineConfig, loadReleaseConfig, runRelease, ReleaseError } from 'genbumppush';
import type {
  GenBumpPushConfig,
  CliOptions,
  ReleaseResult,
  ReleaseType,
  GitOptions,
  GitHubOptions,
  GitLabOptions,
  DockerOptions,
  HookOptions,
} from 'genbumppush';
```

`runRelease` accepts the same shape as `CliOptions` (`cwd` required, `dryRun`/`yes` booleans, optional release/preid/push/retry tags/configFile).
