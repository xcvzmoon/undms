# CI/CD integration

Split concerns: **create the versioned tag** (human or CI job running genbumppush), then **react to `v*` tags** for release notes, npm publish, or app deploy.

## Mental model

```text
Conventional Commits on main
        │
        ▼
genbumppush  ──►  bump files + CHANGELOG + commit + annotated tag
        │
        └──►  git push --atomic origin HEAD:main refs/tags/vX.Y.Z
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
  GitHub Release   npm publish      App deploy
  (provider or     (publish.yml)    (installers, etc.)
   separate job)
```

A release commit message alone does **not** fire tag workflows. The tag must exist on the remote and match the workflow `on.push.tags` pattern (`v*`).

## Recommended job split (GitHub)

From the library's own release philosophy:

| Workflow      | Trigger            | Job                                                                                    |
| ------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `ci.yml`      | PRs + push to main | lint/test/pack — never release                                                         |
| `release.yml` | push tags `v*`     | create GitHub Release from changelog section (or rely on genbumppush `github.enabled`) |
| `publish.yml` | push tags `v*`     | verify tag === `v${package.json.version}`, build, `npm publish`                        |

Do not fold "bump version" and "publish to npm" into one unprotected job on every push to main unless the repo is fully automated and credentials are locked down.

## Cutting a release from CI

```yaml
# conceptual release job — protect with branch rules + token permissions
release:
  runs-on: ubuntu-latest
  permissions:
    contents: write # push tag; create release if using github.enabled
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0 # full history so changelogen sees commits
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - run: npm ci
    - run: npx genbumppush --dry-run --yes # optional gate
    - run: npx genbumppush --yes
      env:
        GENBUMPPUSH_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        # GENBUMPPUSH_GITHUB_REPOSITORY: ${{ github.repository }}  # usually auto in Actions
```

Notes:

- Checkout must include tags and enough history (`fetch-depth: 0`).
- The default `GITHUB_TOKEN` can push tags if `contents: write` is set; protected branches may require a PAT or GitHub App token.
- Prefer `GENBUMPPUSH_GITHUB_TOKEN` over legacy names.
- For a non-interactive bump type: `npx genbumppush patch --yes`.

## Tag-triggered GitHub Release

```yaml
name: release
on:
  push:
    tags: ['v*']

jobs:
  github-release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx genbumppush --retry-github "$GITHUB_REF_NAME" --yes
        env:
          GENBUMPPUSH_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`--retry-github` creates/updates the provider release for an already-pushed tag (tag must exist on origin). Alternative: dedicated `release.yml` that only builds notes without genbumppush.

## Tag-triggered npm publish (pattern)

```yaml
name: publish
on:
  push:
    tags: ['v*']

jobs:
  npm:
    runs-on: ubuntu-latest
    permissions:
      id-token: write # npm trusted publishing / provenance
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - name: Verify tag matches package.json
        run: |
          PKG_VERSION=$(node -p "require('./package.json').version")
          test "$GITHUB_REF_NAME" = "v${PKG_VERSION}"
      - run: npm run build
      - run: npm publish --access public --provenance
        # Private source repos: set NPM_CONFIG_PROVENANCE=false instead of --provenance
```

### Trusted publishing checklist

- npm package trusted publisher configured to this repository + workflow file
- Workflow has `id-token: write`
- Node/npm recent enough for provenance
- Public source + provenance, **or** private source + `NPM_CONFIG_PROVENANCE=false`

## GitLab CI

Tag-driven release job example (from README):

```yaml
release:
  image: node:20
  rules:
    - if: '$CI_COMMIT_TAG =~ /^v/'
  script:
    - npm ci
    - npx genbumppush --dry-run --yes
    - npm run build
  release:
    tag_name: '$CI_COMMIT_TAG'
    name: 'Release $CI_COMMIT_TAG'
```

For genbumppush-created GitLab releases (API) instead of the `release:` keyword:

```yaml
# protected tag job with GENBUMPPUSH_GITLAB_TOKEN in CI variables
- npx genbumppush --retry-gitlab "$CI_COMMIT_TAG" --yes
```

Keep artifact publication and release creation in protected, tag-triggered jobs with separate credentials.

## Environment matrix for CI

| Variable                        | When                                           |
| ------------------------------- | ---------------------------------------------- |
| `GENBUMPPUSH_GITHUB_TOKEN`      | `github.enabled` or `--retry-github`           |
| `GENBUMPPUSH_GITHUB_REPOSITORY` | Optional override (`owner/name`)               |
| `GENBUMPPUSH_GITHUB_HOST`       | GHES only                                      |
| `GENBUMPPUSH_GITLAB_TOKEN`      | `gitlab.enabled` or `--retry-gitlab`           |
| `GENBUMPPUSH_GITLAB_PROJECT`    | Required for GitLab releases (`group/project`) |
| `GENBUMPPUSH_GITLAB_HOST`       | Self-managed GitLab                            |
| `NPM_CONFIG_PROVENANCE=false`   | Private repo npm provenance                    |

Do not commit `.env` with tokens. In CI, inject via secrets/variables.

## Local vs CI release decision

| Situation                             | Recommendation                                |
| ------------------------------------- | --------------------------------------------- |
| One-off human release                 | Local `npm run release` after `--dry-run`     |
| Team wants no laptops with npm tokens | CI-only `genbumppush --yes` on protected main |
| Rehearsal                             | Local `--no-push --yes`                       |
| Preview changelog                     | `--dry-run --yes` anywhere                    |
| GitLab release API retry              | `--retry-gitlab <tag>` after push succeeded   |

## Common CI failures

| Symptom                  | Likely cause                                    | Fix                                                               |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------- |
| Workflow never runs      | Tag not pushed or not `v*`                      | `git ls-remote --tags origin`; fix pattern                        |
| Publish version mismatch | package.json ≠ tag                              | Fix release commit; do not invent a new tag casually              |
| Dirty worktree in CI     | generated files, gitignored noise still unclean | Ensure clean checkout; adjust hooks; rarely `requireClean: false` |
| Provenance rejected      | private source repository                       | `NPM_CONFIG_PROVENANCE=false`                                     |
| `EBADDEVENGINES`         | package manager mismatch                        | Use declared manager or align `devEngines`                        |
