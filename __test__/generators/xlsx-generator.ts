import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sampleXlsxPath = join(__dirname, '..', 'documents', 'xlsx.xlsx');
let sampleXlsxBuffer: Buffer | null = null;

try {
  sampleXlsxBuffer = readFileSync(sampleXlsxPath);
} catch {
  sampleXlsxBuffer = null;
}

export function createSimpleXlsx(): Buffer {
  if (!sampleXlsxBuffer) {
    throw new Error('xlsx.xlsx not found. Please ensure xlsx.xlsx exists in __test__/documents/');
  }

  return sampleXlsxBuffer;
}

export function createCorruptedXlsx(): Buffer {
  return Buffer.from('This is not a valid XLSX file content');
}

type ZipEntry = {
  path: string;
  data: Buffer;
};

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let current = i;
    for (let j = 0; j < 8; j += 1) {
      if (current & 1) {
        current = 0xedb88320 ^ (current >>> 1);
      } else {
        current >>>= 1;
      }
    }
    table[i] = current >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  const records = entries.map((entry) => {
    const nameBuffer = Buffer.from(entry.path, 'utf-8');
    const checksum = crc32(entry.data);
    const localHeader = Buffer.alloc(30 + nameBuffer.length);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuffer.copy(localHeader, 30);

    fileParts.push(localHeader, entry.data);

    const record = {
      nameBuffer,
      checksum,
      size: entry.data.length,
      offset,
    };

    offset += localHeader.length + entry.data.length;
    return record;
  });

  let centralSize = 0;
  for (const record of records) {
    const centralHeader = Buffer.alloc(46 + record.nameBuffer.length);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(record.checksum, 16);
    centralHeader.writeUInt32LE(record.size, 20);
    centralHeader.writeUInt32LE(record.size, 24);
    centralHeader.writeUInt16LE(record.nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(record.offset, 42);
    record.nameBuffer.copy(centralHeader, 46);

    centralParts.push(centralHeader);
    centralSize += centralHeader.length;
  }

  const endOfCentral = Buffer.alloc(22);
  endOfCentral.writeUInt32LE(0x06054b50, 0);
  endOfCentral.writeUInt16LE(0, 4);
  endOfCentral.writeUInt16LE(0, 6);
  endOfCentral.writeUInt16LE(records.length, 8);
  endOfCentral.writeUInt16LE(records.length, 10);
  endOfCentral.writeUInt32LE(centralSize, 12);
  endOfCentral.writeUInt32LE(offset, 16);
  endOfCentral.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, ...centralParts, endOfCentral]);
}

function columnLabel(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function buildSheetXml(rowCount: number, columnCount: number): string {
  const rows: string[] = [];

  for (let row = 1; row <= rowCount; row += 1) {
    const cells: string[] = [];
    for (let column = 0; column < columnCount; column += 1) {
      const cellRef = `${columnLabel(column)}${row}`;
      cells.push(`<c r="${cellRef}" t="inlineStr"><is><t>R${row}C${column + 1}</t></is></c>`);
    }
    rows.push(`<row r="${row}">${cells.join('')}</row>`);
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' +
    rows.join('') +
    '</sheetData>' +
    '</worksheet>'
  );
}

export function createXlsxWithRows(rowCount: number, columnCount: number): Buffer {
  const sheetXml = buildSheetXml(rowCount, columnCount);
  const entries: ZipEntry[] = [
    {
      path: '[Content_Types].xml',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '</Types>',
        'utf-8',
      ),
    },
    {
      path: '_rels/.rels',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
        'utf-8',
      ),
    },
    {
      path: 'xl/workbook.xml',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<workbookPr/>' +
          '<sheets>' +
          '<sheet name="Sheet1" sheetId="1" r:id="rId1"/>' +
          '</sheets>' +
          '</workbook>',
        'utf-8',
      ),
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '</Relationships>',
        'utf-8',
      ),
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      data: Buffer.from(sheetXml, 'utf-8'),
    },
  ];

  return buildZip(entries);
}
