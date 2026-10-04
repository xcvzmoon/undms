# Phase 15: Separate cheap image metadata from raster/OCR work

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Separate cheap image metadata from raster/OCR work. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/handlers/image.rs`
- `src/metadata/exif.rs`
- `__test__/image-metadata.spec.ts`

Read headers where possible, validate dimensions and decode limits, extract current JPEG EXIF safely. Use checked offsets and borrowed slices; evaluate mature EXIF dependency only if it reduces risk with fixture coverage.

## Data structures

ImageMetadata, pixel Dimensions and GeoLocation; no engine initialization dependency.

## Verification

- Static: Rust EXIF/header checks and type narrowing.
- Runtime: Prove metadata-only skips models/raster when possible, malformed offsets/GPS rational handling, pixel bounds, missing EXIF and existing JPEG fixture values.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
