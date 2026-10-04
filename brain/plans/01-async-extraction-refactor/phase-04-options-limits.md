# Phase 04: Resolve reusable extraction options and finite limits

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Resolve reusable extraction options and finite limits. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/types/options.rs`
- `src/engine/limits.rs`
- `src/api/options.rs`

Separate selection/parser policy from batch scheduling; validate once. Choose provisional finite limits from phase 01 corpus and track unsupported parser scratch-allocation guarantees.

## Data structures

ExtractionOptions, ResolvedOptions, BatchOptions and ResourceLimits.

## Verification

- Static: Option resolution tests and boundary type checks.
- Runtime: Prove defaults, explicit overrides, invalid numeric/enum values, selection conflicts and limit overflow handling.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
