# Implemented Rust architecture

Back to [[plans/01-async-extraction-refactor/overview]]. Final acceptance gaps are in [[plans/01-async-extraction-refactor/status]] and [[plans/01-async-extraction-refactor/verification]].

## Module responsibilities

| Module                  | Responsibility                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| src/lib.rs              | Module wiring                                                                                                |
| src/types.rs            | Portable domain options, outputs, metadata, errors, warnings, handler trait and bounded text/warning helpers |
| src/api/types.rs        | Napi input/return objects, tagged unions and domain conversion                                               |
| src/api/options.rs      | Validated options, defaults and batch configuration                                                          |
| src/api/mod.rs          | Canonical input inspection, snapshots, admission, Promise bridge and bounded batch coordination              |
| src/engine/mod.rs       | Detection, handler dispatch, shared statistics, output accounting and panic containment                      |
| src/engine/scheduler.rs | Shared Rayon CPU pool, dedicated OCR thread/channel, admission and completion channels                       |
| src/engine/archive.rs   | Bounded ZIP reads and actual-inflation audit                                                                 |
| src/handlers/docx.rs    | DOCX handler plus shared namespace-aware XML and core-property helpers                                       |
| src/handlers/           | Format parsers behind DocumentHandler                                                                        |
| src/metadata/mod.rs     | Shared Unicode/newline text statistics                                                                       |

## Boundary and scheduling

- Napi object conversion may execute reentrant JavaScript getters. Canonical typed-array inspection rejects shared/detached backing and refreshes the captured Buffer view before reading any byte or cached length.
- Validate options/identity/count and reserve capacity before copying. Snapshot ordinary Buffer bytes while on the JavaScript thread. Workers receive Rust-owned bytes and immutable options; no borrowed JS slices or Env handles enter parser work.
- Env::spawn_future orchestrates Rayon CPU jobs and a dedicated OCR thread through one-shot channels; parsing remains synchronous within those jobs. No libuv blocking coordinators or nested OCR candidate parallelism.
- CPU pool uses available parallelism capped at four; dedicated image/OCR thread processes one job at a time. Admission caps32 requests/512MiB conservative reservations across the process.
- Batch coordinator bounds in-flight items by resolved concurrency. It admits at most one image job per batch and fills remaining slots with CPU jobs; completion is stored by original index.
- Single admission reserves accepted input bytes plus output allowance. Batch admission reserves total input, total output allowance, and active-job output allowance. Arc-held reservations survive still-running workers after batch rejection and final conversion.
- Fairness across requests, deadlines, cancellation, exhaustive cross-environment teardown and hard process-RSS ceilings are not promised. Final verification distinguishes direct tests from these unproven properties.

## Shared extraction primitive

- Engine consumes an owned Input and returns Processed containing source, domain Result<HandlerOutput>, and timings. Public status conversion occurs in the API layer based on fatal errors or partial-content warnings.
- Selection is resolved before parsing. Statistics are centrally calculated once when enabled. Metadata-only normally omits text generation/OCR; explicit statistics requests enable internal text but omit it on return.
- Format signatures and normalized MIME hints are separate. Unsupported hints produce errors; strong conflicting evidence produces FORMAT_MISMATCH.
- Text construction and result estimates enforce output budgets. Warning storage is capped; overflow changes the final warning to WARNINGS_TRUNCATED, without an omitted-warning count.
- Timing uses Instant; queue/processing timing is collected internally and exposed only when metrics is enabled. Initial snapshot and final JS conversion are outside those durations.

## Format behavior and budgets

- Text: BOM/override before valid UTF-8 or guessing; explicit conflict produces DECODE_FAILED. Strict failure versus replacement warning is deliberate.
- DOCX: namespace-aware XML visits body paragraphs, nested tables, hyperlinks, tabs/breaks and counts; common core properties are bounded separately. Headers/footers/notes are not extracted.
- XLSX: fixed-buffer actual inflation audit precedes calamine; required ZIP parts are decompressed again. Cells stream through calamine, metadata-only avoids copied cell strings, text uses a conservatively budgeted sparse map and TSV coordinates. Failed sheets warn; all-sheet failure is fatal.
- PPTX: relationship-order slides and faithful XML whitespace/entities. Missing/malformed slide text may yield partial output; optional-property warnings need not change success status.
- DOCX/PPTX consumed ZIP parts share a running inflation budget, including bytes consumed before a CRC failure. Unrequested parts are not inflated. XML rejects DTDs, incomplete documents and undeclared namespaces.
- PDF: lopdf parsing, embedded text and common properties, page warnings, inherited page boxes and partial-content preservation. No rendering/scanned-page OCR; parser allocations are not a hard bounded-memory sandbox.
- Images: dimension check before raster decode; available JPEG TIFF EXIF metadata; lazy shared ocrs/rten models. Fast/balanced/accurate have finite sequential candidate work. Heuristic text score is not calibrated confidence.
- Calamine/lopdf scratch allocations remain in-process. Admission/output/inflation bounds and image decoder limits constrain work but do not enforce a whole-process memory or execution-time ceiling.

Browser/WASM is cancelled and outside this release. Source portability remains useful without implying a browser delivery commitment.
