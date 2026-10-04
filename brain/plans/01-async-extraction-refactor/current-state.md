# Pre-refactor implementation findings

Back to [[plans/01-async-extraction-refactor/overview]]. Historical baseline findings from the checkout before this refactor. They are not descriptions of the implemented async API; see [[plans/01-async-extraction-refactor/api-contract]] and [[plans/01-async-extraction-refactor/status]].

| Area                     | Current behavior                                                                                          | Refactor implication                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/lib.rs`             | Synchronous exports; Rayon batches; HashMap MIME grouping; comparison orchestration mixed with extraction | Thin exports, shared engine, Promise APIs, ordered outputs                            |
| `src/models/document.rs` | Browser File fields required; caller size unused                                                          | Buffer input with optional identity and hints; authoritative byte length              |
| `src/core/handler.rs`    | Independent optional content, encoding, metadata, error                                                   | Rust Result plus explicit successful/partial output                                   |
| `src/models/metadata.rs` | Napi-decorated metadata directly used by handlers; six optional format fields                             | Domain structs and tagged format metadata; boundary conversions                       |
| Unsupported MIME         | Empty text returned as success, MIME used as encoding                                                     | Structured unsupported-format error; absent encoding for binary sources               |
| `src/handlers/text.rs`   | UTF-8 fast path before BOM; guessing fallback                                                             | BOM-aware policy, explicit override, strict/replacement behavior                      |
| `src/handlers/docx.rs`   | Direct paragraphs/runs only                                                                               | Tables, hyperlink text and recursive traversal; scope-specific metadata               |
| `src/handlers/xlsx.rs`   | Empty cells removed; failed sheets skipped; XLS MIME routed to Xlsx parser                                | Preserve positions, define extents, report failures, explicitly support or reject XLS |
| `src/handlers/pptx.rs`   | Sorts filenames; trimmed XML text                                                                         | Presentation relationship order; whitespace/entities/namespace handling               |
| `src/handlers/pdf.rs`    | Page extraction errors filtered out                                                                       | Indexed warnings, partial status, faithful string decoding and inherited page boxes   |
| `src/handlers/image.rs`  | OCR always runs; eager variants and repeated eligibility resizes                                          | Metadata-only fast path; lazy candidates, shared OCR permits                          |
| EXIF                     | Custom JPEG TIFF traversal                                                                                | Checked bounds and borrowed fields; don't claim universal EXIF support                |
| Text statistics          | u32 counters; no statistics for empty text                                                                | Checked wider counters, documented Unicode/newline semantics, zero values             |

## Existing tests and benchmark gaps

- `__test__/index.spec.ts` has 39 tests, roughly 15 comparison-related. Extraction assertions largely check presence or substrings, with casts to reach format metadata.
- Existing fixtures cover text/CSV, Office, PDF, OCR and JPEG metadata. Add exact-output fixtures for sparse worksheets, table/hyperlink DOCX, reordered slides, partial PDF failures and encodings.
- Benchmarks call synchronous extraction. Async callbacks must await completion; otherwise results measure enqueue overhead.
- Existing performance docs contain unverified timing estimates and show chunking arbitrary binary files as streaming extraction. Replace with bounded whole-document processing.
- CJS/ESM and generated declarations are part of API acceptance. Do not edit generated `index.js`, `index.mjs` or `index.d.ts` manually.

## Comparison removal inventory

Remove `src/core/similarity.rs`, `src/models/similarity.rs`, similarity exports/helpers in `src/lib.rs`, module declarations and comparison-only direct dependencies (`strsim`, `ahash`, `dashmap` only after checking remaining uses).

Remove comparison tests and suites, shared benchmark imports, README examples, docs API/guide/example pages and navigation entries. Coordinate package description, keywords and comparison benchmark scripts with the user's tooling work. Check built exports and generated declarations for stale symbols.

## Repository discrepancies

- Actual Rust edition: 2024. Supplied guidance: 2021.
- Local Cargo.lock resolves current stable napi versions but is ignored, so it is not a reproducibility guarantee for other checkouts.
- Package targets: Windows x64, macOS x64/arm64, Linux x64 GNU/musl and Linux arm64 GNU. Other targets mentioned in guidelines are not configured promises.
- Node package declares Node >=20 and both CJS/ESM entrypoints; preserve these existing native consumer promises pending validation.
