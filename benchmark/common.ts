import { Bench } from 'tinybench';
import { createDocxWithTables, createSimpleDocx } from '../__test__/generators/docx-generator.js';
import { createOcrImage } from '../__test__/generators/image-generator.js';
import { createSimplePdf } from '../__test__/generators/pdf-generator.js';
import { createSimplePptx } from '../__test__/generators/pptx-generator.js';
import { createSimpleXlsx } from '../__test__/generators/xlsx-generator.js';
/* oxlint-disable no-console */
import type { ExtractionInput, ExtractionOutcome, BatchResult } from '../index.js';

export function input(name: string, data: Buffer, mimeType: string): ExtractionInput {
  return { name, data, mimeType };
}

export function textInput(name: string, text: string): ExtractionInput {
  return input(name, Buffer.from(text), 'text/plain');
}

export function repeatInput(document: ExtractionInput, count: number): ExtractionInput[] {
  return Array.from({ length: count }, (_, index) => ({ ...document, id: String(index) }));
}

export function createTextInputs() {
  const small = textInput('small.txt', 'Small benchmark payload sentence. '.repeat(5000));
  const medium = textInput(
    'medium.txt',
    'Medium benchmark payload sentence with more words. '.repeat(20000),
  );
  const unicode = textInput('unicode.txt', 'résumé façade 中文 عربى 😀\n'.repeat(20000));
  return { small, medium, unicode, batch: repeatInput(medium, 32) };
}

export function createFormatInputs() {
  return [
    input(
      'paragraphs.docx',
      createSimpleDocx('DOCX benchmark content. '.repeat(100)),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
    input(
      'tables.docx',
      createDocxWithTables(5, 2),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
    input('sample.pdf', createSimplePdf(), 'application/pdf'),
    input(
      'sample.xlsx',
      createSimpleXlsx(),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ),
    input(
      'sample.pptx',
      createSimplePptx(),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ),
  ];
}

export function createImageInput(): ExtractionInput {
  return input('ocr.jpg', createOcrImage(), 'image/jpeg');
}

export function verifyOutcome(outcome: ExtractionOutcome): void {
  switch (outcome.status) {
    case 'success':
      return;
    case 'partial':
      throw new Error(
        `Benchmark extraction was partial: ${outcome.result.warnings.map((warning) => warning.message).join('; ')}`,
      );
    case 'error':
      throw new Error(`Benchmark extraction failed: ${outcome.error.message}`);
    default: {
      const unreachable: never = outcome;
      throw new Error(`Unexpected outcome: ${String(unreachable)}`);
    }
  }
}

export function verifyBatch(batch: BatchResult): void {
  for (const item of batch.items) verifyOutcome(item.outcome);
}

export async function runBench(
  title: string,
  register: (bench: Bench) => void,
  time = 1000,
  iterations = 64,
) {
  const bench = new Bench({ time, iterations, warmupTime: 0, warmupIterations: 1 });
  register(bench);
  await bench.run();
  for (const task of bench.tasks) {
    if (task.result && 'error' in task.result) throw task.result.error;
  }
  console.log(`\n${title}`);
  console.table(bench.table());
}
