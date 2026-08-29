export interface RasterNaturalSize {
  width: number;
  height: number;
}

const HEADER_BYTES = 512 * 1024;

/** Reads common raster dimensions from headers without decoding the full bitmap. */
export async function readRasterNaturalSize(blob: Blob): Promise<RasterNaturalSize | undefined> {
  const bytes = new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer());
  return readJpegSize(bytes)
    ?? readPngSize(bytes)
    ?? readWebpSize(bytes)
    ?? readBmpSize(bytes)
    ?? readAvifSize(bytes);
}

function readJpegSize(bytes: Uint8Array): RasterNaturalSize | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  let orientation = 1;
  let size: RasterNaturalSize | undefined;
  while (offset + 4 <= bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = readU16BE(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    const payload = offset + 2;
    if (marker === 0xe1) orientation = readExifOrientation(bytes, payload, length - 2) ?? orientation;
    if (isJpegSof(marker) && length >= 7) {
      size = {
        height: readU16BE(bytes, payload + 1),
        width: readU16BE(bytes, payload + 3),
      };
    }
    offset += length;
  }
  if (!size?.width || !size.height) return undefined;
  return orientation >= 5 && orientation <= 8
    ? { width: size.height, height: size.width }
    : size;
}

function isJpegSof(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function readExifOrientation(
  bytes: Uint8Array,
  payload: number,
  payloadLength: number,
): number | undefined {
  if (payloadLength < 14) return undefined;
  if (String.fromCharCode(...bytes.subarray(payload, payload + 4)) !== 'Exif') return undefined;
  const tiff = payload + 6;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return undefined;
  const u16 = (at: number) => little
    ? bytes[at] | (bytes[at + 1] << 8)
    : readU16BE(bytes, at);
  const u32 = (at: number) => little
    ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
    : readU32BE(bytes, at);
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > payload + payloadLength) return undefined;
  const count = u16(ifd);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > payload + payloadLength) break;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return undefined;
}

function readPngSize(bytes: Uint8Array): RasterNaturalSize | undefined {
  if (bytes.length < 24 || bytes[0] !== 0x89 || ascii(bytes, 1, 3) !== 'PNG') return undefined;
  return positiveSize(readU32BE(bytes, 16), readU32BE(bytes, 20));
}

function readWebpSize(bytes: Uint8Array): RasterNaturalSize | undefined {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return undefined;
  }
  const kind = ascii(bytes, 12, 4);
  if (kind === 'VP8X') {
    return positiveSize(1 + readU24LE(bytes, 24), 1 + readU24LE(bytes, 27));
  }
  if (kind === 'VP8 ' && bytes.length >= 30) {
    return positiveSize(readU16LE(bytes, 26) & 0x3fff, readU16LE(bytes, 28) & 0x3fff);
  }
  if (kind === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = readU32LE(bytes, 21);
    return positiveSize((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  return undefined;
}

function readBmpSize(bytes: Uint8Array): RasterNaturalSize | undefined {
  if (bytes.length < 26 || ascii(bytes, 0, 2) !== 'BM') return undefined;
  return positiveSize(Math.abs(readI32LE(bytes, 18)), Math.abs(readI32LE(bytes, 22)));
}

function readAvifSize(bytes: Uint8Array): RasterNaturalSize | undefined {
  for (let offset = 4; offset + 16 <= bytes.length; offset += 1) {
    if (ascii(bytes, offset, 4) !== 'ispe') continue;
    const width = readU32BE(bytes, offset + 8);
    const height = readU32BE(bytes, offset + 12);
    const size = positiveSize(width, height);
    if (size) return size;
  }
  return undefined;
}

function positiveSize(width: number, height: number): RasterNaturalSize | undefined {
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readI32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}
