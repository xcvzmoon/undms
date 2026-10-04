## Package extraction benchmark

3 sourced documents across IMAGE. 3 isolated process rounds per package/workload on Apple M1 (8 logical CPUs).

**Warm time per document, milliseconds — lower is faster.** Each single-file median is weighted equally; batches contain distinct documents and report amortized cost. Unsupported formats are shown as —; incomplete measurements are not ranked.

| Format / mode  |  undms | tesseract.js |
| -------------- | -----: | -----------: |
| IMAGE · single | 576.90 |       634.14 |
| IMAGE · batch  | 622.49 |       286.98 |

![Batch extraction latency](latency.svg)

Unique warm-latency group wins: undms 1, tesseract.js 1 across 2 complete comparisons. Ties are excluded; small differences do not establish statistical significance.

Compared with undms, 0 measured competitor rounds have identical text, 0 differ only in whitespace, and 12 differ beyond whitespace. These comparisons are not ground-truth accuracy scores. Review the saved extracted text. This small corpus does not establish general performance, extraction accuracy, or metadata equivalence.

### Image OCR accuracy

undms uses ocrs in **balanced** mode; Tesseract.js uses English LSTM (OEM 1), the pinned best_int model, and reused workers (up to 4, bounded by image count). Native OCR uses its dedicated serial lane. Models are prepared before timing; first recognition includes engine initialization. Warm timing excludes worker creation and final termination.

| Receipt   | Engine       | Character error % | Word error % |
| --------- | ------------ | ----------------: | -----------: |
| sroie-000 | undms        |             54.02 |        75.29 |
| sroie-000 | tesseract.js |             16.70 |        48.24 |
| sroie-001 | undms        |             39.77 |        60.78 |
| sroie-001 | tesseract.js |             23.98 |        43.14 |
| sroie-002 | undms        |             34.02 |        61.79 |
| sroie-002 | tesseract.js |              4.70 |        22.76 |

Lower error rates are better. Scores use the first single-image output from round 1, normalized with NFKC, lowercase and collapsed whitespace. Levenshtein edits are divided by reference characters or words; insertions can produce rates above 100%. Reference text follows SROIE annotation order, so layout order and annotation errors affect scores. Three receipts do not establish general OCR accuracy. [Pinned images and reference annotations](../../image-corpus-manifest.json).

**CPU is measured separately under sustained load**, using OS process user + system counters, including native threads. 100% means one occupied core, not the whole machine. More CPU utilization can reflect useful parallel work; compare it with completed documents/s and CPU time/document.

0 failed runs. [CPU, memory and methodology](report.md) · [Raw measurements](results.json)

<details>
<summary>Environment and measurement method</summary>

Measured 2026-10-04T10:47:32.865Z with Node v24.21.0 on darwin-arm64; Apple M1, 8 logical CPUs, 8.00 GiB RAM. Commit 7055761231f197a210b5ce81af79509a3f71041b (dirty workspace).

Versions: officeparser 8.1.0, mammoth 1.13.0, pdf-parse 2.4.5, tesseract.js 7.0.0, tinybench 6.2.0, undms workspace. 3 rounds; Tinybench warm measurement 1000 ms, sustained resource measurement 2000 ms, batch concurrency 4. Warm medians pool timing samples per workload across rounds; single-file workload medians are equally weighted within each format. Batch call time is divided by document count, so it is amortized ms/document. Cold extraction and module load are reported separately below.

CPU uses OS process user + system counters during sustained extraction, wall-time weighted across runs: 100% is one logical core and values can exceed 100%. Host capacity is this process CPU divided by logical CPU count, not total system-wide utilization. Throughput is total completed documents divided by measured wall time. Peak RSS is the OS process high-water mark across module load, latency and resource phases; retained RSS/heap are means after GC while inputs and first/last results remain retained. The resource loop yields once per completed call and includes adapter/cleanup and monitoring overhead. The 100 ms CPU timeline may be delayed by synchronous blocking; aggregate CPU remains measured by OS counters. Idle CPU is measured over 300 ms after a 200 ms settling period. This is a short recovery check, not proof of leak freedom. Failed/incomplete measurements carry † and cannot win. Async adapters are awaited through completion.

</details>
