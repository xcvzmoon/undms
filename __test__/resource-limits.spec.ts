import test from 'ava';
import type { ResourceLimits } from '../index';
import {
  ErrorCode,
  ExtractionSelection,
  extract,
  extractBatch,
  getResourceLimitRanges,
} from '../index';
import { createMetadataImage } from './generators/image-generator.js';
import { createSimpleXlsx } from './generators/xlsx-generator.js';

const MiB = 1024 * 1024;

test.serial(
  'larger bounded budgets are accepted and their inclusive ceilings are enforced',
  async (t) => {
    for (const limits of [{ maxOutputBytes: 256 * MiB }, { maxDecompressedBytes: 2048 * MiB }]) {
      t.is((await extract({ data: Buffer.from('hello') }, { limits })).status, 'success');
    }
    for (const limits of [
      { maxOutputBytes: 256 * MiB + 1 },
      { maxDecompressedBytes: 2048 * MiB + 1 },
    ]) {
      await t.throwsAsync(async () => extract({ data: Buffer.from('hello') }, { limits }), {
        code: 'InvalidArg',
      });
    }
  },
);

test.serial(
  'the issue #2 text fixture succeeds with an explicit larger output budget',
  async (t) => {
    const data = Buffer.from('a,b\n'.repeat(16 * MiB + 1));
    const limited = await extract(
      { data, name: 'large.csv' },
      {
        limits: { maxInputBytes: 200_000_000, maxOutputBytes: 64 * MiB },
      },
    );
    if (limited.status !== 'error') throw new Error('Expected output limit error');
    t.deepEqual(limited.error, {
      code: ErrorCode.LimitExceeded,
      message: 'decoded text exceeds maxOutputBytes',
      stage: 'limits',
      limitName: 'maxOutputBytes',
      configuredLimit: 64 * MiB,
      observedBytes: data.length,
    });
    const outcome = await extract(
      { data, name: 'large.csv' },
      {
        selection: ExtractionSelection.Text,
        limits: { maxInputBytes: 200_000_000, maxOutputBytes: 128 * MiB },
      },
    );
    if (outcome.status !== 'success') throw new Error('Expected large text success');
    t.is(outcome.result.text?.length, data.length);
    t.is(outcome.result.text, data.toString());
  },
);

test.serial('every published range accepts its maximum and rejects invalid integers', async (t) => {
  const ranges = getResourceLimitRanges();
  const names: (keyof ResourceLimits)[] = [
    'maxInputBytes',
    'maxOutputBytes',
    'maxDecompressedBytes',
    'maxArchiveEntries',
    'maxImagePixels',
    'maxWarnings',
  ];
  t.deepEqual(Object.keys(ranges).toSorted(), names.toSorted());
  for (const name of names) {
    const range = ranges[name];
    t.is(range.minimum, 1);
    const defaults = await extract({ data: Buffer.from('hello') });
    t.is(defaults.status, 'success');
    for (const value of [range.minimum, range.maximum, range.defaultValue]) {
      const limits: ResourceLimits = { [name]: value };
      // One-byte output is valid configuration even though the result cannot fit.
      await t.notThrowsAsync(async () => extract({ data: Buffer.from('hello') }, { limits }));
    }
    for (const value of [
      0,
      -1,
      0.5,
      range.maximum + 1,
      NaN,
      Infinity,
      -Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await t.throwsAsync(
        async () => extract({ data: Buffer.from('hello') }, { limits: { [name]: value } }),
        {
          code: 'InvalidArg',
          message: new RegExp(name),
        },
      );
    }
  }
  t.deepEqual(ranges.maxOutputBytes, { minimum: 1, maximum: 256 * MiB, defaultValue: 16 * MiB });
  t.deepEqual(ranges.maxDecompressedBytes, {
    minimum: 1,
    maximum: 2048 * MiB,
    defaultValue: 128 * MiB,
  });
  ranges.maxOutputBytes.maximum = 1;
  t.is(getResourceLimitRanges().maxOutputBytes.maximum, 256 * MiB);
});

test.serial(
  'input and incremental UTF-8 expansion expose structured limit measurements',
  async (t) => {
    const input = await extract({ data: Buffer.from('hello') }, { limits: { maxInputBytes: 4 } });
    if (input.status !== 'error') throw new Error('Expected input limit error');
    t.is(input.error.limitName, 'maxInputBytes');
    t.is(input.error.configuredLimit, 4);
    t.is(input.error.observedBytes, 5);
    const decoded = await extract(
      { data: Buffer.from([0x80, 0x80, 0x80, 0x80]), mimeType: 'text/plain' },
      {
        text: { encoding: 'windows-1252' },
        limits: { maxOutputBytes: 10 },
      },
    );
    if (decoded.status !== 'error') throw new Error('Expected decoded output limit error');
    t.is(decoded.error.limitName, 'maxOutputBytes');
    t.is(decoded.error.configuredLimit, 10);
    t.is(decoded.error.observedAtLeastBytes, 12);
    t.is(decoded.error.observedBytes, undefined);
  },
);

test.serial(
  'larger budgets retain scheduler admission and release reservations after rejection',
  async (t) => {
    await t.throwsAsync(
      async () =>
        extractBatch([{ data: Buffer.from('hello') }], {
          concurrency: 4,
          maxTotalOutputBytes: 256 * MiB,
          extraction: { limits: { maxOutputBytes: 256 * MiB } },
        }),
      { message: /OVERLOADED/ },
    );
    t.is(
      (await extract({ data: Buffer.from('hello') }, { limits: { maxOutputBytes: 256 * MiB } }))
        .status,
      'success',
    );
    const batch = await extractBatch([{ data: Buffer.from('hello') }], {
      concurrency: 1,
      maxTotalOutputBytes: 16 * MiB,
      extraction: { limits: { maxOutputBytes: 256 * MiB } },
    });
    t.is(batch.summary.successCount, 1);
  },
);

test.serial(
  'sequential completion handoffs do not retain the previous worker reservation',
  async (t) => {
    // Together these reservations exceed 512 MiB. Each request must release
    // its reservation before the next awaited request is admitted.
    for (let index = 0; index < 10_000; index += 1) {
      const batch = await extractBatch([{ data: Buffer.from('hello') }], {
        concurrency: 1,
        maxTotalOutputBytes: 16 * MiB,
        extraction: { limits: { maxOutputBytes: 256 * MiB } },
      });
      t.is(batch.summary.successCount, 1);
      const single = await extract(
        { data: Buffer.from('hello') },
        { limits: { maxOutputBytes: 256 * MiB } },
      );
      t.is(single.status, 'success');
    }
  },
);

test.serial(
  'archive expansion, entry count, and image pixels identify their configured limits',
  async (t) => {
    const archive = await extract(
      { data: createSimpleXlsx() },
      { limits: { maxDecompressedBytes: 100 } },
    );
    if (archive.status !== 'error') throw new Error('Expected archive inflation failure');
    t.is(archive.error.code, ErrorCode.LimitExceeded);
    t.is(archive.error.limitName, 'maxDecompressedBytes');
    t.is(archive.error.configuredLimit, 100);
    t.is(archive.error.observedAtLeastBytes, 101);
    const entries = await extract(
      { data: createSimpleXlsx() },
      { limits: { maxArchiveEntries: 1 } },
    );
    if (entries.status !== 'error') throw new Error('Expected archive entry count failure');
    t.is(entries.error.limitName, 'maxArchiveEntries');
    t.is(entries.error.configuredLimit, 1);
    t.true((entries.error.observedValue ?? 0) > 1);
    const image = await extract({ data: createMetadataImage() }, { limits: { maxImagePixels: 1 } });
    if (image.status !== 'error') throw new Error('Expected image pixel failure');
    t.is(image.error.limitName, 'maxImagePixels');
    t.is(image.error.configuredLimit, 1);
    t.true((image.error.observedValue ?? 0) > 1);
  },
);

test.serial(
  'final result accounting reports its estimate and preserves original document errors',
  async (t) => {
    const result = await extract(
      { data: Buffer.from('hello') },
      { limits: { maxOutputBytes: 300 } },
    );
    if (result.status !== 'error') throw new Error('Expected estimated result size limit error');
    t.is(result.error.message, 'result exceeds maxOutputBytes');
    t.is(result.error.limitName, 'maxOutputBytes');
    t.is(result.error.configuredLimit, 300);
    t.true((result.error.observedAtLeastBytes ?? 0) > 300);
    const original = await extract(
      { data: Buffer.from('hello') },
      { limits: { maxInputBytes: 4, maxOutputBytes: 1 } },
    );
    if (original.status !== 'error') throw new Error('Expected original input size limit error');
    t.is(original.error.limitName, 'maxInputBytes');
    t.is(original.error.observedBytes, 5);
  },
);
