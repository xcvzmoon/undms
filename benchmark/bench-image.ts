import { createImageBatches, extract, runBench } from './common.js';

const { smallImageBatch, mediumImageBatch } = createImageBatches();

await runBench(
  'Image extraction benchmarks',
  (bench) => {
    bench.add('native extract 10 small image docs', () => {
      extract(smallImageBatch);
    });

    bench.add('native extract 50 medium image docs', () => {
      extract(mediumImageBatch);
    });
  },
  500,
);
