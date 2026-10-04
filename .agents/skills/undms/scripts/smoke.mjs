// Run in a Node.js project with the current undms package installed.
import assert from 'node:assert/strict';
import { DecodingPolicy, ExtractionSelection, extract, extractBatch } from 'undms';

const textInput = { data: Buffer.from('hello undms'), mimeType: 'text/plain' };
const successful = await extract(textInput);
assert.equal(successful.status, 'success');
assert.equal(successful.result.text, 'hello undms');

const encodedInput = { data: Buffer.from([0x63, 0x61, 0x66, 0xe9]), name: 'cafe.txt' };
const decoding = { text: { encoding: 'windows-1252', decoding: DecodingPolicy.Strict } };
const unidentified = await extract(encodedInput, decoding);
assert.equal(unidentified.status, 'error');
assert.equal(unidentified.error.code, 'UNSUPPORTED_FORMAT');
const decoded = await extract({ ...encodedInput, mimeType: 'text/plain' }, decoding);
assert.equal(decoded.status, 'success');
assert.equal(decoded.result.text, 'café');

const isInvalidArgument = (error) => error instanceof Error && error.code === 'InvalidArg';
for (const concurrency of [0, 33]) {
  // Validation throws synchronously, before returning a Promise.
  assert.throws(() => extractBatch([textInput], { concurrency }), isInvalidArgument);
}
for (const concurrency of [1, 32]) {
  const batch = await extractBatch([textInput], { concurrency });
  assert.equal(batch.summary.successCount, 1);
}
assert.throws(
  () => extract(textInput, { selection: ExtractionSelection.Text, statistics: true }),
  isInvalidArgument,
);

const mixed = await extractBatch(
  [
    { ...textInput, id: 'duplicate' },
    { data: Buffer.from('not a PDF'), mimeType: 'application/pdf', id: 'duplicate' },
  ],
  { concurrency: 2 },
);
assert.deepEqual(mixed.items.map(({ index }) => index), [0, 1]);
assert.deepEqual(mixed.summary, { successCount: 1, partialCount: 0, errorCount: 1 });
assert.equal(mixed.items[0].outcome.result.source.id, 'duplicate');
assert.equal(mixed.items[1].outcome.source.id, 'duplicate');

console.log('Passed: extraction, encoded-text detection, synchronous validation, batch boundaries and order.');
