import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNeighborPreload } from '../src/components/ImagePreview/useNeighborPreload';

describe('useNeighborPreload', () => {
  const images = [
    { src: 'https://example.com/0.jpg' },
    { src: 'https://example.com/1.jpg' },
    { src: 'https://example.com/2.jpg' },
    { src: 'https://example.com/3.jpg' },
  ];

  const created: HTMLImageElement[] = [];
  const OriginalImage = globalThis.Image;

  beforeEach(() => {
    created.length = 0;
    globalThis.Image = class extends OriginalImage {
      constructor() {
        super();
        created.push(this);
      }
    } as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.Image = OriginalImage;
  });

  it('reports empty indexes when radius is 0', async () => {
    const onPreloadIndexesChange = vi.fn();
    renderHook(() =>
      useNeighborPreload({
        images,
        currentIndex: 1,
        radius: 0,
        onPreloadIndexesChange,
      }),
    );
    expect(onPreloadIndexesChange).toHaveBeenCalledWith([]);
    expect(created).toHaveLength(0);
  });

  it('reports loading then ready for neighbors in the active window', async () => {
    const onPreloadIndexesChange = vi.fn();
    const onPreloadStatusChange = vi.fn();
    renderHook(() =>
      useNeighborPreload({
        images,
        currentIndex: 1,
        radius: 1,
        onPreloadIndexesChange,
        onPreloadStatusChange,
      }),
    );
    await waitFor(() => {
      expect(onPreloadIndexesChange).toHaveBeenCalledWith([0, 2]);
      expect(created.length).toBeGreaterThanOrEqual(2);
    });

    for (const img of created) {
      img.onload?.(new Event('load') as never);
    }

    await waitFor(() => {
      const last = onPreloadStatusChange.mock.calls.at(-1)?.[0] as Record<
        number,
        { phase: string; progress?: number }
      >;
      expect(last[0]).toEqual({ phase: 'ready', progress: 1 });
      expect(last[2]).toEqual({ phase: 'ready', progress: 1 });
    });
  });

  it('downgrades ready to warm when leaving the active window', async () => {
    const onPreloadStatusChange = vi.fn();
    const { rerender } = renderHook(
      ({ index }) =>
        useNeighborPreload({
          images,
          currentIndex: index,
          radius: 1,
          onPreloadStatusChange,
        }),
      { initialProps: { index: 1 } },
    );

    await waitFor(() => expect(created.length).toBeGreaterThanOrEqual(2));
    for (const img of created) {
      img.onload?.(new Event('load') as never);
    }
    await waitFor(() => {
      const last = onPreloadStatusChange.mock.calls.at(-1)?.[0] as Record<
        number,
        { phase: string }
      >;
      expect(last[0]?.phase).toBe('ready');
    });

    // Jump far enough that index 0 leaves radius-1 around current.
    rerender({ index: 3 });

    await waitFor(() => {
      const last = onPreloadStatusChange.mock.calls.at(-1)?.[0] as Record<
        number,
        { phase: string; progress?: number }
      >;
      expect(last[0]).toEqual({ phase: 'warm', progress: 1 });
      // Neighbors of 3: only 2 (radius 1).
      expect(last[2]?.phase === 'ready' || last[2]?.phase === 'loading').toBe(true);
    });
  });

  it('omits the current image from strip status, then warm after leaving', async () => {
    const onPreloadStatusChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ index }) =>
        useNeighborPreload({
          images,
          currentIndex: index,
          radius: 0,
          onPreloadStatusChange,
        }),
      { initialProps: { index: 0 } },
    );

    result.current.markSrcReady('https://example.com/0.jpg');
    await waitFor(() => {
      const last = onPreloadStatusChange.mock.calls.at(-1)?.[0] as Record<
        number,
        { phase: string }
      >;
      // Current tile: no preload bar / phase.
      expect(last[0]).toBeUndefined();
    });

    // After navigating away (radius 0 → no ready window), becomes warm.
    rerender({ index: 2 });
    await waitFor(() => {
      const last = onPreloadStatusChange.mock.calls.at(-1)?.[0] as Record<
        number,
        { phase: string }
      >;
      expect(last[0]).toEqual({ phase: 'warm', progress: 1 });
    });
  });
});
