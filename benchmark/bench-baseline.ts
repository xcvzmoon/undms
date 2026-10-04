/* oxlint-disable no-console */
import type { ExtractionOutcome } from '../index.js';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { extract, extractBatch } from '../index.js';
import { input, repeatInput, verifyBatch, verifyOutcome } from './common.js';

// Matches the pre-refactor fixture bytes and eight calls, including the first cold call.
const formats = [
  {
    format: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  { format: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  {
    format: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  { format: 'pdf', mimeType: 'application/pdf' },
];
const samples: {
  format: string;
  count?: number;
  bytes: number;
  timesMs: number[];
  output?: ExtractionOutcome;
}[] = [];
for (const { format, mimeType } of formats) {
  const document = input(
    format,
    readFileSync(new URL(`../__test__/documents/${format}.${format}`, import.meta.url)),
    mimeType,
  );
  const timesMs: number[] = [];
  let output: ExtractionOutcome | undefined;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const start = performance.now();
    output = await extract(document);
    timesMs.push(performance.now() - start);
    verifyOutcome(output);
  }
  samples.push({ format, bytes: document.data.length, timesMs, output });
}
const text = input('text', Buffer.from('alpha beta gamma\n'.repeat(200000)), 'text/plain');
for (const count of [1, 10]) {
  const batch = repeatInput(text, count);
  const timesMs: number[] = [];
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const start = performance.now();
    const result = await extractBatch(batch);
    timesMs.push(performance.now() - start);
    verifyBatch(result);
  }
  samples.push({ format: 'text', count, bytes: text.data.length, timesMs });
}
console.log(
  JSON.stringify(
    { node: process.version, platform: process.platform, arch: process.arch, samples },
    null,
    2,
  ),
);
