/* oxlint-disable no-console */
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { extractBatch } from '../index.js';
import { createFormatInputs, createTextInputs, repeatInput, verifyBatch } from './common.js';

// Fixed iterations provide completed-operation measurements outside adaptive microbenchmark sampling.
const documents = [
  ...createFormatInputs().flatMap((document) => repeatInput(document, 4)),
  ...repeatInput(createTextInputs().small, 4),
];
const concurrency = Number(process.env.BENCH_CONCURRENCY ?? 4);
const iterations = Number(process.env.BENCH_ITERATIONS ?? 10);
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000) {
  throw new Error('BENCH_ITERATIONS must be an integer between 1 and 1000');
}
verifyBatch(await extractBatch(documents, { concurrency }));
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
const elapsed: number[] = [];
const queue: number[] = [];
const processing: number[] = [];
const initialRss = process.memoryUsage().rss;
const start = performance.now();
for (let iteration = 0; iteration < iterations; iteration += 1) {
  const submitted = performance.now();
  const batch = await extractBatch(documents, { concurrency, extraction: { metrics: true } });
  elapsed.push(performance.now() - submitted);
  verifyBatch(batch);
  for (const item of batch.items) {
    if (item.outcome.status !== 'error' && item.outcome.result.metrics) {
      queue.push(item.outcome.result.metrics.queueTimeMs);
      processing.push(item.outcome.result.metrics.processingTimeMs);
    }
  }
}
const wallTimeMs = performance.now() - start;
loop.disable();
function percentile(values: number[], fraction: number): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      concurrency,
      iterations,
      documentsPerBatch: documents.length,
      inputBytesPerBatch: documents.reduce((total, document) => total + document.data.length, 0),
      wallTimeMs,
      documentsPerSecond: (documents.length * iterations * 1000) / wallTimeMs,
      batchLatencyMs: { p50: percentile(elapsed, 0.5), p95: percentile(elapsed, 0.95) },
      queueTimeMs: { p50: percentile(queue, 0.5), p95: percentile(queue, 0.95) },
      processingTimeMs: { p50: percentile(processing, 0.5), p95: percentile(processing, 0.95) },
      eventLoopDelayP95Ms: loop.count > 0 ? loop.percentile(95) / 1e6 : null,
      rssDeltaBytes: process.memoryUsage().rss - initialRss,
      processLifetimeMaxRssBytes: process.resourceUsage().maxRSS * 1024,
    },
    null,
    2,
  ),
);
