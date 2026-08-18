import { describe, expect, it, vi } from 'vitest';

import {
  acquireMediaBlob,
  createMediaSourceUrlLease,
  mediaSourceMimeType,
  readMediaSourcePrefix,
  resolveMediaSource,
  type ObjectUrlApi,
} from '../src/components/ImagePreview/core/media-source';

describe('MediaSource', () => {
  it('prefers an explicit source and keeps legacy src compatible', () => {
    const explicit = { type: 'blob' as const, blob: new Blob(['new']) };
    expect(resolveMediaSource({ src: '/old.jpg', source: explicit })).toBe(explicit);
    expect(resolveMediaSource({ src: '/legacy.jpg' })).toEqual({
      type: 'url',
      href: '/legacy.jpg',
    });
    expect(resolveMediaSource({})).toBeNull();
  });

  it('normalizes MIME metadata without changing the Blob', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(mediaSourceMimeType({ type: 'blob', blob })).toBe('image/png');
    expect(mediaSourceMimeType({ type: 'blob', blob, mimeType: 'IMAGE/APNG; charset=binary' }))
      .toBe('image/apng');
  });

  it('does not own or revoke URL inputs', () => {
    const api = objectUrlMock();
    const lease = createMediaSourceUrlLease({ type: 'url', href: 'asset://photo.jpg' }, api);
    expect(lease).toMatchObject({ href: 'asset://photo.jpg', owned: false });
    lease.dispose();
    expect(api.createObjectURL).not.toHaveBeenCalled();
    expect(api.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('reuses Blob inputs and revokes an owned object URL exactly once', () => {
    const api = objectUrlMock();
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    const lease = createMediaSourceUrlLease({ type: 'blob', blob }, api);
    expect(api.createObjectURL).toHaveBeenCalledWith(blob);
    expect(lease).toMatchObject({ href: 'blob:test-1', owned: true });
    lease.dispose();
    lease.dispose();
    expect(api.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(api.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('wraps bytes only at the DOM URL boundary', async () => {
    const api = objectUrlMock();
    const data = new Uint8Array([1, 2, 3]).buffer;
    const lease = createMediaSourceUrlLease(
      { type: 'bytes', data, mimeType: 'image/png' },
      api,
    );
    const blob = vi.mocked(api.createObjectURL).mock.calls[0][0];
    expect(blob.type).toBe('image/png');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
    lease.dispose();
  });

  it('returns the same Blob instance for decode and reads bounded prefixes', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
    await expect(acquireMediaBlob({ type: 'blob', blob })).resolves.toBe(blob);
    await expect(readMediaSourcePrefix({ type: 'blob', blob }, 2))
      .resolves.toEqual(new Uint8Array([1, 2]));

    const data = new Uint8Array([5, 6, 7, 8]).buffer;
    const prefix = await readMediaSourcePrefix({ type: 'bytes', data }, 3);
    expect([...prefix]).toEqual([5, 6, 7]);
    expect(prefix.buffer).toBe(data);
  });

  it('requests and retains only the configured URL prefix', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('Range')).toBe('bytes=0-2');
      return new Response(new Uint8Array([9, 8, 7, 6, 5]));
    });
    const prefix = await readMediaSourcePrefix(
      { type: 'url', href: 'https://example.test/photo.webp' },
      3,
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect([...prefix]).toEqual([9, 8, 7]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports real streamed byte progress when Content-Length is exposed', async () => {
    const progress = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    const fetchImpl = vi.fn(async () => new Response(stream, {
      headers: {
        'Content-Length': '4',
        'Content-Type': 'image/jpeg',
      },
    }));

    const blob = await acquireMediaBlob(
      { type: 'url', href: 'https://example.test/large.jpg' },
      { fetchImpl: fetchImpl as typeof fetch, onProgress: progress },
    );

    expect(blob.size).toBe(4);
    expect(progress.mock.calls.map(([entry]) => entry.progress)).toEqual([0, 0.5, 1, 1]);
    expect(progress).toHaveBeenLastCalledWith({
      loadedBytes: 4,
      totalBytes: 4,
      progress: 1,
      complete: true,
    });
  });

  it('keeps streaming progress indeterminate when total bytes are unavailable', async () => {
    const progress = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));

    await acquireMediaBlob(
      { type: 'url', href: 'https://example.test/chunked.jpg' },
      { fetchImpl: fetchImpl as typeof fetch, onProgress: progress },
    );

    expect(progress.mock.calls[0][0]).toEqual({ loadedBytes: 0, complete: false });
    expect(progress).toHaveBeenLastCalledWith({
      loadedBytes: 3,
      totalBytes: 3,
      progress: 1,
      complete: true,
    });
  });
});

function objectUrlMock(): ObjectUrlApi {
  return {
    createObjectURL: vi.fn(() => 'blob:test-1'),
    revokeObjectURL: vi.fn(),
  };
}
