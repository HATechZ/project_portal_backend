import { Readable, Transform } from 'node:stream';
import { createDeflateRaw } from 'node:zlib';

export type ZipEntry = { name: string; body: Readable };

type CentralDirectoryEntry = {
  name: Buffer;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
};

const MAX_ZIP32 = 0xffffffff;

/**
 * Builds a standards-compatible ZIP a chunk at a time. The storage bodies are
 * never accumulated in memory; each entry is deflated and emitted before the
 * next one is read.
 */
export function streamingZip(entries: ZipEntry[]): Readable {
  return Readable.from(zip(entries));
}

async function* zip(entries: ZipEntry[]): AsyncGenerator<Buffer> {
  const directory: CentralDirectoryEntry[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const local = localHeader(name);
    yield local;
    const localOffset = offset;
    offset = checkedSize(offset + local.length);

    let crc = 0xffffffff;
    let compressedSize = 0;
    let uncompressedSize = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        uncompressedSize = checkedSize(uncompressedSize + data.length);
        crc = crc32(data, crc);
        callback(null, data);
      },
    });
    const deflater = createDeflateRaw();
    entry.body.once('error', (error) => meter.destroy(error));
    meter.once('error', (error) => deflater.destroy(error));
    entry.body.pipe(meter).pipe(deflater);
    for await (const chunk of deflater) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      compressedSize = checkedSize(compressedSize + data.length);
      offset = checkedSize(offset + data.length);
      yield data;
    }
    const descriptor = dataDescriptor(crc ^ 0xffffffff, compressedSize, uncompressedSize);
    yield descriptor;
    offset = checkedSize(offset + descriptor.length);
    directory.push({
      name,
      crc: crc ^ 0xffffffff,
      compressedSize,
      uncompressedSize,
      offset: localOffset,
    });
  }
  const directoryOffset = offset;
  for (const entry of directory) {
    const header = centralDirectoryHeader(entry);
    yield header;
    offset = checkedSize(offset + header.length);
  }
  yield endOfCentralDirectory(directory.length, offset - directoryOffset, directoryOffset);
}

function localHeader(name: Buffer): Buffer {
  const header = Buffer.alloc(30 + name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0808, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(0, 18);
  header.writeUInt32LE(0, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  name.copy(header, 30);
  return header;
}

function dataDescriptor(crc: number, compressed: number, uncompressed: number) {
  const descriptor = Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(crc >>> 0, 4);
  descriptor.writeUInt32LE(compressed, 8);
  descriptor.writeUInt32LE(uncompressed, 12);
  return descriptor;
}

function centralDirectoryHeader(entry: CentralDirectoryEntry): Buffer {
  const header = Buffer.alloc(46 + entry.name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0808, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(entry.crc >>> 0, 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.uncompressedSize, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  entry.name.copy(header, 46);
  return header;
}

function endOfCentralDirectory(count: number, size: number, offset: number): Buffer {
  if (count > 0xffff || size > MAX_ZIP32 || offset > MAX_ZIP32)
    throw new Error('ZIP archive exceeds ZIP32 limits.');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return end;
}

function checkedSize(value: number): number {
  if (value > MAX_ZIP32) throw new Error('ZIP entry exceeds ZIP32 limits.');
  return value;
}

function crc32(data: Buffer, crc: number): number {
  let value = crc;
  for (const byte of data) value = (value >>> 8) ^ CRC_TABLE[(value ^ byte) & 0xff];
  return value;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
