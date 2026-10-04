# Performance and limits

Async extraction moves CPU parsing off the JavaScript event loop. Native input validation and Buffer snapshots still run during the call, so large batches incur copy time before their Promises are returned.

A bounded native pool handles document parsing. A separate image worker limits memory-heavy OCR work. Native admission currently allows up to 32 outstanding requests and 512 MiB of reserved input/output capacity across the process; reserve failures report `OVERLOADED`. Batch concurrency is capped by the CPU worker count, currently at most four. Each batch is one admitted request. Single requests reserve input bytes plus the configured output allowance. Batches reserve total input bytes, their total output allowance, and an additional per-active-document output allowance. These conservative reservations can reject a request before actual memory usage approaches the cap.

## Reduce work

Select metadata when text is unnecessary. Keep statistics disabled for metadata-only work to avoid parsing text. Use text-only selection when format metadata is unnecessary. Choose OCR fast mode when fewer preprocessing attempts are appropriate, or disable OCR to inspect image metadata only.

Avoid submitting unbounded `Promise.all` requests. Use `extractBatch` with bounded batches and concurrency, then measure latency, throughput, and memory for your own document mix. Timing metrics report queue and processing durations; they exclude some JavaScript copying and result conversion time. No fixed speedup is promised. Batch scheduling allows one image job at a time within a batch while filling available slots with CPU documents; returned items still preserve input order. Process-wide strict request fairness is not guaranteed.

## Limits and parser allocations

Document limits cover input/result bytes, archive entries and decompressed reads, and image pixels. XLSX decompresses each archive entry into a fixed discard buffer to audit actual expansion before calamine reads it, even when ZIP size declarations are false. Calamine subsequently decompresses required parts again. Sparse cells are streamed instead of constructing dense ranges, and text cell storage has a conservative output-budget charge. DOCX/PPTX bounded ZIP reads account for consumed parts. Warning collection is bounded.

Calamine and lopdf allocate inside their parsers. ZIP size checks and input/result budgets are not a hard process-memory ceiling; PDF object/decompression and spreadsheet shared strings may allocate substantially before extraction completes. There is no per-document execution timeout or cancellation guarantee. Use an isolated process with external resource limits when handling hostile documents that require a hard memory or time boundary.

Output byte accounting includes estimated metadata, warnings, and identity overhead. It is an allocation budget, not the exact JSON serialized size. Batch input and output limits supplement individual document limits.
