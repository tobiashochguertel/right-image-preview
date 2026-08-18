import {
  mediaSourceMimeType,
  readMediaSourcePrefix,
  type MediaSource,
  type ReadMediaSourceOptions,
} from './media-source';

export type MediaKind = 'raster' | 'svg' | 'animated-image' | 'video' | 'unknown';

export interface MediaKindHints {
  kind?: MediaKind;
  mimeType?: string;
  href?: string;
  header?: Uint8Array | ArrayBuffer;
}

export interface DetectMediaKindOptions extends ReadMediaSourceOptions {
  kind?: MediaKind;
  mimeType?: string;
  href?: string;
  sniffBytes?: number;
}

const RASTER_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'jpe', 'bmp', 'avif', 'heic', 'heif', 'tif', 'tiff', 'ico',
]);
const VIDEO_EXTENSIONS = new Set([
  'mp4', 'm4v', 'mov', 'webm', 'ogv', 'avi', 'mkv', 'mpeg', 'mpg',
]);

export function resolveMediaKind(hints: MediaKindHints): MediaKind {
  if (hints.kind) return hints.kind;
  if (hints.header) {
    const sniffed = sniffMediaKind(hints.header);
    if (sniffed) return sniffed;
  }

  const mime = normalizeMimeType(hints.mimeType);
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'image/gif' || mime === 'image/apng') return 'animated-image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime === 'image/png' || mime === 'image/webp') {
    // PNG/APNG and static/animated WebP require bytes or an explicit host kind.
    return 'unknown';
  }
  if (mime?.startsWith('image/')) return 'raster';

  const extension = extensionFromHref(hints.href);
  if (!extension) return 'unknown';
  if (extension === 'svg' || extension === 'svgz') return 'svg';
  if (extension === 'gif' || extension === 'apng') return 'animated-image';
  if (extension === 'png' || extension === 'webp') return 'unknown';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (RASTER_EXTENSIONS.has(extension)) return 'raster';
  return 'unknown';
}

export async function detectMediaKind(
  source: MediaSource,
  options: DetectMediaKindOptions = {},
): Promise<MediaKind> {
  if (options.kind) return options.kind;
  const href = options.href ?? (source.type === 'url' ? source.href : undefined);
  const mimeType = options.mimeType ?? mediaSourceMimeType(source);
  const hinted = resolveMediaKind({ mimeType, href });
  if (hinted !== 'unknown') return hinted;

  try {
    const header = await readMediaSourcePrefix(source, options.sniffBytes, options);
    return resolveMediaKind({ mimeType, href, header });
  } catch {
    // Ambiguous PNG/WebP must never be guessed as static Raster from extension alone.
    return resolveMediaKind({ mimeType, href });
  }
}

export function sniffMediaKind(input: Uint8Array | ArrayBuffer): MediaKind | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (isGif(bytes)) return 'animated-image';
  if (isPng(bytes)) return sniffPng(bytes);
  if (isWebP(bytes)) return sniffWebP(bytes);
  if (isSvg(bytes)) return 'svg';
  if (isJpeg(bytes) || isBmp(bytes) || isTiff(bytes)) return 'raster';
  return sniffIsoBaseMedia(bytes);
}

function sniffPng(bytes: Uint8Array): MediaKind | null {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    if (type === 'acTL') return 'animated-image';
    if (type === 'IDAT' || type === 'IEND') return 'raster';
    const next = offset + 12 + length;
    if (!Number.isSafeInteger(next) || next <= offset || next > bytes.length) break;
    offset = next;
  }
  // The prefix ended before IDAT/IEND. Do not guess: acTL may still follow.
  return null;
}

function sniffWebP(bytes: Uint8Array): MediaKind | null {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = readUint32LE(bytes, offset + 4);
    const dataOffset = offset + 8;
    if (type === 'ANIM' || type === 'ANMF') return 'animated-image';
    if (type === 'VP8X' && dataOffset < bytes.length) {
      return (bytes[dataOffset] & 0x02) !== 0 ? 'animated-image' : 'raster';
    }
    if (type === 'VP8 ' || type === 'VP8L') return 'raster';
    const next = dataOffset + length + (length % 2);
    if (!Number.isSafeInteger(next) || next <= offset || next > bytes.length) break;
    offset = next;
  }
  return null;
}

function sniffIsoBaseMedia(bytes: Uint8Array): MediaKind | null {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return null;
  const brands = ascii(bytes, 8, Math.min(bytes.length - 8, 48));
  if (/avis/.test(brands)) return 'animated-image';
  if (/(avif|heic|heix|hevc|mif1|msf1)/.test(brands)) return 'raster';
  if (/(isom|iso2|mp41|mp42|M4V |qt {2})/.test(brands)) return 'video';
  return null;
}

function isGif(bytes: Uint8Array): boolean {
  const signature = ascii(bytes, 0, 6);
  return signature === 'GIF87a' || signature === 'GIF89a';
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 &&
    bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

function isWebP(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isBmp(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

function isTiff(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const littleEndian = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
  const bigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
  return littleEndian || bigEndian;
}

function isSvg(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096)))
    .replace(/^\uFEFF/, '')
    .trimStart();
  return /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(prefix);
}

function extensionFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const clean = href.split(/[?#]/, 1)[0] ?? '';
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function normalizeMimeType(value: string | undefined): string | undefined {
  const mime = value?.split(';', 1)[0]?.trim().toLowerCase();
  return mime || undefined;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let value = '';
  const end = Math.min(bytes.length, offset + length);
  for (let index = Math.max(0, offset); index < end; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return ((bytes[offset] * 0x1000000) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (bytes[offset] +
    (bytes[offset + 1] << 8) +
    (bytes[offset + 2] << 16) +
    (bytes[offset + 3] * 0x1000000)) >>> 0;
}
