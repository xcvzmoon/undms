import { createDocumentFormatBatches, extract, runBench } from './common.js';

const {
  smallDocxBatch,
  mediumDocxBatch,
  smallPdfBatch,
  mediumPdfBatch,
  smallXlsxBatch,
  mediumXlsxBatch,
} = createDocumentFormatBatches();

await runBench('Document format benchmarks', (bench) => {
  bench.add('native extract 10 small docx docs', () => {
    extract(smallDocxBatch);
  });

  bench.add('native extract 50 medium docx docs', () => {
    extract(mediumDocxBatch);
  });

  bench.add('native extract 10 small pdf docs', () => {
    extract(smallPdfBatch);
  });

  bench.add('native extract 50 medium pdf docs', () => {
    extract(mediumPdfBatch);
  });

  bench.add('native extract 10 small xlsx docs', () => {
    extract(smallXlsxBatch);
  });

  bench.add('native extract 50 medium xlsx docs', () => {
    extract(mediumXlsxBatch);
  });
});
