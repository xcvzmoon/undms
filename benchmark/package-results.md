# Historical smoke-fixture benchmark

This snapshot predates the Tinybench real-document suite. Run `pnpm bench:packages` for the current corpus and sustained CPU measurement.

Run with `pnpm bench:packages --output benchmark/results/node-packages`.

2026-10-04T07:06:46.676Z; darwin-arm64; v24.21.0. Three fresh processes per package/workload, twenty measured warm calls per process, three additional warmups. Sixty child processes and 1,200 measured calls completed with no failures. Competitors: officeparser 8.1.0, Mammoth 1.13.0, pdf-parse 2.4.5. Workspace release build, text only, statistics/OCR disabled.

| Workload  | undms ms/doc | officeparser ms/doc | Specialist ms/doc |
| --------- | -----------: | ------------------: | ----------------- |
| DOCX × 1  |        0.528 |              11.475 | mammoth: 7.019    |
| DOCX × 10 |        0.169 |              10.634 | mammoth: 6.152    |
| XLSX × 1  |        0.333 |               3.591 | —                 |
| XLSX × 10 |        0.120 |               3.723 | —                 |
| PPTX × 1  |        0.105 |               1.923 | —                 |
| PPTX × 10 |        0.040 |               1.525 | —                 |
| PDF × 1   |        0.083 |               2.632 | pdf-parse: 0.475  |
| PDF × 10  |        0.031 |               9.995 | pdf-parse: 0.228  |

Values are median completed call time divided by document count. Ten-document batch values are amortized time per document, not individual document latency.

undms had lower warm extraction latency, CPU time per call, and process peak RSS across these workloads. The full report also includes p95 latency, completed documents per second, timer delay, cold calls, module load, and memory after GC. Raw local reports and extracted text are under `benchmark/results/node-packages/` (ignored generated artifacts).

DOCX matches both competitors after whitespace normalization. The PDF fixture matches officeparser exactly; pdf-parse adds a page marker. XLSX output differs because undms emits sheet labels. PPTX officeparser output includes a trailing slide number. These differences are visible in the retained text files and are not silently normalized away by the benchmark.

This is a small repository fixture corpus, not a general performance or accuracy ranking. In particular, the PDF fixture only contains “Hello PDF”, and PPTX is also small. Larger, varied real documents and a ground-truth accuracy corpus are needed before making broader claims. Officeparser constructs an AST and converts it to text; that richer parsing work is included. Competitor batches use a bounded JavaScript adapter; undms uses native batch processing. PDF parser creation, input copying and awaited destruction are included. CPU includes all threads of each process; memory checkpoints do not establish leak freedom. See [methodology and commands](README.md#other-nodejs-packages).

## Conclusions from this run

Warm median latency wins: undms 8/8 fully measured workloads. Ties are not counted as wins.

| Workload  | Fastest warm p50 | Runner-up / fastest time | Lowest CPU/call | Lowest peak RSS | Lowest timer p95 |
| --------- | ---------------- | -----------------------: | --------------- | --------------- | ---------------- |
| DOCX × 1  | undms            |                   13.29× | undms           | undms           | mammoth          |
| DOCX × 10 | undms            |                   36.33× | undms           | undms           | mammoth          |
| XLSX × 1  | undms            |                   10.77× | undms           | undms           | undms            |
| XLSX × 10 | undms            |                   31.03× | undms           | undms           | undms            |
| PPTX × 1  | undms            |                   18.33× | undms           | undms           | undms            |
| PPTX × 10 | undms            |                   38.28× | undms           | undms           | undms            |
| PDF × 1   | undms            |                    5.72× | undms           | undms           | officeparser     |
| PDF × 10  | undms            |                    7.44× | undms           | undms           | undms            |

The ratio compares the second-fastest package with the fastest on the same workload; 2× means the runner-up took twice as long. Winners use unrounded measurements. Small differences are not evidence of statistical significance. Batch winners describe amortized processing cost, not individual document latency. CPU, RSS and timer winners are independent observations, not a combined score.

No process runs failed. Text differs beyond whitespace in 6 competitor/workload rows; another 4 differs only in whitespace. Output similarity is relative to undms, not ground-truth correctness. Review extracted-text/ before treating different outputs as equivalent.

Package roles in this benchmark: **undms** provides native single/batch text extraction; **officeparser** provides multi-format parsing through an AST and text conversion; **Mammoth** is the DOCX-only raw-text comparator; **pdf-parse** is the PDF-only comparator with parser cleanup included. The specialist packages were not tested on unsupported formats.

Use these results to choose for this fixture workload. This run does not establish a universal best package, accuracy winner, large-document ranking, or leak-free implementation.
