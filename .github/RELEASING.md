# Releases

Run `vp run release` locally. genbumppush pushes the release commit and its version tag atomically. The config currently forces a patch release.

GitHub release creation runs on pushes to `main` whose commit subject is exactly `chore(release): v<package.json version>`. After CI succeeds for that push, `publish.yaml` publishes the built bindings and generated entry points from that exact CI run. Binding tests are currently disabled. Both jobs verify that `v<version>` points to the release commit. Pushing a tag alone does not start these workflows.

The publish workflow must exist on the default branch for its `workflow_run` trigger to fire. It accepts only successful push runs from this repository's `main` branch, never pull-request artifacts.

Use a personal credential or GitHub App credential to push the release. Pushes made with a workflow's default `GITHUB_TOKEN` do not start other push workflows.

## npm trusted publishing

For each existing npm package, open its settings and add a GitHub Actions trusted publisher:

- Owner: `xcvzmoon`
- Repository: `undms`
- Workflow filename: `publish.yaml` (case-sensitive)
- Environment: leave blank; the publish job does not use a GitHub environment

Configure all seven packages:

- `undms`
- `@undms/darwin-arm64`
- `@undms/darwin-x64`
- `@undms/linux-arm64-gnu`
- `@undms/linux-x64-gnu`
- `@undms/linux-x64-musl`
- `@undms/win32-x64-msvc`

These npm settings must be configured by a package owner before the next release. A new package needs an initial publication before its trusted publisher can be configured. For packages returning npm 404, the publishing script uses the GitHub `NPM_TOKEN` secret for initial publication only. That token must be valid, authorized for the `@undms` scope, and able to publish non-interactively. Configure trusted publishing for every new package before the next release.

The publish job in `.github/workflows/publish.yaml` uses pnpm 12's OIDC token exchange, `id-token: write`, and `--provenance`. Existing packages use OIDC; only new packages use `NPM_TOKEN` for bootstrapping. Keep the source repository public for provenance. After a successful trusted publication, remove the bootstrap GitHub `NPM_TOKEN` secret once all packages exist and their trusted publishers are configured and revoke the old npm publishing token if it has no other users.

Do not configure a global npm auth token or project `.npmrc`; token-based authentication can prevent the intended OIDC path. Bootstrap authentication uses an isolated temporary auth file only for new packages.

The publish script validates package versions, nonempty native bindings, and generated loader versions before uploading. It skips versions already present on npm so a partial publication can be retried. This does not repair incorrect dist-tags or verify private trusted-publisher settings.

Release CI must upload both `bindings-*` and `package-entry-points`. Older CI runs without entry-point artifacts cannot be published with this workflow; use a release commit containing these workflow/script changes. Do not repeatedly bump versions to diagnose publishing errors.
