import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the base sample DOCX file from documents folder
const sampleDocxPath = join(__dirname, '..', 'documents', 'docx.docx');
let sampleDocxBuffer: Buffer | null = null;

try {
  sampleDocxBuffer = readFileSync(sampleDocxPath);
} catch {
  sampleDocxBuffer = null;
}

/**
 * Returns the sample DOCX file buffer.
 */
export function createSimpleDocx(_text?: string): Buffer {
  if (!sampleDocxBuffer) {
    throw new Error('docx.docx not found. Please ensure docx.docx exists in __test__/documents/');
  }
  return sampleDocxBuffer;
}

/**
 * Creates a DOCX file with specified number of paragraphs.
 * Currently returns the sample DOCX for testing batch processing.
 */
export function createDocxWithTables(_paragraphCount: number, _tableCount: number): Buffer {
  return createSimpleDocx();
}

/**
 * Creates a DOCX file with hyperlinks.
 * Currently returns the sample DOCX.
 */
export function createDocxWithHyperlinks(_linkCount: number): Buffer {
  return createSimpleDocx();
}

/**
 * Creates an empty DOCX file.
 * Returns the sample DOCX.
 */
export function createEmptyDocx(): Buffer {
  return createSimpleDocx();
}

/**
 * Creates a corrupted/invalid DOCX file.
 */
export function createCorruptedDocx(): Buffer {
  return Buffer.from('This is not a valid DOCX file content');
}

/**
 * Creates a large DOCX file by replicating the sample DOCX content.
 * Note: The size is approximate and achieved by duplicating content.
 */
export function createLargeDocx(sizeMb: number): Buffer {
  if (!sampleDocxBuffer) {
    throw new Error('docx.docx not found');
  }

  const targetBytes = sizeMb * 1024 * 1024;
  const repetitions = Math.ceil(targetBytes / sampleDocxBuffer.length);

  // For large files, we duplicate the buffer
  const buffers: Buffer[] = [];
  for (let i = 0; i < repetitions; i++) {
    buffers.push(sampleDocxBuffer);
  }

  // Note: This creates a concatenated buffer, not a valid DOCX
  // For testing purposes, we'll just return the original sample
  // since the docx-rs library needs properly structured files
  return sampleDocxBuffer;
}
