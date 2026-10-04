# Phase 17: Delete comparison code and its direct dependencies

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Delete comparison code and its direct dependencies. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/lib.rs`
- `src/core/mod.rs`
- `src/models/mod.rs`

Delete src/core/similarity.rs and src/models/similarity.rs as one focused removal set; source deletion is additional to three edited wiring files. After rg confirms no remaining use, remove strsim/ahash/dashmap dependency entries in a separate mechanical follow-up. No stubs or legacy aliases.

## Data structures

No new types; eliminate comparison-only models and exports.

## Verification

- Static: Rust build and symbol/source scan.
- Runtime: Fresh native CJS/ESM exports and generated declarations contain extraction APIs only; targeted tests cannot import comparison.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
