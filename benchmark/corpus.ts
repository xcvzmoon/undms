import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CorpusFormat = 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'image';
export interface CorpusDocument {
  id: string;
  title: string;
  format: CorpusFormat;
  /** Prepared absolute local path; no download occurs during timed extraction. */
  path: string;
  sha256: string;
  bytes: number;
  sourceUrl: string;
  license: string;
  /** Case-insensitive anchors that every successful extraction must contain. */
  expectedText: string[];
  /** Optional human/dataset transcription for OCR error scoring. */
  referenceText?: string;
}
interface ManifestDocument extends Omit<CorpusDocument, 'path' | 'bytes'> {
  path?: string;
  url?: string;
}
const MAX_BYTES = 64 * 1024 * 1024;
const MANIFEST_MAX_BYTES = 1024 * 1024;
const DEFAULT_MANIFEST = fileURLToPath(new URL('./corpus-manifest.json', import.meta.url));
const CACHE = fileURLToPath(new URL('./corpus-cache/', import.meta.url));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFormat(value: unknown): value is CorpusFormat {
  return (
    value === 'docx' || value === 'xlsx' || value === 'pptx' || value === 'pdf' || value === 'image'
  );
}
function nonempty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Corpus ${field} must be a nonempty string`);
  }
  return value;
}
function optionalString(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : nonempty(value, field);
}
function webUrl(value: string, field: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Corpus ${field} must use HTTP or HTTPS`);
  }
  return url.href;
}
function parseDocument(value: unknown): ManifestDocument {
  if (!isRecord(value)) throw new Error('Corpus document must be an object');
  const id = nonempty(value.id, 'id');
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error(`Invalid corpus id: ${id}`);
  const title = nonempty(value.title, 'title');
  const format = value.format;
  if (!isFormat(format)) throw new Error(`Unsupported corpus format for ${id}`);
  const sha256 = nonempty(value.sha256, 'sha256').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`Invalid corpus SHA256 for ${id}`);
  const sourceUrl = webUrl(nonempty(value.sourceUrl, 'sourceUrl'), 'sourceUrl');
  const license = nonempty(value.license, 'license');
  const path = optionalString(value.path, 'path');
  const remote = optionalString(value.url, 'url');
  const url = remote === undefined ? undefined : webUrl(remote, 'url');
  if (path === undefined && url === undefined) throw new Error(`Corpus ${id} needs path or url`);
  if (
    !Array.isArray(value.expectedText) ||
    (value.expectedText.length === 0 && format !== 'image')
  ) {
    throw new Error(`Corpus ${id} needs nonempty expectedText anchors`);
  }
  const expectedText = value.expectedText.map((anchor: unknown) =>
    nonempty(anchor, 'expectedText'),
  );
  const referenceText = optionalString(value.referenceText, 'referenceText');
  if (format === 'image' && referenceText === undefined)
    throw new Error(`OCR corpus ${id} needs referenceText`);
  return { id, title, format, sha256, sourceUrl, license, path, url, expectedText, referenceText };
}
function parseManifest(value: unknown): ManifestDocument[] {
  if (!isRecord(value) || !Array.isArray(value.documents) || value.documents.length === 0) {
    throw new Error('Corpus manifest needs a nonempty documents array');
  }
  const documents = value.documents.map((document: unknown) => parseDocument(document));
  const seen = new Set<string>();
  for (const document of documents) {
    if (seen.has(document.id)) throw new Error(`Duplicate corpus id: ${document.id}`);
    seen.add(document.id);
  }
  return documents;
}
function verifyBytes(bytes: Buffer, document: ManifestDocument): void {
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== document.sha256) {
    throw new Error(
      `Corpus SHA256 mismatch for ${document.id}: expected ${document.sha256}, received ${hash}`,
    );
  }
  if (document.format === 'image') {
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpeg) throw new Error(`OCR corpus ${document.id} needs PNG or JPEG bytes`);
    return;
  }
  const signature = document.format === 'pdf' ? '%PDF-' : 'PK\x03\x04';
  if (!bytes.subarray(0, signature.length).equals(Buffer.from(signature))) {
    throw new Error(`Corpus ${document.id} has no ${document.format} signature`);
  }
}
async function boundedRead(path: string, limit = MAX_BYTES): Promise<Buffer> {
  const details = await stat(path);
  if (!details.isFile() || details.size > limit || details.size === 0) {
    throw new Error(`Corpus file is empty, not a file, or exceeds ${limit} bytes: ${path}`);
  }
  const bytes = await readFile(path);
  if (bytes.length > limit || bytes.length === 0)
    throw new Error(`Corpus file changed size: ${path}`);
  return bytes;
}
async function download(url: string, path: string, document: ManifestDocument): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || response.body === null)
    throw new Error(`Corpus download failed: ${response.status} ${url}`);
  const claimed = Number(response.headers.get('content-length'));
  if (claimed > MAX_BYTES) {
    await response.body.cancel();
    throw new Error(`Corpus download exceeds ${MAX_BYTES} bytes: ${url}`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BYTES) throw new Error(`Corpus download exceeds ${MAX_BYTES} bytes: ${url}`);
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, total);
  verifyBytes(bytes, document);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return bytes;
}
function missing(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

/** Validate/download pinned files before timing. Custom local paths resolve beside the manifest. */
export async function loadCorpus(manifestPath = DEFAULT_MANIFEST): Promise<CorpusDocument[]> {
  const absoluteManifest = resolve(manifestPath);
  const manifest: unknown = JSON.parse(
    (await boundedRead(absoluteManifest, MANIFEST_MAX_BYTES)).toString('utf8'),
  );
  const documents = parseManifest(manifest);
  const prepared: CorpusDocument[] = [];
  for (const document of documents) {
    const path =
      document.path === undefined
        ? resolve(CACHE, `${document.id}-${document.sha256.slice(0, 16)}.${document.format}`)
        : resolve(dirname(absoluteManifest), document.path);
    let bytes: Buffer;
    try {
      bytes = await boundedRead(path);
    } catch (error: unknown) {
      if (!missing(error) || document.url === undefined) throw error;
      bytes = await download(document.url, path, document);
    }
    verifyBytes(bytes, document);
    prepared.push({
      id: document.id,
      title: document.title,
      format: document.format,
      path,
      sha256: document.sha256,
      bytes: bytes.length,
      sourceUrl: document.sourceUrl,
      license: document.license,
      expectedText: document.expectedText,
      referenceText: document.referenceText,
    });
  }
  return prepared;
}
