/* oxlint-disable no-console */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cpus, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setImmediate as immediate, setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Bench } from 'tinybench';
import type { BatchOptions, ExtractionOptions, ExtractionInput } from '../index.js';
import type { CorpusDocument } from './corpus.js';
import { loadCorpus } from './corpus.js';
import { ocrQuality, prepareTesseractModel, tesseractAdapter } from './ocr.js';
import type { Report, Sample, Workload } from './package-report.js';
import { compactTerminal, writePackageReport } from './package-report.js';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const script = fileURLToPath(import.meta.url);
const versions = {
  officeparser: '8.1.0',
  mammoth: '1.13.0',
  'pdf-parse': '2.4.5',
  'tesseract.js': '7.0.0',
};
const cache = join(root, 'node_modules', '.cache', 'undms-package-benchmark');
const packages = new Set(['undms', 'officeparser', 'mammoth', 'pdf-parse', 'tesseract.js']);
interface Prepared {
  config: Report['config'];
  corpus: CorpusDocument[];
  workloads: Workload[];
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function numbers(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every(finite);
}
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item: unknown) => typeof item === 'string')
  );
}
function corpusDocument(value: unknown): value is CorpusDocument {
  return (
    object(value) &&
    ['id', 'title', 'format', 'path', 'sha256', 'sourceUrl', 'license'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    ['docx', 'xlsx', 'pptx', 'pdf', 'image'].includes(String(value.format)) &&
    finite(value.bytes) &&
    (strings(value.expectedText) ||
      (value.format === 'image' &&
        Array.isArray(value.expectedText) &&
        value.expectedText.length === 0)) &&
    (value.format !== 'image' || typeof value.referenceText === 'string')
  );
}
function workload(value: unknown): value is Workload {
  return (
    object(value) &&
    ['id', 'label', 'format'].every((key) => typeof value[key] === 'string') &&
    (value.mode === 'single' || value.mode === 'batch') &&
    strings(value.documentIds) &&
    strings(value.packages)
  );
}
function prepared(value: unknown): value is Prepared {
  if (!object(value) || !object(value.config)) return false;
  const config = value.config;
  return (
    ['rounds', 'durationMs', 'resourceDurationMs', 'concurrency'].every((key) =>
      finite(config[key]),
    ) &&
    (config.ocrMode === undefined ||
      (typeof config.ocrMode === 'string' &&
        ['fast', 'balanced', 'accurate'].includes(config.ocrMode))) &&
    Array.isArray(value.corpus) &&
    value.corpus.every(corpusDocument) &&
    Array.isArray(value.workloads) &&
    value.workloads.every(workload)
  );
}
function sample(value: unknown): value is Sample {
  if (!object(value) || !object(value.resource)) return false;
  const resource = value.resource;
  return (
    (value.quality === undefined ||
      (Array.isArray(value.quality) &&
        value.quality.every(
          (item: unknown) =>
            object(item) &&
            typeof item.documentId === 'string' &&
            ['characterEdits', 'referenceCharacters', 'wordEdits', 'referenceWords'].every((key) =>
              finite(item[key]),
            ) &&
            Number(item.referenceCharacters) > 0 &&
            Number(item.referenceWords) > 0,
        ))) &&
    (value.cleanup === undefined ||
      (object(value.cleanup) &&
        finite(value.cleanup.durationMs) &&
        finite(value.cleanup.rssMiB) &&
        typeof value.cleanup.description === 'string')) &&
    ['package', 'workload', 'textHash', 'normalizedHash'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    ['round', 'coldMs', 'loadMs'].every((key) => finite(value[key])) &&
    numbers(value.latencyMs) &&
    numbers(value.textLengths) &&
    [
      'wallMs',
      'userMs',
      'systemMs',
      'calls',
      'documents',
      'cpuPercent',
      'machineCpuPercent',
      'documentsPerSecond',
      'peakRssMiB',
      'rssAfterGcMiB',
      'heapAfterGcMiB',
      'idleCpuPercent',
    ].every((key) => finite(resource[key])) &&
    Array.isArray(resource.series) &&
    resource.series.length > 0 &&
    resource.series.every(
      (point: unknown) =>
        object(point) &&
        finite(point.elapsedMs) &&
        finite(point.cpuPercent) &&
        finite(point.rssMiB),
    )
  );
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
interface NativeApi {
  ExtractionSelection: { Text: NonNullable<ExtractionOptions['selection']> };
  OcrMode: {
    Disabled: NonNullable<ExtractionOptions['ocr']>;
    Fast: NonNullable<ExtractionOptions['ocr']>;
    Balanced: NonNullable<ExtractionOptions['ocr']>;
    Accurate: NonNullable<ExtractionOptions['ocr']>;
  };
  extract(input: ExtractionInput, options: ExtractionOptions): Promise<unknown>;
  extractBatch(inputs: ExtractionInput[], options: BatchOptions): Promise<unknown>;
}
function nativeApi(value: unknown): value is NativeApi {
  return (
    object(value) &&
    typeof value.extract === 'function' &&
    typeof value.extractBatch === 'function' &&
    object(value.ExtractionSelection) &&
    value.ExtractionSelection.Text === 'text' &&
    object(value.OcrMode) &&
    value.OcrMode.Disabled === 'disabled' &&
    value.OcrMode.Fast === 'fast' &&
    value.OcrMode.Balanced === 'balanced' &&
    value.OcrMode.Accurate === 'accurate'
  );
}
interface OfficeApi {
  parseOffice(data: Buffer, options: { fileType: string; ocr: boolean }): Promise<unknown>;
}
function officeApi(value: unknown): value is OfficeApi {
  return object(value) && typeof value.parseOffice === 'function';
}
interface Ast {
  to(format: string): Promise<unknown>;
}
function ast(value: unknown): value is Ast {
  return object(value) && typeof value.to === 'function';
}
interface MammothApi {
  extractRawText(input: { buffer: Buffer }): Promise<unknown>;
}
function mammothApi(value: unknown): value is MammothApi {
  return object(value) && typeof value.extractRawText === 'function';
}
interface Pdf {
  getText(): Promise<unknown>;
  destroy(): Promise<void>;
}
interface PdfApi {
  PDFParse: new (options: { data: Buffer }) => Pdf;
}
function pdfApi(value: unknown): value is PdfApi {
  return object(value) && typeof value.PDFParse === 'function';
}
function stringField(value: unknown, key: string): string {
  if (!object(value) || typeof value[key] !== 'string') throw new Error(`Missing ${key} text`);
  return value[key];
}
function nativeText(value: unknown): string {
  if (!object(value) || value.status !== 'success' || !object(value.result))
    throw new Error('Unsuccessful undms extraction');
  return stringField(value.result, 'text');
}
function hash(texts: string[]): string {
  const digest = createHash('sha256');
  for (const text of texts)
    digest
      .update(String(Buffer.byteLength(text)))
      .update(':')
      .update(text);
  return digest.digest('hex');
}
function validate(value: unknown, count: number): string[] {
  if (!Array.isArray(value) || value.length !== count) throw new Error('Output count mismatch');
  const texts: string[] = [];
  for (const text of value) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty/invalid extraction');
    texts.push(text);
  }
  return texts;
}
async function bounded(
  count: number,
  concurrency: number,
  extract: (index: number) => Promise<string>,
): Promise<string[]> {
  const outputs = Array.from({ length: count }, () => '');
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(count, concurrency) }, async () => {
      while (next < count) {
        const index = next++;
        outputs[index] = await extract(index);
      }
    }),
  );
  return outputs;
}
async function worker() {
  const [, , , name, id, roundArg, preparedPath] = process.argv;
  if (!name || !packages.has(name) || !preparedPath) throw new Error('Invalid worker arguments');
  const parsed: unknown = JSON.parse(await readFile(preparedPath, 'utf8'));
  if (!prepared(parsed)) throw new Error('Invalid prepared corpus/configuration');
  const work = parsed.workloads.find((value) => value.id === id);
  if (!work || !work.packages.includes(name)) throw new Error('Unsupported workload/package');
  const documents = await Promise.all(
    work.documentIds.map(async (documentId) => {
      const document = parsed.corpus.find((value) => value.id === documentId);
      if (!document) throw new Error('Missing corpus document');
      const data = await readFile(document.path);
      if (createHash('sha256').update(data).digest('hex') !== document.sha256)
        throw new Error('Corpus hash mismatch');
      return { ...document, data };
    }),
  );
  const documentAt = (index: number) => {
    const document = documents[index];
    if (!document) throw new Error('Missing input document');
    return document;
  };
  const count = documents.length;
  const loadStart = performance.now();
  const require = createRequire(join(cache, 'package.json'));
  const api: unknown = require(name === 'undms' ? join(root, 'index.js') : name);
  const loadMs = performance.now() - loadStart;
  const concurrency = parsed.config.concurrency;
  let invoke: () => Promise<unknown>;
  let terminate: (() => Promise<void>) | undefined;
  if (name === 'undms' && nativeApi(api)) {
    const inputs = documents.map((document) => ({
      data: document.data,
      name: `${document.id}.${document.format === 'image' ? (document.data[0] === 137 ? 'png' : 'jpg') : document.format}`,
    }));
    const extraction: ExtractionOptions = {
      selection: api.ExtractionSelection.Text,
      statistics: false,
      ocr:
        work.format === 'image'
          ? {
              fast: api.OcrMode.Fast,
              balanced: api.OcrMode.Balanced,
              accurate: api.OcrMode.Accurate,
            }[parsed.config.ocrMode ?? 'balanced']
          : api.OcrMode.Disabled,
    };
    invoke =
      work.mode === 'single'
        ? async () => [nativeText(await api.extract(inputs[0], extraction))]
        : async () => {
            const result = await api.extractBatch(inputs, { extraction, concurrency });
            if (!object(result) || !Array.isArray(result.items))
              throw new Error('Invalid batch output');
            return result.items.map((item: unknown, index: number) => {
              if (!object(item) || item.index !== index) throw new Error('Batch ordering mismatch');
              return nativeText(item.outcome);
            });
          };
  } else if (name === 'tesseract.js') {
    const model = await prepareTesseractModel(cache);
    const adapter = tesseractAdapter(
      api,
      documents.map((document) => document.data),
      concurrency,
      model.languagePath,
    );
    invoke = async () => adapter.invoke();
    terminate = async () => adapter.terminate();
  } else if (name === 'officeparser' && officeApi(api)) {
    invoke = async () =>
      bounded(count, concurrency, async (index) => {
        const document = documentAt(index);
        const parsedAst = await api.parseOffice(document.data, {
          fileType: document.format,
          ocr: false,
        });
        if (!ast(parsedAst)) throw new Error('Invalid officeparser AST');
        return stringField(await parsedAst.to('text'), 'value');
      });
  } else if (name === 'mammoth' && mammothApi(api)) {
    invoke = async () =>
      bounded(count, concurrency, async (index) =>
        stringField(await api.extractRawText({ buffer: documentAt(index).data }), 'value'),
      );
  } else if (name === 'pdf-parse' && pdfApi(api)) {
    invoke = async () =>
      bounded(count, concurrency, async (index) => {
        const parser = new api.PDFParse({ data: Buffer.from(documentAt(index).data) });
        try {
          return stringField(await parser.getText(), 'text');
        } finally {
          await parser.destroy();
        }
      });
  } else throw new Error('Unexpected package API');
  try {
    const coldStart = performance.now();
    const firstResult = await invoke();
    const coldMs = performance.now() - coldStart;
    const first = validate(firstResult, count);
    for (let index = 0; index < count; index++) {
      const normalized = first[index].toLowerCase().replace(/\s+/gu, ' ');
      for (const anchor of documentAt(index).expectedText) {
        if (!normalized.includes(anchor.toLowerCase().replace(/\s+/gu, ' ')))
          throw new Error(`Missing expected content in ${documentAt(index).id}: ${anchor}`);
      }
    }
    let last: unknown;
    const bench = new Bench({
      time: parsed.config.durationMs,
      iterations: 10,
      warmupTime: 300,
      warmupIterations: 3,
      retainSamples: true,
      throws: true,
    });
    bench.add('extraction', async () => {
      last = await invoke();
    });
    await bench.run();
    const result = bench.tasks[0]?.result;
    if (result?.state !== 'completed' || !result.latency.samples)
      throw new Error('Tinybench did not complete');
    if (hash(validate(last, count)) !== hash(first))
      throw new Error('Text changed during timed sampling');
    const latencyMs = [...result.latency.samples];
    globalThis.gc?.();
    const series: Sample['resource']['series'] = [];
    const resourceStart = performance.now();
    const cpuStart = process.cpuUsage();
    let previousTime = resourceStart;
    let previousCpu = cpuStart;
    const collect = () => {
      const now = performance.now();
      const cpu = process.cpuUsage();
      const elapsed = now - previousTime;
      if (elapsed > 0)
        series.push({
          elapsedMs: now - resourceStart,
          cpuPercent:
            ((cpu.user - previousCpu.user + cpu.system - previousCpu.system) / 1000 / elapsed) *
            100,
          rssMiB: process.memoryUsage().rss / 1048576,
        });
      previousTime = now;
      previousCpu = cpu;
    };
    const interval = setInterval(collect, 100);
    let calls = 0;
    try {
      do {
        last = await invoke();
        calls++;
        await immediate();
      } while (performance.now() - resourceStart < parsed.config.resourceDurationMs);
    } finally {
      clearInterval(interval);
    }
    const cpu = process.cpuUsage(cpuStart);
    const wallMs = performance.now() - resourceStart;
    collect();
    if (hash(validate(last, count)) !== hash(first))
      throw new Error('Text changed during sustained processing');
    for (const document of documents)
      if (createHash('sha256').update(document.data).digest('hex') !== document.sha256)
        throw new Error('Parser mutated input bytes');
    globalThis.gc?.();
    const memory = process.memoryUsage();
    let cleanup: Sample['cleanup'];
    if (terminate) {
      const start = performance.now();
      await terminate();
      globalThis.gc?.();
      cleanup = {
        durationMs: performance.now() - start,
        rssMiB: process.memoryUsage().rss / 1048576,
        description:
          'Terminate reused Tesseract.js workers; native OCR models remain cached until process exit',
      };
    }
    const quality = documents.flatMap((document, index) =>
      document.referenceText
        ? [{ documentId: document.id, ...ocrQuality(document.referenceText, first[index]) }]
        : [],
    );
    await delay(200);
    const idleStart = performance.now();
    const idleCpuStart = process.cpuUsage();
    await delay(300);
    const idleCpu = process.cpuUsage(idleCpuStart);
    const idleCpuPercent =
      ((idleCpu.user + idleCpu.system) / 1000 / (performance.now() - idleStart)) * 100;
    const cpuPercent = ((cpu.user + cpu.system) / 1000 / wallMs) * 100;
    const value: Sample = {
      quality: quality.length ? quality : undefined,
      cleanup,
      package: name,
      workload: work.id,
      round: Number(roundArg),
      latencyMs,
      coldMs,
      loadMs,
      textHash: hash(first),
      normalizedHash: hash(first.map((text) => text.trim().replace(/\s+/gu, ' '))),
      textLengths: first.map((text) => text.length),
      resource: {
        wallMs,
        userMs: cpu.user / 1000,
        systemMs: cpu.system / 1000,
        calls,
        documents: calls * count,
        cpuPercent,
        machineCpuPercent: cpuPercent / cpus().length,
        documentsPerSecond: (calls * count * 1000) / wallMs,
        peakRssMiB: process.resourceUsage().maxRSS / 1024,
        rssAfterGcMiB: memory.rss / 1048576,
        heapAfterGcMiB: memory.heapUsed / 1048576,
        idleCpuPercent,
        series,
      },
    };
    console.log(JSON.stringify({ sample: value, texts: first }));
  } finally {
    await terminate?.();
  }
}
function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing --${name} value`);
  return value;
}
function integer(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(option(name, String(fallback)));
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`--${name} must be ${minimum}–${maximum}`);
  return value;
}
async function installPackages() {
  await mkdir(cache, { recursive: true });
  const installed = await Promise.all(
    Object.entries(versions).map(async ([name, version]) => {
      try {
        const manifest: unknown = JSON.parse(
          await readFile(join(cache, 'node_modules', name, 'package.json'), 'utf8'),
        );
        return object(manifest) && manifest.version === version;
      } catch {
        return false;
      }
    }),
  );
  if (installed.every(Boolean)) return;
  await writeFile(
    join(cache, 'package.json'),
    `${JSON.stringify({ private: true, dependencies: versions }, null, 2)}\n`,
  );
  const executable = process.env.npm_execpath;
  if (!executable) throw new Error('Run using pnpm bench:packages');
  const isScript = /\.[cm]?js$/.test(executable);
  await execute(
    isScript ? process.execPath : executable,
    [...(isScript ? [executable] : []), 'install', '--ignore-scripts', '--lockfile=false'],
    { cwd: cache, timeout: 180000, env: { ...process.env, CI: 'true' } },
  );
}
function supported(format: string): string[] {
  if (format === 'image') return ['undms', 'tesseract.js'];
  return [
    'undms',
    'officeparser',
    ...(format === 'docx' ? ['mammoth'] : format === 'pdf' ? ['pdf-parse'] : []),
  ];
}
async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'pnpm bench:packages [--corpus manifest.json] [--duration 1000] [--resource-duration 2000] [--rounds 3] [--concurrency 4] [--only docx|xlsx|pptx|pdf|image] [--images] [--ocr-mode fast|balanced|accurate] [--output DIRECTORY]',
    );
    return;
  }
  for (const removed of ['iterations', 'warmups'])
    if (process.argv.includes(`--${removed}`))
      throw new Error(`--${removed} was replaced by time-based --duration sampling`);
  const ocrMode = option('ocr-mode', 'balanced');
  if (ocrMode !== 'fast' && ocrMode !== 'balanced' && ocrMode !== 'accurate')
    throw new Error('Invalid --ocr-mode');
  const config: Report['config'] = {
    ocrMode,
    rounds: integer('rounds', 3, 1, 20),
    durationMs: integer('duration', 1000, 100, 60000),
    resourceDurationMs: integer('resource-duration', 2000, 500, 60000),
    concurrency: integer('concurrency', 4, 1, 32),
  };
  const only = option('only', '');
  if (only && !['docx', 'xlsx', 'pptx', 'pdf', 'image'].includes(only))
    throw new Error('Unknown --only format');
  console.log('Preparing real-document corpus and isolated package versions…');
  const imageManifest = fileURLToPath(new URL('./image-corpus-manifest.json', import.meta.url));
  const custom = option('corpus', '');
  const loaded = await loadCorpus(custom || (only === 'image' ? imageManifest : undefined));
  if (!custom && only !== 'image' && process.argv.includes('--images'))
    loaded.push(...(await loadCorpus(imageManifest)));
  const corpus = loaded.filter((document) => !only || document.format === only);
  if (!corpus.length) throw new Error('Corpus has no selected documents');
  await installPackages();
  if (corpus.some((document) => document.format === 'image'))
    config.tesseractModelSha256 = (await prepareTesseractModel(cache)).sha256;
  const workloads: Workload[] = corpus.map((document) => ({
    id: `single-${document.id}`,
    label: document.title,
    format: document.format,
    mode: 'single',
    documentIds: [document.id],
    packages: supported(document.format),
  }));
  for (const format of ['docx', 'xlsx', 'pptx', 'pdf', 'image']) {
    const selected = corpus.filter((document) => document.format === format);
    if (selected.length >= 2)
      workloads.push({
        id: `batch-${format}`,
        label: `${format.toUpperCase()} inbox (${selected.length} unique documents)`,
        format,
        mode: 'batch',
        documentIds: selected.map((document) => document.id),
        packages: supported(format),
      });
  }
  const mixed = corpus.filter((document) => document.format !== 'image');
  if (new Set(mixed.map((document) => document.format)).size > 1)
    workloads.push({
      id: 'batch-mixed',
      label: `Mixed inbox (${mixed.length} unique documents)`,
      format: 'mixed',
      mode: 'batch',
      documentIds: mixed.map((document) => document.id),
      packages: supported('mixed'),
    });
  const timestamp = new Date().toISOString();
  const directory = resolve(
    option('output', join(root, 'benchmark', 'results', `real-${timestamp.replace(/[:.]/g, '-')}`)),
  );
  await mkdir(directory, { recursive: true });
  await mkdir(join(directory, 'extracted-text'), { recursive: true });
  const preparedPath = join(directory, 'prepared.json');
  await writeFile(preparedPath, JSON.stringify({ config, corpus, workloads }));
  const [git, status] = await Promise.all([
    execute('git', ['rev-parse', 'HEAD'], { cwd: root }),
    execute('git', ['status', '--porcelain'], { cwd: root }),
  ]);
  const samples: Sample[] = [];
  const failures: Report['failures'] = [];
  const total = workloads.reduce((sum, work) => sum + work.packages.length * config.rounds, 0);
  let completed = 0;
  console.log(
    `Tinybench · ${corpus.length} real documents · ${workloads.length} workloads · ${total} isolated process runs`,
  );
  for (const work of workloads)
    for (let round = 0; round < config.rounds; round++) {
      const order = work.packages
        .slice(round % work.packages.length)
        .concat(work.packages.slice(0, round % work.packages.length));
      for (const name of order) {
        if (process.stdout.isTTY)
          process.stdout.write(
            `\r[${completed + 1}/${total}] ${work.id} · ${name} · round ${round + 1}                    `,
          );
        else console.log(`[${completed + 1}/${total}] ${work.id} · ${name} · round ${round + 1}`);
        try {
          const { stdout } = await execute(
            process.execPath,
            [
              ...process.execArgv,
              '--expose-gc',
              script,
              '--worker',
              name,
              work.id,
              String(round),
              preparedPath,
            ],
            { cwd: root, timeout: 300000, maxBuffer: 32 * 1024 * 1024 },
          );
          const value: unknown = JSON.parse(stdout.trim().split('\n').at(-1) ?? '');
          if (
            !object(value) ||
            !sample(value.sample) ||
            !strings(value.texts) ||
            value.sample.package !== name ||
            value.sample.workload !== work.id ||
            value.sample.round !== round ||
            value.texts.length !== work.documentIds.length ||
            value.sample.textLengths.length !== work.documentIds.length
          )
            throw new Error('Invalid worker report');
          samples.push(value.sample);
          if (round === 0)
            for (let index = 0; index < value.texts.length; index++)
              await writeFile(
                join(directory, 'extracted-text', `${name}-${work.id}-${index}.txt`),
                value.texts[index],
              );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push({ package: name, workload: work.id, round, error: message });
          console.error(`\nFailed ${name} / ${work.id}: ${message.slice(0, 300)}`);
        }
        completed++;
      }
    }
  if (process.stdout.isTTY) process.stdout.write('\n');
  const tinybenchManifest: unknown = JSON.parse(
    await readFile(join(root, 'node_modules', 'tinybench', 'package.json'), 'utf8'),
  );
  if (!object(tinybenchManifest) || typeof tinybenchManifest.version !== 'string')
    throw new Error('Missing Tinybench version');
  const report: Report = {
    timestamp,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    hardware: {
      cpuModel: cpus()[0]?.model ?? 'Unknown',
      logicalCpus: cpus().length,
      memoryBytes: totalmem(),
    },
    versions: { ...versions, tinybench: tinybenchManifest.version, undms: 'workspace' },
    workspace: { commit: git.stdout.trim(), dirty: status.stdout.length > 0 },
    config,
    corpus,
    workloads,
    samples,
    failures,
  };
  await writePackageReport(report, directory);
  console.log(compactTerminal(report));
  console.log(
    `\nREADME-ready report: ${join(directory, 'README.md')}\nDetails and raw samples: ${join(directory, 'report.md')} and results.json`,
  );
  if (failures.length) process.exitCode = 1;
}
try {
  if (process.argv[2] === '--worker') await worker();
  else await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
