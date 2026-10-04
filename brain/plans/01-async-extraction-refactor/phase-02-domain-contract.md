# Phase 02: Introduce pure Rust outcome and metadata models

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Introduce pure Rust outcome and metadata models. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/types/result.rs`
- `src/types/metadata.rs`
- `src/types/mod.rs`

Separate domain values from napi; use Result/enums and checked integer conversions. Add these privately with minimal module wiring before deleting existing models.

## Data structures

ExtractionOutcome, ExtractionResult, ExtractionFailure and tagged FormatMetadata; shared SourceInfo, properties, statistics, warnings and metrics.

## Verification

- Static: Rust checks and domain invariants; no napi imports in domain models.
- Runtime: Prove success/partial/error invariants, empty statistics and format-tag correspondence in pure Rust tests.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
