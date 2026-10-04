import { extract, extractBatch, ExtractionSelection } from '../index.js';
import { createFormatInputs, repeatInput, runBench, verifyBatch, verifyOutcome } from './common.js';

const documents = createFormatInputs();
const fixtures = documents.map((document) => ({ document, batch: repeatInput(document, 16) }));
await runBench('Document formats: single, batch, and metadata', (bench) => {
  for (const { document, batch } of fixtures) {
    bench.add(`${document.name}: single`, async () => {
      verifyOutcome(await extract(document));
    });
    bench.add(`${document.name}: metadata only`, async () => {
      verifyOutcome(await extract(document, { selection: ExtractionSelection.Metadata }));
    });
    bench.add(`${document.name}: batch of 16`, async () => {
      verifyBatch(await extractBatch(batch));
    });
  }
});
