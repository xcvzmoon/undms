# Releases

Run `vp run release` locally. genbumppush pushes the release commit and its version tag atomically. The config currently forces a major release.

GitHub release creation runs on pushes to `main` whose commit subject is exactly `release: v<package.json version>`. After CI succeeds for that push, `publish.yaml` publishes the tested bindings from that exact CI run. Both jobs verify that `v<version>` points to the release commit. Pushing a tag alone does not start these workflows.

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

These npm settings must be configured by a package owner before the next release. A new package needs an initial publication before its trusted publisher can be configured.

The publish job in `.github/workflows/publish.yaml` uses pnpm 12's OIDC token exchange, `id-token: write`, and `--provenance`. It does not use `NPM_TOKEN`. Keep the source repository public for provenance. After a successful trusted publication, remove the obsolete GitHub `NPM_TOKEN` secret and revoke the old npm publishing token if it has no other users.

Do not add an npm auth token to the workflow or its `.npmrc`; token-based authentication can prevent the intended OIDC path.
