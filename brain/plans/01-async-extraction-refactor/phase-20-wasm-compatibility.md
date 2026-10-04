# Phase 20: Validate the portable WASM engine

Status: cancelled by user instruction. Historical plan only; browser support is out of scope.
Back to [[plans/01-async-extraction-refactor/overview]]. Historical dependency was native phase 19; this cancelled phase is not an outstanding acceptance gate.

## Goal

Prove compilation and extraction/OCR compatibility before implementing the browser facade.

## Changes

- `Cargo.toml`
- `src/engine/mod.rs`
- `brain/plans/01-async-extraction-refactor/wasm-compatibility-results.md`

Audit parser, image, ocrs/rten, threading and async dependencies. Prototype the napi WASI threaded target and isolate native-only scheduler setup behind platform configuration. Record evidence for binding choice and dependency feature changes. Generated artifacts and coordinated package target configuration are follow-up outputs, not manual loader edits.

## Data structures

Portable engine configuration and platform capability report; retain existing domain types.

## Verification

- Static: WASM release build and unchanged native Rust/Clippy checks; no Node-specific types in the core.
- Runtime: Run one fixture for every retained format including ocrs inference in a real browser worker; verify initialization/Promise bridge, thread creation and missing-capability diagnostics.

## Execution

Use execute/testing and the current workspace. If edits exceed three source files, split adapter wiring into focused follow-ups. Read current napi WASM guidance; compilation alone is not browser support.
