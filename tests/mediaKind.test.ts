import { describe, expect, it, vi } from 'vitest';

import {
  detectMediaKind,
  resolveMediaKind,
  sniffMediaKind,
} from '../src/components/ImagePreview/core/media-kind';

const encoder = new TextEncoder();

describe('MediaKind', () => {
  it('gives an explicit host kind the highest priority', () => {
    expect(resolveMediaKind({
      kind: 'video',
      mimeType: 'image/jpeg',
      href: '/photo.jpg',
      header: new Uint8Array([0xff, 0xd8, 0xff]),
    })).toBe('video');
  });

  it('uses file bytes before MIME or extension', () => {
    expect(resolveMediaKind({
      mimeType: 'image/gif',
      href: '/wrong.gif',
      header: new Uint8Array([0xff, 0xd8, 0xff]),
    })).toBe('raster');
  });

  it('does not classify ambiguous PNG/WebP from MIME or extension alone', () => {
    expect(resolveMediaKind({ mimeType: 'image/png', href: '/photo.png' })).toBe('unknown');
    expect(resolveMediaKind({ mimeType: 'image/webp', href: '/photo.webp' })).toBe('unknown');
    expect(sniffMediaKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      .toBeNull();
    expect(sniffMediaKind(concat(encoder.encode('RIFF'), new Uint8Array(4), encoder.encode('WEBP'))))
      .toBeNull();
  });

  it('distinguishes PNG from APNG by the acTL chunk', () => {
    expect(sniffMediaKind(png(chunk('IDAT')))).toBe('raster');
    expect(sniffMediaKind(png(chunk('acTL'), chunk('IDAT')))).toBe('animated-image');
  });

  it('distinguishes static and animated WebP', () => {
    expect(sniffMediaKind(webp('VP8 ', new Uint8Array([0])))).toBe('raster');
    expect(sniffMediaKind(webp('VP8X', new Uint8Array([0x02])))).toBe('animated-image');
    expect(sniffMediaKind(webp('ANIM', new Uint8Array(6)))).toBe('animated-image');
  });

  it('detects GIF, SVG, JPEG, AVIF sequence, and video families', () => {
    expect(sniffMediaKind(encoder.encode('GIF89a'))).toBe('animated-image');
    expect(sniffMediaKind(encoder.encode('<?xml version="1.0"?><!--x--><svg viewBox="0 0 1 1">')))
      .toBe('svg');
    expect(sniffMediaKind(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('raster');
    expect(sniffMediaKind(ftyp('avis'))).toBe('animated-image');
    expect(sniffMediaKind(ftyp('avif'))).toBe('raster');
    expect(resolveMediaKind({ mimeType: 'video/mp4' })).toBe('video');
    expect(resolveMediaKind({ href: '/movie.webm?cache=1' })).toBe('video');
  });

  it('sniffs bytes for an ambiguous source', async () => {
    const data = exactArrayBuffer(webp('VP8X', new Uint8Array([0x02])));
    await expect(detectMediaKind({
      type: 'bytes',
      data,
      mimeType: 'image/webp',
    })).resolves.toBe('animated-image');
  });

  it('keeps an ambiguous URL unknown when header access fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('CORS blocked');
    });
    await expect(detectMediaKind(
      { type: 'url', href: 'https://cdn.test/maybe.webp' },
      { fetchImpl: fetchImpl as typeof fetch },
    )).resolves.toBe('unknown');
  });
});

function png(...chunks: Uint8Array[]): Uint8Array {
  return concat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks);
}

function chunk(type: string, data = new Uint8Array(0)): Uint8Array {
  return concat(uint32BE(data.byteLength), encoder.encode(type), data, new Uint8Array(4));
}

function webp(type: string, data: Uint8Array): Uint8Array {
  const body = concat(
    encoder.encode(type),
    uint32LE(data.byteLength),
    data,
    data.byteLength % 2 ? new Uint8Array(1) : new Uint8Array(0),
  );
  return concat(encoder.encode('RIFF'), uint32LE(body.byteLength + 4), encoder.encode('WEBP'), body);
}

function ftyp(brand: string): Uint8Array {
  return concat(uint32BE(20), encoder.encode('ftyp'), encoder.encode(brand), new Uint8Array(8));
}

function uint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function uint32LE(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
