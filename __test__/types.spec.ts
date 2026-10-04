import type { ExtractionOutcome, FormatMetadata } from '../index';
import test from 'ava';
import { DocumentFormat, ErrorCode, extract } from '../index';

function exhaustive(value: never): never {
  throw new Error(`Unexpected variant: ${String(value)}`);
}

function formatDescription(format: FormatMetadata): string {
  switch (format.kind) {
    case 'text':
      return 'text';
    case 'docx':
      return `paragraphs:${format.details.paragraphCount}`;
    case 'xlsx':
      return `sheets:${format.details.sheets.length}`;
    case 'pptx':
      return `slides:${format.details.slideCount}`;
    case 'pdf':
      return `pages:${format.details.pageCount}`;
    case 'image':
      return `pixels:${format.details.width * format.details.height}`;
    default:
      return exhaustive(format);
  }
}

function outcomeDescription(outcome: ExtractionOutcome): string {
  switch (outcome.status) {
    case 'success':
    case 'partial':
      return outcome.result.metadata
        ? formatDescription(outcome.result.metadata.format)
        : 'no metadata';
    case 'error':
      return outcome.error.code;
    default:
      return exhaustive(outcome);
  }
}

test('generated outcomes and format metadata support exhaustive TypeScript narrowing', async (t) => {
  const pending: Promise<ExtractionOutcome> = extract({ data: Buffer.from('typed') });
  t.is(outcomeDescription(await pending), 'text');
  const outcome = await pending;
  if (outcome.status === 'error') throw new Error(outcome.error.message);
  const format: DocumentFormat | undefined = outcome.result.source.format;
  t.is(format, DocumentFormat.Text);
  const failed = await extract({ data: Buffer.from('text'), mimeType: 'application/unknown' });
  if (failed.status !== 'error') throw new Error('Expected unsupported format');
  const code: ErrorCode = failed.error.code;
  t.is(code, ErrorCode.UnsupportedFormat);
});
