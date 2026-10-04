/* oxlint-disable no-console */
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { extract, extractBatch, OcrMode } from '../index.js';
import {
  createFormatInputs,
  createImageInput,
  input,
  repeatInput,
  verifyBatch,
  verifyOutcome,
} from './common.js';

const document = input('large.txt', Buffer.from('alpha beta gamma\n'.repeat(60000)), 'text/plain');
const documents = repeatInput(document, 8);
const options = {
  concurrency: 4,
  maxTotalOutputBytes: 16 * 1024 * 1024,
  extraction: { metrics: true, limits: { maxOutputBytes: 4 * 1024 * 1024 } },
};
verifyBatch(await extractBatch(documents, options));
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
const initialRss = process.memoryUsage().rss;
const rounds: number[] = [];
const singleLatency: number[] = [];
const queue: number[] = [];
const start = performance.now();
for (let iteration = 0; iteration < 10; iteration += 1) {
  const submitted = performance.now();
  const batches = Array.from({ length: 3 }, () => extractBatch(documents, options));
  const singleStart = performance.now();
  const single = extract(document, options.extraction).then((outcome) => {
    singleLatency.push(performance.now() - singleStart);
    verifyOutcome(outcome);
  });
  const results = await Promise.all(batches);
  await single;
  rounds.push(performance.now() - submitted);
  for (const batch of results) {
    verifyBatch(batch);
    for (const item of batch.items) {
      if (item.outcome.status !== 'error' && item.outcome.result.metrics) {
        queue.push(item.outcome.result.metrics.queueTimeMs);
      }
    }
  }
}
const wallTimeMs = performance.now() - start;
loop.disable();
const rssAfterTextBytes = process.memoryUsage().rss;
const heapAfterTextBytes = process.memoryUsage().heapUsed;
const forcedGcAvailable = typeof globalThis.gc === 'function';
globalThis.gc?.();
const rssAfterGcBytes = process.memoryUsage().rss;
const heapAfterGcBytes = process.memoryUsage().heapUsed;
const cpuInputs = createFormatInputs().flatMap((source) => repeatInput(source, 4));
let ocrCompleted = false;
const ocr = extractBatch(repeatInput(createImageInput(), 4), {
  extraction: { ocr: OcrMode.Fast },
}).then((result) => {
  ocrCompleted = true;
  verifyBatch(result);
});
const cpuStart = performance.now();
verifyBatch(await extractBatch(cpuInputs));
const cpuWhileOcrMs = performance.now() - cpuStart;
const cpuCompletedBeforeOcr = !ocrCompleted;
await ocr;
function percentiles(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      iterations: 10,
      concurrentBatches: 3,
      documentsPerBatch: documents.length,
      singleRequestsPerRound: 1,
      bytesPerDocument: document.data.length,
      wallTimeMs,
      documentsPerSecond: (250 * 1000) / wallTimeMs,
      roundLatencyMs: percentiles(rounds),
      singleLatencyMs: percentiles(singleLatency),
      queueTimeMs: percentiles(queue),
      eventLoopDelayP95Ms: loop.count > 0 ? loop.percentile(95) / 1e6 : null,
      initialRssBytes: initialRss,
      rssAfterTextBytes,
      heapAfterTextBytes,
      forcedGcAvailable,
      rssAfterGcBytes,
      heapAfterGcBytes,
      rssAfterOcrBytes: process.memoryUsage().rss,
      processLifetimeMaxRssBytes: process.resourceUsage().maxRSS * 1024,
      cpuWhileOcr: { documents: cpuInputs.length, cpuWhileOcrMs, cpuCompletedBeforeOcr },
    },
    null,
    2,
  ),
);
