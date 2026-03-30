import { createTextBatches, extract, extractJs, runBench } from './common.js';

const { smallBatch, mediumBatch } = createTextBatches();

await runBench('Text extraction benchmarks', (bench) => {
  bench.add('native extract 10 small text docs', () => {
    extract(smallBatch);
  });

  bench.add('js extract 10 small text docs', () => {
    extractJs(smallBatch);
  });

  bench.add('native extract 100 medium text docs', () => {
    extract(mediumBatch);
  });

  bench.add('js extract 100 medium text docs', () => {
    extractJs(mediumBatch);
  });
});
