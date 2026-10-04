import { extract, extractBatch, ExtractionSelection } from '../index.js';
import { createTextInputs, runBench, verifyBatch, verifyOutcome } from './common.js';
const { small, medium, unicode, batch } = createTextInputs();
await runBench('Prepared text inputs: completed async extraction', (bench) => {
  for (const document of [small, medium, unicode]) {
    bench.add(`single ${document.name}: text and statistics`, async () =>
      verifyOutcome(await extract(document)),
    );
    bench.add(`single ${document.name}: text only`, async () =>
      verifyOutcome(await extract(document, { selection: ExtractionSelection.Text })),
    );
  }
  bench.add('batch: 32 medium documents', async () => verifyBatch(await extractBatch(batch)));
});
