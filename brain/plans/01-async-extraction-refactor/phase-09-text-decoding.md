# Phase 09: Correct text decoding and shared statistics semantics

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Correct text decoding and shared statistics semantics. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/handlers/text.rs`
- `src/metadata/statistics.rs`
- `__test__/text.spec.ts`

Apply BOM/override/UTF-8/detection policy; preserve fast path. Centralize checked scalar/word/line counts and skip unrequested scans. Remove handler-specific napi metadata construction.

## Data structures

Resolved text policy and TextStatistics independent of format payloads.

## Verification

- Static: Rust decoding/statistics tests and TS types.
- Runtime: Cover BOM/UTF-16, strict/replacement errors, Unicode/CRLF/trailing newline, valid empty text and disabled statistics.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
