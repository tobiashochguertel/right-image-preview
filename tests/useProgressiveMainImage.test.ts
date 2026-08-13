import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProgressiveMainImage } from '../src/components/ImagePreview/useProgressiveMainImage';
import type { UseProgressiveMainImageResult } from '../src/components/ImagePreview/useProgressiveMainImage';

class MockImage {
  static instances: MockImage[] = [];
  onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
  onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  private _src = '';

  constructor() {
    MockImage.instances.push(this);
  }

  get src() {
    return this._src;
  }

  set src(v: string) {
    this._src = v;
  }

  completeLoad(w = 100, h = 80) {
    this.naturalWidth = w;
    this.naturalHeight = h;
    this.onload?.call(this as unknown as GlobalEventHandlers, new Event('load'));
  }
}

describe('useProgressiveMainImage', () => {
  const OriginalImage = globalThis.Image;

  beforeEach(() => {
    MockImage.instances = [];
    // @ts-expect-error test mock
    globalThis.Image = MockImage;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.Image = OriginalImage;
    vi.useRealTimers();
  });

  it('fast-reveal with known dims skips main Image probe and reveals without waiting on it', async () => {
    const onImageLayout = vi.fn();
    const { result } = renderHook(() =>
      useProgressiveMainImage({
        mainSrc: 'https://example.com/full.jpg',
        minimapSrc: 'https://example.com/mini.jpg',
        minimapCustom: false,
        enabled: true,
        placeholderMinVisibleMs: 400,
        preferFastReveal: true,
        knownDimensions: { naturalWidth: 6000, naturalHeight: 4000 },
        onImageLayout,
      }),
    );

    expect(result.current.pipelineActive).toBe(true);
    expect(result.current.fullDecoded).toBe(false);
    expect(result.current.showMinimapUnderlay).toBe(true);
    expect(onImageLayout).toHaveBeenCalledWith({
      naturalWidth: 6000,
      naturalHeight: 4000,
    });

    // Minimap underlay may still preload; full-size probe must not (avoids ~1s re-decode).
    const mini = MockImage.instances.find((i) => i.src.includes('mini'));
    expect(mini).toBeTruthy();
    expect(MockImage.instances.find((i) => i.src.includes('full'))).toBeUndefined();

    await act(async () => {
      mini!.completeLoad(240, 160);
    });
    expect(result.current.showMinimapUnderlay).toBe(true);
    expect(result.current.fullDecoded).toBe(false);

    await act(async () => {
      result.current.onMainImgDecoded();
      await vi.runAllTimersAsync();
    });

    await waitFor(() => {
      expect(result.current.fullDecoded).toBe(true);
    });
  });

  it('drains pending when known dims enter placeholder (layout microtask race)', async () => {
    let api!: UseProgressiveMainImageResult;
    const { result, rerender } = renderHook(
      ({ mainSrc, minimapSrc }) => {
        api = useProgressiveMainImage({
          mainSrc,
          minimapSrc,
          minimapCustom: false,
          enabled: true,
          placeholderMinVisibleMs: 0,
          preferFastReveal: true,
          knownDimensions: { naturalWidth: 6000, naturalHeight: 4000 },
          onImageLayout: vi.fn(),
          onStageChange: (stage) => {
            // Simulate viewport decode microtask while stage is still `preloading`.
            if (stage === 'preloading') api.onMainImgDecoded();
          },
        });
        return api;
      },
      {
        initialProps: {
          mainSrc: 'https://example.com/a.jpg',
          minimapSrc: 'https://example.com/a-mini.jpg',
        },
      },
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.fullDecoded).toBe(true);

    MockImage.instances = [];
    await act(async () => {
      rerender({
        mainSrc: 'https://example.com/b.jpg',
        minimapSrc: 'https://example.com/b-mini.jpg',
      });
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Must not be stuck waiting for a skipped / never-fired main probe.
    expect(result.current.fullDecoded).toBe(true);
    expect(MockImage.instances.find((i) => i.src.includes('b.jpg'))).toBeUndefined();
  });

  it('reveals after src switch even if previous revealCompleted was true (cached neighbor)', async () => {
    const onImageLayout = vi.fn();
    const { result, rerender } = renderHook(
      ({ mainSrc, minimapSrc }) =>
        useProgressiveMainImage({
          mainSrc,
          minimapSrc,
          minimapCustom: false,
          enabled: true,
          placeholderMinVisibleMs: 0,
          preferFastReveal: true,
          knownDimensions: { naturalWidth: 6000, naturalHeight: 4000 },
          onImageLayout,
        }),
      {
        initialProps: {
          mainSrc: 'https://example.com/a.jpg',
          minimapSrc: 'https://example.com/a-mini.jpg',
        },
      },
    );

    const miniA = MockImage.instances.find((i) => i.src.includes('a-mini'));
    await act(async () => {
      miniA!.completeLoad(240, 160);
      result.current.onMainImgDecoded();
      await vi.runAllTimersAsync();
    });
    expect(result.current.fullDecoded).toBe(true);

    MockImage.instances = [];
    await act(async () => {
      rerender({
        mainSrc: 'https://example.com/b.jpg',
        minimapSrc: 'https://example.com/b-mini.jpg',
      });
    });

    expect(result.current.fullDecoded).toBe(false);

    await act(async () => {
      result.current.onMainImgDecoded();
      await vi.runAllTimersAsync();
    });
    expect(result.current.fullDecoded).toBe(true);
  });

  it('applies placeholder dwell when not preferFastReveal', async () => {
    const { result } = renderHook(() =>
      useProgressiveMainImage({
        mainSrc: 'https://example.com/full.jpg',
        minimapSrc: 'https://example.com/mini.jpg',
        minimapCustom: false,
        enabled: true,
        placeholderMinVisibleMs: 300,
        preferFastReveal: false,
        onImageLayout: vi.fn(),
      }),
    );

    const mini = MockImage.instances.find((i) => i.src.includes('mini'));
    const full = MockImage.instances.find((i) => i.src.includes('full'));
    await act(async () => {
      mini!.completeLoad(240, 160);
      full!.completeLoad(6000, 4000);
    });

    await act(async () => {
      result.current.onMainImgDecoded();
    });
    expect(result.current.fullDecoded).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(result.current.fullDecoded).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(result.current.fullDecoded).toBe(true);
  });
});
