# Phase 07: Expose async single extraction with deterministic input snapshots

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Expose async single extraction with deterministic input snapshots. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/api/extract.rs`
- `src/lib.rs`
- `__test__/single.spec.ts`

Validate and reserve before snapshot; reject unsupported shared-backed memory. Replace old synchronous extract with new single Promise export. Existing old tests migrate in phase 18; keep dedicated new contract tests running meanwhile.

## Data structures

ExtractionInput, SourceInfo and ExtractionOutcome through the common engine.

## Verification

- Static: Build both entrypoints and generated Promise/outcome types; targeted TS/Rust checks.
- Runtime: Prove Promise completion, caller mutation/forced-GC safety, document error outcomes, invocation rejection and heartbeat progress.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
