/* oxlint-disable no-console */
import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { extract, extractBatch, ExtractionSelection, OcrMode } from '../index.js';
import { createImageInput, repeatInput, runBench, verifyBatch, verifyOutcome } from './common.js';

const document = createImageInput();
if (process.argv.includes('--cold')) {
  const start = performance.now();
  verifyOutcome(await extract(document, { ocr: OcrMode.Fast }));
  console.log(
    `Cold OCR first extraction (model initialization included): ${(performance.now() - start).toFixed(2)} ms`,
  );
} else {
  const cold = await promisify(execFile)(process.execPath, [
    ...process.execArgv,
    fileURLToPath(import.meta.url),
    '--cold',
  ]);
  console.log(cold.stdout.trim());
  // Explicit warm-up keeps model initialization out of steady-state comparisons.
  verifyOutcome(await extract(document, { ocr: OcrMode.Fast }));
  const batch = repeatInput(document, 4);
  await runBench(
    'Warm OCR: sequential candidate policies and metadata',
    (bench) => {
      for (const ocr of [OcrMode.Fast, OcrMode.Balanced, OcrMode.Accurate]) {
        bench.add(`warm single OCR: ${ocr}`, async () => {
          verifyOutcome(await extract(document, { ocr }));
        });
      }
      bench.add('metadata only: no OCR', async () => {
        verifyOutcome(await extract(document, { selection: ExtractionSelection.Metadata }));
      });
      bench.add('warm OCR batch of 4', async () => {
        verifyBatch(await extractBatch(batch, { extraction: { ocr: OcrMode.Fast } }));
      });
    },
    0,
    8,
  );
}
