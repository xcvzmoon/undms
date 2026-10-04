# Phase 22: Verify browser packaging and document support

Status: cancelled by user instruction. Historical plan only; browser support is out of scope.
Back to [[plans/01-async-extraction-refactor/overview]]. Depends on phase 21; does not authorize publication.

## Goal

Make browser support a tested deliverable with accurate deployment requirements.

## Changes

- `package.json`
- `.github/workflows/CI.yaml`
- `docs/advanced/browser-usage.md`

Coordinate changes to these shared files with the user's tooling migrations. Add validated WASM build/test coverage, package assets/exports and actual browser examples. Cross-browser fixtures and performance reporting are separate small follow-ups. Never hand-edit generated loaders or assume a browser field proves support.

## Data structures

Browser capability/build matrix and runtime asset manifest; shared public declarations.

## Verification

- Static: Package contents include WASM, loaders, workers and models/assets; both native and browser export/type resolution pass; docs build.
- Runtime: Real bundled consumers in Chromium/Firefox/WebKit, native/browser fixture parity, missing isolation/asset errors, cold/warm performance/memory and native regression checks.

## Execution

Use execute/testing and ts-best-practices. Report supported browsers and requirements based on observed results. Keep publication separate from validation.
