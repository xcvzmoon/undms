import {
  computeDocumentSimilarity,
  computeTextSimilarity,
  createSimilarityInputs,
  runBench,
} from './common.js';

const { source, referenceTexts, exactReferenceTexts, documents } = createSimilarityInputs();

await runBench('Similarity benchmarks', (bench) => {
  bench.add('computeTextSimilarity hybrid', () => {
    computeTextSimilarity(source, exactReferenceTexts, 50, 'hybrid');
  });

  bench.add('computeTextSimilarity ngram', () => {
    computeTextSimilarity(source, exactReferenceTexts, 50, 'ngram');
  });

  bench.add('computeDocumentSimilarity hybrid', () => {
    computeDocumentSimilarity(documents, referenceTexts, 50, 'hybrid');
  });
});
