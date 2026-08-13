import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  isHoldBitmapCandidate,
  isHoldContentVisible,
  pickHoldPresentImg,
  type HoldBitmapCandidateInput,
} from '../src/components/ImagePreview/lib/holdContentVisible';
import { useHoldStagePresented } from '../src/components/ImagePreview/useHoldStagePresented';

const base: HoldBitmapCandidateInput = {
  imageLoadError: false,
  imageShowReady: false,
  showMinimapUnderlay: false,
  underlayPainted: false,
  pipelineActive: false,
  fullDecoded: false,
  thumbOnly: false,
  mainPainted: false,
};

describe('isHoldBitmapCandidate', () => {
  it('is false while stage wrapper is opacity-hidden (black box)', () => {
    expect(
      isHoldBitmapCandidate({
        ...base,
        pipelineActive: true,
        showMinimapUnderlay: true,
        underlayPainted: true,
        imageShowReady: false,
      }),
    ).toBe(false);
  });

  it('does not count layout-only / placeholder stage without a painted underlay', () => {
    expect(
      isHoldBitmapCandidate({
        ...base,
        imageShowReady: true,
        pipelineActive: true,
        showMinimapUnderlay: true,
        underlayPainted: false,
      }),
    ).toBe(false);
  });

  it('counts painted minimap underlay (even before full decode)', () => {
    expect(
      isHoldBitmapCandidate({
        ...base,
        imageShowReady: true,
        pipelineActive: true,
        showMinimapUnderlay: true,
        underlayPainted: true,
      }),
    ).toBe(true);
  });

  it('without thumb: waits for main bitmap, not pipeline-inactive alone', () => {
    expect(
      isHoldBitmapCandidate({
        ...base,
        imageShowReady: true,
        pipelineActive: false,
        mainPainted: false,
      }),
    ).toBe(false);

    expect(
      isHoldBitmapCandidate({
        ...base,
        imageShowReady: true,
        pipelineActive: false,
        mainPainted: true,
      }),
    ).toBe(true);
  });

  it('with progressive: full decode + main painted counts after underlay path', () => {
    expect(
      isHoldBitmapCandidate({
        ...base,
        imageShowReady: true,
        pipelineActive: true,
        fullDecoded: true,
        mainPainted: true,
      }),
    ).toBe(true);
  });

  it('treats load error as ready so hold does not stick forever', () => {
    expect(isHoldContentVisible({ ...base, imageLoadError: true })).toBe(true);
  });
});

describe('pickHoldPresentImg', () => {
  const underlay = { id: 'u' } as unknown as HTMLImageElement;
  const main = { id: 'm' } as unknown as HTMLImageElement;

  it('prefers underlay while it covers the stage', () => {
    expect(
      pickHoldPresentImg({
        showMinimapUnderlay: true,
        underlayPainted: true,
        fullDecoded: false,
        pipelineActive: true,
        thumbOnly: false,
        mainPainted: true,
        underlayEl: underlay,
        mainEl: main,
      }),
    ).toBe(underlay);
  });

  it('uses main after full reveal', () => {
    expect(
      pickHoldPresentImg({
        showMinimapUnderlay: true,
        underlayPainted: true,
        fullDecoded: true,
        pipelineActive: true,
        thumbOnly: false,
        mainPainted: true,
        underlayEl: underlay,
        mainEl: main,
      }),
    ).toBe(main);
  });
});

describe('useHoldStagePresented', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) =>
        window.setTimeout(() => cb(performance.now()), 16) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function makeImg(): HTMLImageElement {
    return {
      complete: true,
      naturalWidth: 100,
      naturalHeight: 80,
      decode: () => Promise.resolve(),
    } as unknown as HTMLImageElement;
  }

  async function flushPresented() {
    // decode microtask + two rAF timeouts
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(16);
      await Promise.resolve();
      vi.advanceTimersByTime(16);
      await Promise.resolve();
    });
  }

  it('stays false until double-rAF after candidate, then locks for the visit', async () => {
    const img = makeImg();
    const { result, rerender } = renderHook(
      (props: { visitKey: string; imageShowReady: boolean }) =>
        useHoldStagePresented({
          visitKey: props.visitKey,
          imageLoadError: false,
          imageShowReady: props.imageShowReady,
          showMinimapUnderlay: true,
          underlayPainted: true,
          pipelineActive: true,
          fullDecoded: false,
          thumbOnly: false,
          mainPainted: false,
          getUnderlayEl: () => img,
          getMainEl: () => null,
        }),
      { initialProps: { visitKey: '0:a', imageShowReady: false } },
    );

    expect(result.current).toBe(false);

    rerender({ visitKey: '0:a', imageShowReady: true });
    expect(result.current).toBe(false);

    await flushPresented();
    expect(result.current).toBe(true);
  });

  it('stays presented when underlay upgrades to fullDecoded on the same visit', async () => {
    const img = makeImg();
    const { result, rerender } = renderHook(
      (props: { fullDecoded: boolean }) =>
        useHoldStagePresented({
          visitKey: '1:b',
          imageLoadError: false,
          imageShowReady: true,
          showMinimapUnderlay: true,
          underlayPainted: true,
          pipelineActive: true,
          fullDecoded: props.fullDecoded,
          thumbOnly: false,
          mainPainted: true,
          getUnderlayEl: () => img,
          getMainEl: () => img,
        }),
      { initialProps: { fullDecoded: false } },
    );

    await flushPresented();
    expect(result.current).toBe(true);
    rerender({ fullDecoded: true });
    expect(result.current).toBe(true);
  });

  it('resets when visitKey changes', async () => {
    const img = makeImg();
    const { result, rerender } = renderHook(
      (props: { visitKey: string }) =>
        useHoldStagePresented({
          visitKey: props.visitKey,
          imageLoadError: false,
          imageShowReady: true,
          showMinimapUnderlay: true,
          underlayPainted: true,
          pipelineActive: true,
          fullDecoded: false,
          thumbOnly: false,
          mainPainted: false,
          getUnderlayEl: () => img,
          getMainEl: () => null,
        }),
      { initialProps: { visitKey: '0:a' } },
    );

    await flushPresented();
    expect(result.current).toBe(true);

    act(() => {
      rerender({ visitKey: '1:b' });
    });
    expect(result.current).toBe(false);
  });
});
