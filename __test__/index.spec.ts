import type { ExtractionInput, ExtractionOutcome, ExtractionResult } from '../index';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setImmediate as immediate } from 'node:timers/promises';
import test from 'ava';
import * as undms from '../index';
import {
  DecodingPolicy,
  ErrorCode,
  ExtractionSelection,
  OcrMode,
  extract,
  extractBatch,
} from '../index';
import { createSimpleDocx } from './generators/docx-generator.js';
import { createMetadataImage, createOcrImage } from './generators/image-generator.js';
import { createSimplePdf } from './generators/pdf-generator.js';
import { createSimplePptx } from './generators/pptx-generator.js';
import { createSimpleXlsx, createXlsxWithRows } from './generators/xlsx-generator.js';

function textInput(text: string, id = 'note'): ExtractionInput {
  return { data: Buffer.from(text), id, name: `${id}.txt`, mimeType: 'text/plain' };
}
function successful(outcome: ExtractionOutcome): ExtractionResult {
  if (outcome.status !== 'success') throw new Error(`Expected success, received ${outcome.status}`);
  return outcome.result;
}

test.serial('multi-byte input views cannot understate byte limits or reservations', (t) => {
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      `
      const assert = require('node:assert/strict');
      const {extract, extractBatch} = require('./index.js');
      for (const data of [new Uint16Array([0x4141]), new Uint32Array([0x41414141]), new Float64Array([1])]) {
        assert.throws(() => extract({data, mimeType:'text/plain'}, {limits:{maxInputBytes:1}}), /byte view/);
        assert.throws(() => extractBatch([{data}], {maxTotalInputBytes:1}), /byte view/);
      }
      console.log('non-byte views rejected');
    `,
    ],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
  );
  t.is(output.trim(), 'non-byte views rejected');
});

function damagedPagePdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /MediaBox [0 0 612 792] >>',
    '<< /Length 2 >>\nstream\nTf\nendstream',
  ];
  let pdf = '%PDF-1.7\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test.serial(
  'single extraction returns a Promise and reusable source, metadata, and metrics',
  async (t) => {
    const pending = extract(textInput('Hello 世界\nnext line'), { metrics: true });
    t.true(pending instanceof Promise);
    const result = successful(await pending);
    t.is(result.text, 'Hello 世界\nnext line');
    t.is(result.encoding, 'utf-8');
    t.deepEqual(result.source, {
      id: 'note',
      name: 'note.txt',
      byteLength: Buffer.byteLength('Hello 世界\nnext line'),
      declaredMimeType: 'text/plain',
      mimeType: 'text/plain',
      format: 'text',
    });
    t.deepEqual(result.metadata?.statistics, {
      lineCount: 2,
      wordCount: 4,
      characterCount: 18,
      nonWhitespaceCharacterCount: 15,
    });
    t.deepEqual(result.metadata?.format, { kind: 'text' });
    t.deepEqual(result.warnings, []);
    t.true((result.metrics?.queueTimeMs ?? -1) >= 0);
    t.true((result.metrics?.processingTimeMs ?? -1) >= 0);
  },
);

test.serial('CSV preserves content and normalized MIME hints', async (t) => {
  const data = readFileSync(new URL('./documents/csv.csv', import.meta.url));
  const result = successful(await extract({ data, mimeType: 'TEXT/CSV; charset=utf-8' }));
  t.is(result.text, data.toString('utf8'));
  t.is(result.source.mimeType, 'text/csv');
});

test.serial('text and metadata selections omit unrequested work and values', async (t) => {
  const text = successful(
    await extract(textInput('hello world'), { selection: ExtractionSelection.Text }),
  );
  t.is(text.text, 'hello world');
  t.is(text.metadata, undefined);
  t.is(text.metrics, undefined);
  const metadata = successful(
    await extract(textInput('hello world'), { selection: ExtractionSelection.Metadata }),
  );
  t.is(metadata.text, undefined);
  t.is(metadata.metadata?.statistics, undefined);
  const statistics = successful(
    await extract(textInput('hello world'), {
      selection: ExtractionSelection.Metadata,
      statistics: true,
    }),
  );
  t.is(statistics.text, undefined);
  t.is(statistics.metadata?.statistics?.wordCount, 2);
});

test.serial('empty and whitespace text have meaningful statistics', async (t) => {
  const empty = successful(await extract(textInput('')));
  t.is(empty.text, '');
  t.is(empty.metadata?.statistics?.characterCount, 0);
  const whitespace = successful(await extract(textInput('   \n\t')));
  t.is(whitespace.metadata?.statistics?.lineCount, 2);
  t.is(whitespace.metadata?.statistics?.wordCount, 0);
  t.is(whitespace.metadata?.statistics?.nonWhitespaceCharacterCount, 0);
});

test.serial(
  'supported document fixtures return tagged format metadata and extracted text',
  async (t) => {
    const docx = successful(await extract({ data: createSimpleDocx() }));
    t.true(docx.text?.includes('Lorem ipsum') ?? false);
    if (docx.metadata?.format.kind !== 'docx') throw new Error('Expected DOCX metadata');
    t.is(docx.metadata.format.details.paragraphCount, 102);
    const pptx = successful(await extract({ data: createSimplePptx() }));
    t.true(pptx.text?.includes('HELLO') ?? false);
    t.true(pptx.text?.includes('你好') ?? false);
    if (pptx.metadata?.format.kind !== 'pptx') throw new Error('Expected PPTX metadata');
    t.true(pptx.metadata.format.details.slideCount > 0);
    const xlsx = successful(await extract({ data: createSimpleXlsx() }));
    t.true(xlsx.text?.includes('Sheet:') ?? false);
    if (xlsx.metadata?.format.kind !== 'xlsx') throw new Error('Expected XLSX metadata');
    t.true(xlsx.metadata.format.details.sheets.length > 0);
    t.true(xlsx.metadata.format.details.sheets.some((sheet) => sheet.cellCount > 0));
    const pdf = successful(await extract({ data: createSimplePdf() }));
    t.true(pdf.text?.includes('Hello PDF') ?? false);
    if (pdf.metadata?.format.kind !== 'pdf') throw new Error('Expected PDF metadata');
    t.true(pdf.metadata.format.details.pageCount > 0);
  },
);

test.serial('image metadata selection avoids OCR and preserves dimensions and EXIF', async (t) => {
  const result = successful(
    await extract(
      { data: createMetadataImage() },
      {
        selection: ExtractionSelection.Metadata,
        ocr: OcrMode.Disabled,
      },
    ),
  );
  t.is(result.text, undefined);
  if (result.metadata?.format.kind !== 'image') throw new Error('Expected image metadata');
  t.true(result.metadata.format.details.width > 0);
  t.true(result.metadata.format.details.height > 0);
  t.truthy(result.metadata.format.details.cameraMake);
});

test.serial('cold OCR initialization handles simultaneous requests in a fresh process', (t) => {
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      `
      const assert = require('node:assert/strict');
      const {readFileSync} = require('node:fs');
      const {extract, extractBatch} = require('./index.js');
      const image = {data:readFileSync('__test__/documents/image-ocr.jpg'), mimeType:'image/jpeg'};
      Promise.all([
        extract(image, {ocr:'fast'}),
        extractBatch([image, {data:Buffer.from('CPU work'), mimeType:'text/plain'}, image], {concurrency:2, extraction:{ocr:'fast'}})
      ]).then(([single,batch]) => {
        assert.equal(single.status, 'success');
        assert.deepEqual(batch.summary, {successCount:3, partialCount:0, errorCount:0});
        assert.equal(batch.items[0].outcome.result.text, single.result.text);
        assert.equal(batch.items[1].outcome.result.text, 'CPU work');
        console.log('cold concurrency completed');
      }).catch(error => {console.error(error); process.exitCode=1;});
    `,
    ],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 15000 },
  );
  t.is(output.trim(), 'cold concurrency completed');
});

test.serial(
  'concurrent OCR single and mixed batch calls preserve text and input order',
  async (t) => {
    const image = { data: createOcrImage(), id: 'image', mimeType: 'image/jpeg' };
    const [single, batch] = await Promise.all([
      extract(image, { ocr: OcrMode.Fast }),
      extractBatch([image, textInput('CPU work', 'text'), { ...image, id: 'second-image' }], {
        concurrency: 2,
        extraction: { ocr: OcrMode.Fast },
      }),
    ]);
    const result = successful(single);
    t.regex(result.text ?? '', /With fervor burning/);
    t.deepEqual(
      batch.items.map((item) => successful(item.outcome).source.id),
      ['image', 'text', 'second-image'],
    );
    t.is(successful(batch.items[0].outcome).text, result.text);
    t.is(successful(batch.items[1].outcome).text, 'CPU work');
    t.is(successful(batch.items[2].outcome).text, result.text);
    t.deepEqual(batch.summary, { successCount: 3, partialCount: 0, errorCount: 0 });
  },
);

test.serial(
  'unsupported declarations, mismatched signatures, and corrupt documents resolve as errors',
  async (t) => {
    for (const [input, code] of [
      [
        { data: Buffer.from('hello'), mimeType: 'application/unknown' },
        ErrorCode.UnsupportedFormat,
      ],
      [{ data: createSimplePdf(), mimeType: 'text/plain' }, ErrorCode.FormatMismatch],
      [
        { data: Buffer.from('%PDF-1.4\ncorrupt'), mimeType: 'application/pdf' },
        ErrorCode.InvalidDocument,
      ],
      [{ data: Buffer.from('corrupt'), mimeType: 'application/docx' }, ErrorCode.InvalidDocument],
    ] satisfies [ExtractionInput, ErrorCode][]) {
      const outcome = await extract(input);
      if (outcome.status !== 'error') throw new Error(`Expected ${code}`);
      t.is(outcome.error.code, code);
      t.truthy(outcome.error.message);
      t.truthy(outcome.error.stage);
    }
  },
);

test.serial('strict decoding fails invalid UTF-8 and replacement reports a warning', async (t) => {
  const input = { data: Buffer.from([0xff]), mimeType: 'text/plain' };
  const strict = await extract(input, {
    text: { encoding: 'utf-8', decoding: DecodingPolicy.Strict },
  });
  if (strict.status !== 'error') throw new Error('Expected decoding error');
  t.is(strict.error.code, ErrorCode.DecodeFailed);
  const replacement = successful(
    await extract(input, {
      text: { encoding: 'utf-8', decoding: DecodingPolicy.Replace },
    }),
  );
  t.is(replacement.text, '\ufffd');
  t.is(replacement.warnings[0]?.code, 'DECODE_REPLACED');
  t.is(successful(await extract({ data: Buffer.from([0xff, 0xfe, 0x68, 0, 0x69, 0]) })).text, 'hi');
});

test.serial(
  'batch preserves order and duplicate identities and isolates document failures',
  async (t) => {
    const result = await extractBatch(
      [
        textInput('first', 'same'),
        { data: createSimpleDocx(), id: 'docx' },
        { data: Buffer.from('bad'), id: 'failed', mimeType: 'application/unknown' },
        textInput('last', 'same'),
      ],
      { concurrency: 2 },
    );
    t.deepEqual(
      result.items.map((item) => item.index),
      [0, 1, 2, 3],
    );
    t.deepEqual(result.summary, { successCount: 3, partialCount: 0, errorCount: 1 });
    t.is(successful(result.items[0].outcome).text, 'first');
    t.is(successful(result.items[3].outcome).text, 'last');
    t.is(
      successful(result.items[0].outcome).source.id,
      successful(result.items[3].outcome).source.id,
    );
    t.is(result.items[2].outcome.status, 'error');
    t.deepEqual(await extractBatch([]), {
      items: [],
      summary: { successCount: 0, partialCount: 0, errorCount: 0 },
    });
  },
);

test.serial('partial page failure preserves metadata and appears in batch summaries', async (t) => {
  const input = { data: damagedPagePdf() };
  const outcome = await extract(input);
  if (outcome.status !== 'partial') throw new Error(`Expected partial, received ${outcome.status}`);
  t.is(outcome.result.metadata?.format.kind, 'pdf');
  t.is(outcome.result.warnings[0]?.location, 'page:1');
  const batch = await extractBatch([textInput('good'), input]);
  t.deepEqual(batch.summary, { successCount: 1, partialCount: 1, errorCount: 0 });
  const metadata = successful(await extract(input, { selection: ExtractionSelection.Metadata }));
  t.deepEqual(metadata.warnings, []);
});

test.serial('document input and output limits produce error outcomes', async (t) => {
  for (const limits of [{ maxInputBytes: 2 }, { maxOutputBytes: 2 }]) {
    const outcome = await extract(textInput('hello'), { limits });
    if (outcome.status !== 'error') throw new Error('Expected limit error');
    t.is(outcome.error.code, ErrorCode.LimitExceeded);
  }
});

test.serial('invalid options and batch budgets reject requests', async (t) => {
  await t.throwsAsync(async () => extract(textInput('hello'), { limits: { maxInputBytes: -1 } }), {
    message: /maxInputBytes/,
  });
  await t.throwsAsync(
    async () => extract(textInput('hello'), { text: { encoding: 'not-an-encoding' } }),
    { message: /encoding/ },
  );
  await t.throwsAsync(async () => extractBatch([textInput('hello')], { concurrency: 0 }), {
    message: /concurrency/,
  });
  await t.throwsAsync(async () => extractBatch([textInput('hello')], { maxTotalInputBytes: 2 }), {
    message: /maxTotalInputBytes/,
  });
  await t.throwsAsync(
    async () => extractBatch([textInput('one'), textInput('two')], { maxDocuments: 1 }),
    { message: /maxDocuments/ },
  );
  await t.throwsAsync(async () => extractBatch([textInput('hello')], { maxTotalOutputBytes: 2 }), {
    message: /maxTotalOutputBytes/,
  });
});

test.serial('input is snapshotted before the caller mutates its Buffer', async (t) => {
  const data = Buffer.from('original content');
  const pending = extract({ data, mimeType: 'text/plain' });
  data.fill(0x78);
  t.is(successful(await pending).text, 'original content');
});

test.serial('shared-backed buffers reject before worker processing', async (t) => {
  const data = Buffer.from(new SharedArrayBuffer(16));
  await t.throwsAsync(async () => extract({ data, mimeType: 'text/plain' }), {
    message: /shared-backed/,
  });
});

test.serial(
  'shared backing rejection cannot be bypassed by shadowing the buffer property',
  async (t) => {
    const data = Buffer.from(new SharedArrayBuffer(16));
    Object.defineProperty(data, 'buffer', { value: new ArrayBuffer(16) });
    await t.throwsAsync(async () => extract({ data, mimeType: 'text/plain' }), {
      message: /shared-backed/,
    });
  },
);

test.serial('snapshots remain valid after forced garbage collection', (t) => {
  const output = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      '--input-type=module',
      '--eval',
      `
    import { extract, ExtractionSelection } from 'undms';
    let data=Buffer.alloc(4*1024*1024, 0x61);
    const pending=extract({data,mimeType:'text/plain'}, {selection:ExtractionSelection.Text});
    data=undefined;
    for (let i=0;i<5;i++) global.gc();
    const outcome=await pending;
    if (outcome.status!=='success') throw new Error(outcome.status);
    console.log(outcome.result.text.length, outcome.result.text[0], outcome.result.text.at(-1));
  `,
    ],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
  );
  t.is(output.trim(), '4194304 a a');
});

test.serial(
  'reentrant getters reject detached captured buffers without dereferencing stale bytes',
  (t) => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
    import { extract, extractBatch } from 'undms';
    const expectDetached=async invoke => {
      try { await invoke(); throw new Error('detached input accepted'); }
      catch(error) { if(!/detached/.test(error.message)) throw error; }
    };
    let data=Buffer.alloc(16, 0x61);
    await expectDetached(() => extract({data, get name(){structuredClone(data.buffer,{transfer:[data.buffer]});return 'detached';}}));
    data=Buffer.alloc(16, 0x61);
    await expectDetached(() => extract({data}, {get metrics(){structuredClone(data.buffer,{transfer:[data.buffer]});return true;}}));
    data=Buffer.alloc(16, 0x61);
    await expectDetached(() => extractBatch([{data}, {data:Buffer.from('second'), get name(){structuredClone(data.buffer,{transfer:[data.buffer]});return 'second';}}]));
    console.log('detached rejected');
  `,
      ],
      { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
    );
    t.is(output.trim(), 'detached rejected');
  },
);

test.serial(
  'reentrant property replacement preserves the originally captured view and measured size',
  async (t) => {
    const data = Buffer.alloc(16, 0x61);
    const input = {
      data,
      get name() {
        input.data = Buffer.from('replacement');
        return 'captured';
      },
    };
    const result = successful(await extract(input));
    t.is(result.text, 'a'.repeat(16));
    t.is(result.source.byteLength, 16);
  },
);

test.serial('option getters cannot bypass canonical shared backing validation', async (t) => {
  const data = Buffer.from(new SharedArrayBuffer(16));
  await t.throwsAsync(
    async () =>
      extract(
        { data },
        {
          get metrics() {
            Object.defineProperty(data, 'buffer', { value: new ArrayBuffer(1) });
            return true;
          },
        },
      ),
    { message: /shared-backed/ },
  );
});

test.serial('invalid getter-provided budgets reject safely for shared-backed input', async (t) => {
  const data = Buffer.from(new SharedArrayBuffer(16));
  await t.throwsAsync(
    async () =>
      extract(
        { data },
        {
          limits: {
            get maxInputBytes() {
              Object.defineProperty(data, 'buffer', { value: new ArrayBuffer(1) });
              return -1;
            },
          },
        },
      ),
    { message: /maxInputBytes/ },
  );
  t.is(successful(await extract(textInput('after invalid getter'))).text, 'after invalid getter');
});

test.serial(
  'actual XLSX inflation is bounded even when every ZIP entry declares one byte',
  async (t) => {
    const data = Buffer.from(createSimpleXlsx());
    const end = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) throw new Error('Fixture ZIP directory not found');
    const count = data.readUInt16LE(end + 10);
    let central = data.readUInt32LE(end + 16);
    for (let index = 0; index < count; index += 1) {
      if (data.readUInt32LE(central) !== 0x02014b50) throw new Error('Invalid fixture ZIP entry');
      const local = data.readUInt32LE(central + 42);
      data.writeUInt32LE(1, central + 24);
      data.writeUInt32LE(1, local + 22);
      central +=
        46 +
        data.readUInt16LE(central + 28) +
        data.readUInt16LE(central + 30) +
        data.readUInt16LE(central + 32);
    }
    const outcome = await extract({ data }, { limits: { maxDecompressedBytes: 100 } });
    if (outcome.status !== 'error') throw new Error('Expected inflation limit error');
    t.is(outcome.error.code, ErrorCode.LimitExceeded);
  },
);

test.serial('the event loop advances while a substantial spreadsheet extracts', async (t) => {
  const data = createXlsxWithRows(30000, 4);
  let completed = false;
  const pending = extract({ data }, { selection: ExtractionSelection.Text }).then((outcome) => {
    completed = true;
    return outcome;
  });
  await immediate();
  t.false(completed);
  t.true(successful(await pending).text?.includes('R30000C4') ?? false);
});

test.serial('admission rejects overload and releases reservations after completion', async (t) => {
  const pending: Promise<ExtractionOutcome>[] = [];
  let overloaded = 0;
  for (let index = 0; index < 40; index += 1) {
    try {
      pending.push(extract(textInput('capacity')));
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('OVERLOADED')) throw error;
      overloaded += 1;
    }
  }
  t.true(overloaded > 0);
  await Promise.all(pending);
  t.is(successful(await extract(textInput('after overload'))).text, 'after overload');
});

test.serial(
  'both package entry points expose only extraction and preserve named ESM imports',
  (t) => {
    t.false('computeTextSimilarity' in undms);
    t.false('computeDocumentSimilarity' in undms);
    for (const module of ['commonjs', 'module']) {
      const script =
        module === 'module'
          ? `import { extract, extractBatch } from 'undms'; const result = await extract({data: Buffer.from('package import')}); console.log(result.status === 'success' ? result.result.text : result.status); console.log(typeof extractBatch);`
          : `const {extract, extractBatch} = require('undms'); extract({data: Buffer.from('package import')}).then(result => {console.log(result.status === 'success' ? result.result.text : result.status); console.log(typeof extractBatch);});`;
      const output = execFileSync(process.execPath, [`--input-type=${module}`, '--eval', script], {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
      });
      t.is(output.trim(), 'package import\nfunction');
    }
  },
);
