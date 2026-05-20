import type { InputDocument } from './common.js';
import { createSimpleDocx } from '../__test__/generators/docx-generator.js';
import { createImageWithSize, createOcrImage } from '../__test__/generators/image-generator.js';
import { createSimplePdf } from '../__test__/generators/pdf-generator.js';
import { createSimplePptx } from '../__test__/generators/pptx-generator.js';
import { createSimpleXlsx } from '../__test__/generators/xlsx-generator.js';
import { computeTextSimilarity, createDocument, extract, runBench } from './common.js';

function createBinaryDocument(name: string, type: string, buffer: Buffer): InputDocument {
  return {
    name,
    size: buffer.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
}

function repeatDocuments(count: number, create: (index: number) => InputDocument): InputDocument[] {
  return Array.from({ length: count }, (_, index) => create(index));
}

const pdfBuffer = createSimplePdf();
const docxBuffer = createSimpleDocx('Optimization benchmark DOCX content. '.repeat(100));
const xlsxBuffer = createSimpleXlsx();
const pptxBuffer = createSimplePptx();
const ocrImageBuffer = createOcrImage();

const hundredPdfBatch = repeatDocuments(100, (index) =>
  createBinaryDocument(`same-type-${index}.pdf`, 'application/pdf', pdfBuffer),
);

const mixedBatch = [
  ...repeatDocuments(25, (index) =>
    createBinaryDocument(`mixed-${index}.pdf`, 'application/pdf', pdfBuffer),
  ),
  ...repeatDocuments(25, (index) =>
    createBinaryDocument(
      `mixed-${index}.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docxBuffer,
    ),
  ),
  ...repeatDocuments(25, (index) =>
    createBinaryDocument(
      `mixed-${index}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xlsxBuffer,
    ),
  ),
  ...repeatDocuments(25, (index) =>
    createBinaryDocument(
      `mixed-${index}.pptx`,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      pptxBuffer,
    ),
  ),
  ...repeatDocuments(25, (index) =>
    createBinaryDocument(`mixed-${index}.jpg`, 'image/jpeg', ocrImageBuffer),
  ),
  ...repeatDocuments(25, (index) =>
    createDocument(`mixed-${index}.txt`, `Mixed text benchmark payload ${index}. `.repeat(1000)),
  ),
];

const mixedImageBatch = [
  ...repeatDocuments(10, (index) =>
    createBinaryDocument(`low-res-${index}.bmp`, 'image/bmp', createImageWithSize(320, 180)),
  ),
  ...repeatDocuments(10, (index) =>
    createBinaryDocument(`ocr-${index}.jpg`, 'image/jpeg', ocrImageBuffer),
  ),
];

const largeSource = [
  'alpha beta gamma delta epsilon zeta eta theta iota kappa',
  'résumé façade coöperate 中文 عربى',
]
  .join(' ')
  .repeat(4000);
const largeSimilar = `${largeSource} tail`;
const largeDifferent = 'omega sigma lambda unrelated payload '.repeat(5000);
const levenshteinSource = largeSource.slice(0, 2000);
const levenshteinSimilar = `${levenshteinSource} tail`;

await runBench(
  'Optimization benchmarks',
  (bench) => {
    bench.add('bench_extract_100_pdfs', () => {
      extract(hundredPdfBatch);
    });

    bench.add('bench_similarity_large_texts_jaccard', () => {
      computeTextSimilarity(largeSource, [largeSimilar, largeDifferent], 30, 'jaccard');
    });

    bench.add('bench_similarity_large_texts_ngram', () => {
      computeTextSimilarity(largeSource, [largeSimilar, largeDifferent], 30, 'ngram');
    });

    bench.add('bench_similarity_large_texts_levenshtein', () => {
      computeTextSimilarity(levenshteinSource, [levenshteinSimilar], 30, 'levenshtein');
    });

    bench.add('bench_similarity_large_texts_hybrid', () => {
      computeTextSimilarity(largeSource, [largeSimilar, largeDifferent], 30, 'hybrid');
    });

    bench.add('bench_ocr_mixed_images', () => {
      extract(mixedImageBatch);
    });

    bench.add('bench_extract_mixed_batch', () => {
      extract(mixedBatch);
    });
  },
  500,
);
