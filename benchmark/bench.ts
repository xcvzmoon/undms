/* oxlint-disable no-console */
import { Bench } from 'tinybench';
import { createDocxWithTables, createSimpleDocx } from '../__test__/generators/docx-generator.js';
import { createImageWithSize } from '../__test__/generators/image-generator.js';
import { createSimplePdf } from '../__test__/generators/pdf-generator.js';
import { createSimpleXlsx } from '../__test__/generators/xlsx-generator.js';
import { extract } from '../index.js';

type InputDocument = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: Buffer;
};

type OutputDocumentMetadata = {
  name: string;
  size: number;
  processingTime: number;
  encoding: string;
  content: string;
  metadata?: {
    text?: {
      lineCount: number;
      wordCount: number;
      characterCount: number;
      nonWhitespaceCharacterCount: number;
    };
  };
  error?: string;
};

type OutputGroupedDocuments = {
  mimeType: string;
  documents: OutputDocumentMetadata[];
};

function isSupportedTextMimeType(mimeType: string): boolean {
  if (mimeType.startsWith('text/')) {
    return true;
  }

  return (
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/typescript' ||
    mimeType === 'application/x-javascript' ||
    mimeType === 'application/xhtml+xml' ||
    mimeType === 'application/ld+json'
  );
}

function countTextMetadata(content: string) {
  let lineCount = 1;
  let wordCount = 0;
  let characterCount = 0;
  let nonWhitespaceCharacterCount = 0;
  let inWord = false;

  for (const character of content) {
    characterCount += 1;
    if (character === '\n') {
      lineCount += 1;
    }

    const isWhitespace = /\s/.test(character);
    if (!isWhitespace) {
      nonWhitespaceCharacterCount += 1;
      if (!inWord) {
        wordCount += 1;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }

  return {
    lineCount,
    wordCount,
    characterCount,
    nonWhitespaceCharacterCount,
  };
}

function extractJs(documents: InputDocument[]): OutputGroupedDocuments[] {
  const grouped = new Map<string, OutputDocumentMetadata[]>();

  for (const document of documents) {
    const metadataList = grouped.get(document.type) ?? [];
    let content = '';
    let encoding = 'application/octet-stream';

    if (isSupportedTextMimeType(document.type)) {
      content = document.buffer.toString('utf-8');
      encoding = 'utf-8';
    }

    const metadata = content
      ? {
          text: countTextMetadata(content),
        }
      : undefined;

    metadataList.push({
      name: document.name,
      size: document.buffer.length,
      processingTime: 0,
      encoding,
      content,
      metadata,
      error: undefined,
    });

    grouped.set(document.type, metadataList);
  }

  return Array.from(grouped.entries(), ([mimeType, docs]) => ({
    mimeType,
    documents: docs,
  }));
}

function createDocument(name: string, content: string, type = 'text/plain'): InputDocument {
  const buffer = Buffer.from(content, 'utf-8');
  return {
    name,
    size: buffer.length,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
}

const smallPayload = 'Small benchmark payload sentence. '.repeat(5000);
const smallBatch = Array.from({ length: 10 }, (_, index) =>
  createDocument(`small-${index}.txt`, `${smallPayload}${index}`),
);

const mediumPayload = 'Medium benchmark payload sentence with more words. '.repeat(20000);
const mediumBatch = Array.from({ length: 100 }, (_, index) =>
  createDocument(`medium-${index}.txt`, `${mediumPayload}${index}`),
);

const smallDocxContent = 'Small DOCX benchmark content. '.repeat(100);
const smallDocxBatch = Array.from({ length: 10 }, (_, index) => {
  const buffer = createSimpleDocx(`${smallDocxContent}${index}`);
  return {
    name: `small-${index}.docx`,
    size: buffer.length,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const mediumDocxBatch = Array.from({ length: 50 }, (_, index) => {
  const buffer = createDocxWithTables(5, 2);
  return {
    name: `medium-${index}.docx`,
    size: buffer.length,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const smallImageBatch = Array.from({ length: 10 }, (_, index) => {
  const buffer = createImageWithSize(64, 64);
  return {
    name: `small-${index}.bmp`,
    size: buffer.length,
    type: 'image/bmp',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const mediumImageBatch = Array.from({ length: 50 }, (_, index) => {
  const buffer = createImageWithSize(256, 256);
  return {
    name: `medium-${index}.bmp`,
    size: buffer.length,
    type: 'image/bmp',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const smallPdfBatch = Array.from({ length: 10 }, (_, index) => {
  const buffer = createSimplePdf();
  return {
    name: `small-${index}.pdf`,
    size: buffer.length,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const mediumPdfBatch = Array.from({ length: 50 }, (_, index) => {
  const buffer = createSimplePdf();
  return {
    name: `medium-${index}.pdf`,
    size: buffer.length,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const smallXlsxBatch = Array.from({ length: 10 }, (_, index) => {
  const buffer = createSimpleXlsx();
  return {
    name: `small-${index}.xlsx`,
    size: buffer.length,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const mediumXlsxBatch = Array.from({ length: 50 }, (_, index) => {
  const buffer = createSimpleXlsx();
  return {
    name: `medium-${index}.xlsx`,
    size: buffer.length,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  };
});

const bench = new Bench({ time: 1_000 });

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

bench.add('native extract 10 small docx docs', () => {
  extract(smallDocxBatch);
});

bench.add('native extract 50 medium docx docs', () => {
  extract(mediumDocxBatch);
});

bench.add('native extract 10 small image docs', () => {
  extract(smallImageBatch);
});

bench.add('native extract 50 medium image docs', () => {
  extract(mediumImageBatch);
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

await bench.run();

console.table(bench.table());
