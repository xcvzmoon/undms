import { extractBatch, ExtractionSelection } from '../index.js';
import {
  createFormatInputs,
  createTextInputs,
  repeatInput,
  runBench,
  verifyBatch,
} from './common.js';

const formats = createFormatInputs();
const { small, batch: textBatch } = createTextInputs();
const mixedBatch = [
  ...formats.flatMap((document) => repeatInput(document, 8)),
  ...repeatInput(small, 8),
];
await runBench(
  'Batch scheduling: identical workloads across concurrency and selection',
  (bench) => {
    for (const concurrency of [1, 2, 4, 8]) {
      bench.add(`mixed 48 documents, concurrency ${concurrency}`, async () => {
        verifyBatch(await extractBatch(mixedBatch, { concurrency }));
      });
      bench.add(`text 32 documents, concurrency ${concurrency}`, async () => {
        verifyBatch(await extractBatch(textBatch, { concurrency }));
      });
      bench.add(`mixed metadata only, concurrency ${concurrency}`, async () => {
        verifyBatch(
          await extractBatch(mixedBatch, {
            concurrency,
            extraction: { selection: ExtractionSelection.Metadata },
          }),
        );
      });
    }
  },
);
