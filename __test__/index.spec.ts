import { readFileSync } from 'fs';
import { execFileSync } from 'node:child_process';
import test from 'ava';
import * as undms from '../index';
import {
  createCorruptedDocx,
  createEmptyDocx,
  createSimpleDocx,
} from './generators/docx-generator.js';
import {
  createCorruptedImage,
  createMetadataImage,
  createOcrImage,
} from './generators/image-generator.js';
import { createCorruptedPdf, createSimplePdf } from './generators/pdf-generator.js';
import { createCorruptedPptx, createSimplePptx } from './generators/pptx-generator.js';
import { createCorruptedXlsx, createSimpleXlsx } from './generators/xlsx-generator.js';

function makeDocument(content: string, type = 'text/plain', name = 'note.txt') {
  return {
    name,
    size: content.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(content),
  };
}

function makeDocxDocument(
  type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  name = 'document.docx',
) {
  const buffer = createSimpleDocx();
  return {
    name,
    size: buffer.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
}

function makePdfDocument(type = 'application/pdf', name = 'document.pdf') {
  const buffer = createSimplePdf();
  return {
    name,
    size: buffer.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
}

function makePptxDocument(
  type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  name = 'deck.pptx',
) {
  const buffer = createSimplePptx();
  return {
    name,
    size: buffer.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
}

function makeXlsxDocument(
  type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  name = 'sheet.xlsx',
) {
  const buffer = createSimpleXlsx();
  return {
    name,
    size: buffer.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
}

function makeImageDocument(type = 'image/jpeg', name = 'image-ocr.jpg') {
  const buffer = createOcrImage();
  return {
    name,
    size: buffer.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
}

type EsmPackageImportCheck = {
  namespaceExtract: string;
  extract: string;
  computeDocumentSimilarity: string;
  computeTextSimilarity: string;
  content: string;
};

test('extract: returns metadata and text content for supported text mime type', (context) => {
  const content = 'Hello from Rust addon';
  const result = undms.extract([makeDocument(content)]);

  context.is(result.length, 1);
  context.is(result[0].mimeType, 'text/plain');
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].name, 'note.txt');
  context.is(result[0].documents[0].size, content.length);
  context.is(result[0].documents[0].encoding, 'utf-8');
  context.is(result[0].documents[0].content, content);
  context.true(result[0].documents[0].processingTime >= 0);
  context.is(result[0].documents[0].error, undefined);
  context.deepEqual(result[0].documents[0].metadata, {
    text: {
      lineCount: 1,
      wordCount: 4,
      characterCount: content.length,
      nonWhitespaceCharacterCount: 18,
    },
  });
});

test('extract: returns metadata and content for csv files', (context) => {
  const csvBuffer = readFileSync(new URL('./documents/csv.csv', import.meta.url));
  const csvContent = csvBuffer.toString('utf-8');
  const result = undms.extract([
    {
      name: 'sample.csv',
      size: csvBuffer.length,
      type: 'text/csv',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: csvBuffer,
    },
  ]);

  context.is(result.length, 1);
  context.is(result[0].mimeType, 'text/csv');
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].name, 'sample.csv');
  context.is(result[0].documents[0].encoding, 'utf-8');
  context.is(result[0].documents[0].content, csvContent);
  context.true(result[0].documents[0].processingTime >= 0);
  context.is(result[0].documents[0].error, undefined);
  context.truthy(result[0].documents[0].metadata?.text);
});

test('extract: keeps unsupported mime type grouped with empty content', (context) => {
  const result = undms.extract([makeDocument('%PDF-1.4', 'application/x-unknown', 'file.bin')]);

  context.is(result.length, 1);
  context.is(result[0].mimeType, 'application/x-unknown');
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].name, 'file.bin');
  context.is(result[0].documents[0].size, '%PDF-1.4'.length);
  context.is(result[0].documents[0].encoding, 'application/octet-stream');
  context.is(result[0].documents[0].content, '');
  context.true(result[0].documents[0].processingTime >= 0);
  context.is(result[0].documents[0].error, undefined);
  context.is(result[0].documents[0].metadata, undefined);
});

test('extract: whitespace-only content still gets text metadata', (context) => {
  const content = '   \n\t';
  const result = undms.extract([makeDocument(content)]);
  const metadata = result[0].documents[0].metadata?.text;

  context.truthy(metadata);
  context.is(metadata?.lineCount, 2);
  context.is(metadata?.wordCount, 0);
  context.is(metadata?.characterCount, content.length);
  context.is(metadata?.nonWhitespaceCharacterCount, 0);
});

test('extract: groups documents by mime type', (context) => {
  const docs = [
    makeDocument('one', 'text/plain', 'a.txt'),
    makeDocument('two', 'text/plain', 'b.txt'),
    makeDocument('{"a":1}', 'application/json', 'a.json'),
  ];
  const result = undms.extract(docs);
  const textGroup = result.find((group) => group.mimeType === 'text/plain');
  const jsonGroup = result.find((group) => group.mimeType === 'application/json');

  context.truthy(textGroup);
  context.truthy(jsonGroup);
  context.is(textGroup?.documents.length, 2);
  context.is(jsonGroup?.documents.length, 1);
});

test('computeDocumentSimilarity: returns matches and keeps metadata', (context) => {
  const content = 'hello world from undms';
  const result = undms.computeDocumentSimilarity([makeDocument(content)], [content], 90, 'hybrid');

  context.is(result.length, 1);
  context.is(result[0].documents.length, 1);
  context.truthy(result[0].documents[0].metadata?.text);
  context.is(result[0].documents[0].similarityMatches.length, 1);
  context.is(result[0].documents[0].similarityMatches[0].referenceIndex, 0);
});

test('computeDocumentSimilarity: unsupported mime type produces no matches', (context) => {
  const result = undms.computeDocumentSimilarity(
    [makeDocument('%PDF-1.4', 'application/x-unknown', 'file.bin')],
    ['%PDF-1.4'],
    1,
    'hybrid',
  );

  context.is(result.length, 1);
  context.is(result[0].documents[0].similarityMatches.length, 0);
  context.is(result[0].documents[0].metadata, undefined);
});

test('computeDocumentSimilarity: threshold boundary at 100 includes exact match', (context) => {
  const content = 'same exact text';
  const result = undms.computeDocumentSimilarity([makeDocument(content)], [content], 100, 'hybrid');

  context.is(result[0].documents[0].similarityMatches.length, 1);
  context.is(result[0].documents[0].similarityMatches[0].referenceIndex, 0);
});

test('computeTextSimilarity: compares plain text without file processing', (context) => {
  const source = 'alpha beta gamma';
  const references = ['alpha beta gamma', 'different content'];
  const result = undms.computeTextSimilarity(source, references, 90, 'hybrid');

  context.is(result.length, 1);
  context.is(result[0].referenceIndex, 0);
  context.true(result[0].similarityPercentage >= 90);
});

test('computeTextSimilarity: supports all methods', (context) => {
  const source = 'alpha beta gamma';
  const references = ['alpha beta gamma'];
  const methods = ['jaccard', 'ngram', 'levenshtein', 'hybrid'];

  methods.forEach((method) => {
    const result = undms.computeTextSimilarity(source, references, 99, method);

    context.is(result.length, 1);
    context.is(result[0].referenceIndex, 0);
    context.true(result[0].similarityPercentage >= 99);
  });
});

test('computeTextSimilarity: threshold above 100 returns no matches', (context) => {
  const result = undms.computeTextSimilarity('same', ['same'], 100.1, 'hybrid');
  context.is(result.length, 0);
});

test('computeTextSimilarity: metadata influences score beyond pure content', (context) => {
  const source = 'alpha beta gamma';
  const reference = 'alpha   beta\ngamma';
  const result = undms.computeTextSimilarity(source, [reference], 0, 'jaccard');

  context.is(result.length, 1);
  context.true(result[0].similarityPercentage < 100);
  context.true(result[0].similarityPercentage > 90);
});

test('computeTextSimilarity: handles unicode text', (context) => {
  const source = 'こんにちは 世界';
  const references = ['こんにちは 世界', 'hello world'];
  const result = undms.computeTextSimilarity(source, references, 80, 'hybrid');

  context.is(result.length, 1);
  context.is(result[0].referenceIndex, 0);
  context.true(result[0].similarityPercentage >= 80);
});

test('api: legacy processAndCompareFiles is removed', (context) => {
  /* oxlint-disable no-unsafe-type-assertion */
  context.is((undms as { processAndCompareFiles?: unknown }).processAndCompareFiles, undefined);
});

test('extract: returns metadata and text content for docx files', (context) => {
  const result = undms.extract([makeDocxDocument()]);

  context.is(result.length, 1);
  context.is(
    result[0].mimeType,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].name, 'document.docx');
  context.is(result[0].documents[0].encoding, 'utf-8');
  context.true(result[0].documents[0].content.startsWith('Lorem ipsum dolor sit amet'));
  context.true(result[0].documents[0].processingTime >= 0);
  context.is(result[0].documents[0].error, undefined);
  context.truthy(result[0].documents[0].metadata);
  context.truthy(result[0].documents[0].metadata?.text);
  context.is(result[0].documents[0].metadata?.text?.lineCount, 100);
  context.is(result[0].documents[0].metadata?.text?.wordCount, 8733);
  context.truthy(result[0].documents[0].metadata?.docx);
  context.is(result[0].documents[0].metadata?.docx?.paragraphCount, 102);
  context.is(result[0].documents[0].metadata?.docx?.tableCount, 0);
  context.is(result[0].documents[0].metadata?.docx?.imageCount, 0);
  context.is(result[0].documents[0].metadata?.docx?.hyperlinkCount, 0);
});

test('extract: handles docx files with content', (context) => {
  const docxBuffer = createEmptyDocx();
  const result = undms.extract([
    {
      name: 'test.docx',
      size: docxBuffer.length,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: docxBuffer,
    },
  ]);

  context.true(result[0].documents[0].content.startsWith('Lorem ipsum dolor sit amet'));
  context.truthy(result[0].documents[0].metadata);
  context.truthy(result[0].documents[0].metadata?.docx);
  context.is(result[0].documents[0].metadata?.docx?.paragraphCount, 102);
  context.is(result[0].documents[0].metadata?.docx?.tableCount, 0);
  context.is(result[0].documents[0].metadata?.docx?.imageCount, 0);
  context.is(result[0].documents[0].metadata?.docx?.hyperlinkCount, 0);
});

test('extract: returns error for corrupted docx files', (context) => {
  const corruptedBuffer = createCorruptedDocx();
  const result = undms.extract([
    {
      name: 'corrupted.docx',
      size: corruptedBuffer.length,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: corruptedBuffer,
    },
  ]);

  context.is(result[0].documents[0].content, '');
  context.truthy(result[0].documents[0].error);
  context.true(result[0].documents[0].error?.includes('Failed to read DOCX'));
});

test('extract: groups docx documents by mime type', (context) => {
  const docs = [
    makeDocxDocument(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'a.docx',
    ),
    makeDocxDocument(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'b.docx',
    ),
    makeDocument('text content', 'text/plain', 'c.txt'),
  ];
  const result = undms.extract(docs);
  const docxGroup = result.find(
    (group) =>
      group.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  const textGroup = result.find((group) => group.mimeType === 'text/plain');

  context.truthy(docxGroup);
  context.truthy(textGroup);
  context.is(docxGroup?.documents.length, 2);
  context.is(textGroup?.documents.length, 1);
});

test('computeDocumentSimilarity: works with docx documents', (context) => {
  // Extract content first to use as reference
  const extractResult = undms.extract([makeDocxDocument()]);
  const docContent = extractResult[0].documents[0].content;

  const result = undms.computeDocumentSimilarity([makeDocxDocument()], [docContent], 90, 'hybrid');

  context.is(result.length, 1);
  context.is(result[0].documents.length, 1);
  context.truthy(result[0].documents[0].metadata?.text);
  context.truthy(result[0].documents[0].metadata?.docx);
  context.is(result[0].documents[0].similarityMatches.length, 1);
  context.is(result[0].documents[0].similarityMatches[0].referenceIndex, 0);
});

test('extract: returns metadata and text content for pdf files', (context) => {
  const result = undms.extract([makePdfDocument()]);

  context.is(result.length, 1);
  context.is(result[0].mimeType, 'application/pdf');
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].name, 'document.pdf');
  context.is(result[0].documents[0].encoding, 'utf-8');
  context.true(result[0].documents[0].content.includes('Hello PDF'));
  context.true(result[0].documents[0].processingTime >= 0);
  context.is(result[0].documents[0].error, undefined);
  context.truthy(result[0].documents[0].metadata?.text);
  const pdfMetadata = result[0].documents[0].metadata as
    | {
        pdf?: {
          title?: string;
          author?: string;
          subject?: string;
          producer?: string;
          pageSize?: { width: number; height: number };
          pageCount: number;
        };
      }
    | undefined;
  context.truthy(pdfMetadata?.pdf);
  context.true((pdfMetadata?.pdf?.pageCount ?? 0) >= 1);
  if (pdfMetadata?.pdf?.pageSize) {
    context.true(pdfMetadata.pdf.pageSize.width > 0);
    context.true(pdfMetadata.pdf.pageSize.height > 0);
  }
});

test('extract: returns error for corrupted pdf files', (context) => {
  const corruptedBuffer = createCorruptedPdf();
  const result = undms.extract([
    {
      name: 'corrupted.pdf',
      size: corruptedBuffer.length,
      type: 'application/pdf',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: corruptedBuffer,
    },
  ]);

  context.is(result[0].documents[0].content, '');
  context.truthy(result[0].documents[0].error);
  context.true(result[0].documents[0].error?.includes('PDF extraction failed'));
});

test('extract: groups pdf documents by mime type', (context) => {
  const docs = [
    makePdfDocument('application/pdf', 'a.pdf'),
    makePdfDocument('application/pdf', 'b.pdf'),
    makeDocument('text content', 'text/plain', 'c.txt'),
  ];
  const result = undms.extract(docs);
  const pdfGroup = result.find((group) => group.mimeType === 'application/pdf');
  const textGroup = result.find((group) => group.mimeType === 'text/plain');

  context.truthy(pdfGroup);
  context.truthy(textGroup);
  context.is(pdfGroup?.documents.length, 2);
  context.is(textGroup?.documents.length, 1);
});

test('computeDocumentSimilarity: works with pdf documents', (context) => {
  const extractResult = undms.extract([makePdfDocument()]);
  const pdfContent = extractResult[0].documents[0].content;

  const result = undms.computeDocumentSimilarity([makePdfDocument()], [pdfContent], 90, 'hybrid');

  context.is(result.length, 1);
  context.is(result[0].documents.length, 1);
  context.truthy(result[0].documents[0].metadata?.text);
  context.is(result[0].documents[0].similarityMatches.length, 1);
  context.is(result[0].documents[0].similarityMatches[0].referenceIndex, 0);
  const pdfMetadata = result[0].documents[0].metadata as
    | {
        pdf?: {
          title?: string;
          author?: string;
          subject?: string;
          producer?: string;
          pageSize?: { width: number; height: number };
          pageCount: number;
        };
      }
    | undefined;
  context.truthy(pdfMetadata?.pdf);
});

test('extract: returns metadata and text content for pptx files', (context) => {
  const result = undms.extract([makePptxDocument()]);

  context.is(result.length, 1);
  context.is(
    result[0].mimeType,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].name, 'deck.pptx');
  context.is(result[0].documents[0].encoding, 'utf-8');
  context.true(result[0].documents[0].content.includes('HELLO'));
  context.true(result[0].documents[0].content.includes('你好'));
  context.true(result[0].documents[0].processingTime >= 0);
  context.is(result[0].documents[0].error, undefined);
  context.truthy(result[0].documents[0].metadata?.text);
  const pptxMetadata = result[0].documents[0].metadata as
    | {
        pptx?: {
          title?: string;
          author?: string;
          subject?: string;
          slideCount: number;
        };
      }
    | undefined;
  context.truthy(pptxMetadata?.pptx);
  context.is(pptxMetadata?.pptx?.title, 'PptxGenJS Presentation');
  context.is(pptxMetadata?.pptx?.author, 'PptxGenJS');
  context.is(pptxMetadata?.pptx?.subject, 'PptxGenJS Presentation');
  context.is(pptxMetadata?.pptx?.slideCount, 1);
});

test('extract: returns error for corrupted pptx files', (context) => {
  const corruptedBuffer = createCorruptedPptx();
  const result = undms.extract([
    {
      name: 'corrupted.pptx',
      size: corruptedBuffer.length,
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: corruptedBuffer,
    },
  ]);

  context.is(result[0].documents[0].content, '');
  context.truthy(result[0].documents[0].error);
  context.true(result[0].documents[0].error?.includes('Failed to read PPTX'));
});

test('extract: groups pptx documents by mime type', (context) => {
  const docs = [
    makePptxDocument(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'a.pptx',
    ),
    makePptxDocument(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'b.pptx',
    ),
    makeDocument('text content', 'text/plain', 'c.txt'),
  ];
  const result = undms.extract(docs);
  const pptxGroup = result.find(
    (group) =>
      group.mimeType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
  const textGroup = result.find((group) => group.mimeType === 'text/plain');

  context.truthy(pptxGroup);
  context.truthy(textGroup);
  context.is(pptxGroup?.documents.length, 2);
  context.is(textGroup?.documents.length, 1);
});

test('computeDocumentSimilarity: works with pptx documents', (context) => {
  const extractResult = undms.extract([makePptxDocument()]);
  const pptxContent = extractResult[0].documents[0].content;

  const result = undms.computeDocumentSimilarity([makePptxDocument()], [pptxContent], 90, 'hybrid');

  context.is(result.length, 1);
  context.is(result[0].documents.length, 1);
  context.truthy(result[0].documents[0].metadata?.text);
  context.is(result[0].documents[0].similarityMatches.length, 1);
  context.is(result[0].documents[0].similarityMatches[0].referenceIndex, 0);
  const pptxMetadata = result[0].documents[0].metadata as
    | {
        pptx?: {
          slideCount: number;
        };
      }
    | undefined;
  context.truthy(pptxMetadata?.pptx);
  context.is(pptxMetadata?.pptx?.slideCount, 1);
});

test('extract: returns metadata and text content for xlsx files', (context) => {
  const result = undms.extract([makeXlsxDocument()]);

  context.is(result.length, 1);
  context.is(
    result[0].mimeType,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].name, 'sheet.xlsx');
  context.is(result[0].documents[0].encoding, 'utf-8');
  context.true(result[0].documents[0].content.length > 0);
  context.true(result[0].documents[0].content.includes('Sheet:'));
  context.true(result[0].documents[0].processingTime >= 0);
  context.is(result[0].documents[0].error, undefined);
  context.truthy(result[0].documents[0].metadata?.text);
  const xlsxMetadata = result[0].documents[0].metadata as
    | {
        xlsx?: {
          sheetCount: number;
          sheetNames: string[];
          rowCount: number;
          columnCount: number;
          cellCount: number;
        };
      }
    | undefined;
  context.truthy(xlsxMetadata?.xlsx);
  context.true((xlsxMetadata?.xlsx?.sheetCount ?? 0) > 0);
  context.true((xlsxMetadata?.xlsx?.sheetNames.length ?? 0) > 0);
  context.true((xlsxMetadata?.xlsx?.rowCount ?? 0) >= 0);
  context.true((xlsxMetadata?.xlsx?.columnCount ?? 0) >= 0);
  context.true((xlsxMetadata?.xlsx?.cellCount ?? 0) >= 0);
  context.true((result[0].documents[0].metadata?.text?.lineCount ?? 0) > 0);
});

test('extract: returns error for corrupted xlsx files', (context) => {
  const corruptedBuffer = createCorruptedXlsx();
  const result = undms.extract([
    {
      name: 'corrupted.xlsx',
      size: corruptedBuffer.length,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: corruptedBuffer,
    },
  ]);

  context.is(result[0].documents[0].content, '');
  context.truthy(result[0].documents[0].error);
  context.true(result[0].documents[0].error?.includes('Failed to open Excel file'));
});

test('extract: groups xlsx documents by mime type', (context) => {
  const docs = [
    makeXlsxDocument('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'a.xlsx'),
    makeXlsxDocument('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'b.xlsx'),
    makeDocument('text content', 'text/plain', 'c.txt'),
  ];
  const result = undms.extract(docs);
  const xlsxGroup = result.find(
    (group) =>
      group.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const textGroup = result.find((group) => group.mimeType === 'text/plain');

  context.truthy(xlsxGroup);
  context.truthy(textGroup);
  context.is(xlsxGroup?.documents.length, 2);
  context.is(textGroup?.documents.length, 1);
});

test('computeDocumentSimilarity: works with xlsx documents', (context) => {
  const extractResult = undms.extract([makeXlsxDocument()]);
  const sheetContent = extractResult[0].documents[0].content;

  const result = undms.computeDocumentSimilarity(
    [makeXlsxDocument()],
    [sheetContent],
    90,
    'hybrid',
  );

  context.is(result.length, 1);
  context.is(result[0].documents.length, 1);
  context.truthy(result[0].documents[0].metadata?.text);
  context.is(result[0].documents[0].similarityMatches.length, 1);
  context.is(result[0].documents[0].similarityMatches[0].referenceIndex, 0);
  const xlsxMetadata = result[0].documents[0].metadata as
    | {
        xlsx?: {
          sheetCount: number;
          sheetNames: string[];
          rowCount: number;
          columnCount: number;
          cellCount: number;
        };
      }
    | undefined;
  context.truthy(xlsxMetadata?.xlsx);
});

test('extract: returns metadata for image files', (context) => {
  const buffer = createMetadataImage();
  const result = undms.extract([
    {
      name: 'image-metadata.jpeg',
      size: buffer.length,
      type: 'image/jpeg',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  context.is(result.length, 1);
  context.is(result[0].mimeType, 'image/jpeg');
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].encoding, 'utf-8');
  context.is(result[0].documents[0].error, undefined);
  const imageMetadata = result[0].documents[0].metadata as
    | {
        image?: {
          width: number;
          height: number;
          format?: string;
          location: { latitude?: number; longitude?: number };
        };
      }
    | undefined;
  context.truthy(imageMetadata?.image);
  context.true((imageMetadata?.image?.width ?? 0) > 0);
  context.true((imageMetadata?.image?.height ?? 0) > 0);
  context.is(imageMetadata?.image?.format, 'jpeg');
  context.truthy(imageMetadata?.image?.location);
  context.truthy(imageMetadata?.image?.location.latitude);
  context.truthy(imageMetadata?.image?.location.longitude);
});

test('extract: returns error for corrupted image files', (context) => {
  const corruptedBuffer = createCorruptedImage();
  const result = undms.extract([
    {
      name: 'corrupted.bmp',
      size: corruptedBuffer.length,
      type: 'image/bmp',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: corruptedBuffer,
    },
  ]);

  context.is(result[0].documents[0].content, '');
  context.truthy(result[0].documents[0].error);
});

test('extract: groups image documents by mime type', (context) => {
  const docs = [
    makeImageDocument('image/jpeg', 'a.jpg'),
    makeImageDocument('image/jpeg', 'b.jpg'),
    makeDocument('text content', 'text/plain', 'c.txt'),
  ];
  const result = undms.extract(docs);
  const imageGroup = result.find((group) => group.mimeType === 'image/jpeg');
  const textGroup = result.find((group) => group.mimeType === 'text/plain');

  context.truthy(imageGroup);
  context.truthy(textGroup);
  context.is(imageGroup?.documents.length, 2);
  context.is(textGroup?.documents.length, 1);
});

test('extract: returns OCR text for image-ocr.jpg', (context) => {
  const buffer = createOcrImage();
  const result = undms.extract([
    {
      name: 'image-ocr.jpg',
      size: buffer.length,
      type: 'image/jpeg',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  context.is(result.length, 1);
  const content = result[0].documents[0].content;
  context.true(content.length > 0);
});

test('computeDocumentSimilarity: works with image documents', (context) => {
  const result = undms.computeDocumentSimilarity(
    [makeImageDocument()],
    ['reference text'],
    50,
    'hybrid',
  );

  context.is(result.length, 1);
  context.is(result[0].documents.length, 1);
  context.is(result[0].documents[0].similarityMatches.length, 0);
  const imageMetadata = result[0].documents[0].metadata as
    | {
        image?: {
          width: number;
          height: number;
          format?: string;
          location: { latitude?: number; longitude?: number };
        };
      }
    | undefined;
  context.truthy(imageMetadata?.image);
});

test('package exports: supports ESM named imports from the package root', (context) => {
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
        import * as undms from 'undms';
        import { computeDocumentSimilarity, computeTextSimilarity, extract } from 'undms';
        const result = extract([
          {
            name: 'note.txt',
            size: 18,
            type: 'text/plain',
            lastModified: Date.now(),
            webkitRelativePath: '',
            buffer: Buffer.from('esm package import'),
          },
        ]);
        console.log(JSON.stringify({
          namespaceExtract: typeof undms.extract,
          extract: typeof extract,
          computeDocumentSimilarity: typeof computeDocumentSimilarity,
          computeTextSimilarity: typeof computeTextSimilarity,
          content: result[0].documents[0].content,
        }));
      `,
    ],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    },
  );
  const parsed: unknown = JSON.parse(output);
  const result = parsed as EsmPackageImportCheck;

  context.is(result.namespaceExtract, 'function');
  context.is(result.extract, 'function');
  context.is(result.computeDocumentSimilarity, 'function');
  context.is(result.computeTextSimilarity, 'function');
  context.is(result.content, 'esm package import');
});
