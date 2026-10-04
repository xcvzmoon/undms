# Architecture

The extraction engine uses portable Rust inputs, options, metadata, warnings, and errors. Format handlers depend on these shared values rather than JavaScript objects. Node bindings validate options and copy ordinary Buffer bytes before dispatching work.

Native requests reserve scheduler capacity before processing. CPU parsing runs on a bounded Rayon pool; OCR runs on a dedicated thread that prevents nested inference during lazy model initialization and keeps the document pool available. Promise settlement converts domain results to napi-rs objects and releases the reservation.

Single and batch APIs use the same extraction pipeline. Batches schedule at most the requested concurrency, bounded by worker availability, and place outcomes back into their original indices. IDs are descriptive and do not deduplicate work.

Text statistics are calculated once when requested. Metadata-only extraction skips text work unless statistics require it. DOCX and PPTX use namespace-aware XML visitors over bounded ZIP reads; XLSX streams cells through calamine and preserves sparse positions without allocating a dense worksheet range. PDF uses lopdf. Image OCR uses lazily initialized ocrs/rten models.

[Resource limits](/advanced/performance) bound several allocations and outputs, but third-party parsing remains in-process. This release supports native Node.js; browser/WASM work is outside its scope.
