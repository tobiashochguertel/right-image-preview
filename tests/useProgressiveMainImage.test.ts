import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProgressiveMainImage } from '../src/components/ImagePreview/useProgressiveMainImage';

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

  it('keeps underlay until main decode even when preferFastReveal (display-ready path)', async () => {
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
    // known dims → thumbnail-placeholder immediately → underlay allowed
    expect(result.current.showMinimapUnderlay).toBe(true);
    expect(onImageLayout).toHaveBeenCalledWith({
      naturalWidth: 6000,
      naturalHeight: 4000,
    });

    // Early minimap load
    const mini = MockImage.instances.find((i) => i.src.includes('mini'));
    expect(mini).toBeTruthy();
    await act(async () => {
      mini!.completeLoad(240, 160);
    });
    expect(result.current.showMinimapUnderlay).toBe(true);
    expect(result.current.fullDecoded).toBe(false);

    // Main probe finishes (offscreen Image) — still hold underlay
    const full = MockImage.instances.find((i) => i.src.includes('full'));
    expect(full).toBeTruthy();
    await act(async () => {
      full!.completeLoad(6000, 4000);
    });
    expect(result.current.fullDecoded).toBe(false);
    expect(result.current.showMinimapUnderlay).toBe(true);

    // Viewport main decode → dwell 0 because preferFastReveal
    await act(async () => {
      result.current.onMainImgDecoded();
      await vi.runAllTimersAsync();
    });

    await waitFor(() => {
      expect(result.current.fullDecoded).toBe(true);
    });
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

    const fullA = MockImage.instances.find((i) => i.src.includes('a.jpg'));
    const miniA = MockImage.instances.find((i) => i.src.includes('a-mini'));
    await act(async () => {
      miniA!.completeLoad(240, 160);
      fullA!.completeLoad(6000, 4000);
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

    // Stale-reveal bug: first paint after switch must not keep fullDecoded / swallow decode.
    expect(result.current.fullDecoded).toBe(false);

    await act(async () => {
      // Simulate viewport img completing in the same turn as switch (HTTP cache).
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
