import { describe, expect, it } from 'vitest';
import {
  defaultEstimateDecodedBytes,
  mergeByteAndDisplayStatus,
  orderedNeighborIndexes,
  pickDisplaySlotIndexes,
  PRELOAD_DISPLAY_SETTLE_MS,
  resolvePreloadDisplaySlotCeiling,
  rgbaDecodedBytes,
  suggestPreloadMemoryBudgetBytes,
} from '../src/components/ImagePreview/lib/neighborDisplayPreload';
import type { ImageItem } from '../src/components/ImagePreview/types';

describe('neighborDisplayPreload helpers', () => {
  const images: ImageItem[] = [
    { src: 'a', exif: { width: 100, height: 100 } },
    { src: 'b', exif: { width: 100, height: 100 } },
    { src: 'c', exif: { width: 100, height: 100 } },
    { src: 'd', exif: { width: 1000, height: 1000 } },
    { src: 'e' },
  ];

  it('orders neighbors by distance alternating sides', () => {
    expect(orderedNeighborIndexes(2, 2, 5)).toEqual([3, 1, 4, 0]);
  });

  it('picks up to maxSlots closest neighbors', () => {
    expect(
      pickDisplaySlotIndexes({
        currentIndex: 2,
        radius: 2,
        images,
        maxSlots: 2,
        estimateBytes: defaultEstimateDecodedBytes,
      }),
    ).toEqual([3, 1]);
  });

  it('skips candidates that exceed the remaining budget', () => {
    const cell = rgbaDecodedBytes(100, 100);
    expect(
      pickDisplaySlotIndexes({
        currentIndex: 1,
        radius: 2,
        images,
        maxSlots: 4,
        budgetBytes: cell * 2 + 1,
        estimateBytes: defaultEstimateDecodedBytes,
      }),
    ).toEqual([2, 0]);
  });

  it('skips a first neighbor that alone exceeds the budget', () => {
    expect(
      pickDisplaySlotIndexes({
        currentIndex: 2,
        radius: 1,
        images,
        maxSlots: 2,
        budgetBytes: rgbaDecodedBytes(100, 100),
        estimateBytes: defaultEstimateDecodedBytes,
      }),
    ).toEqual([1]);
  });

  it('uses a slot ceiling when only a budget is provided', () => {
    expect(resolvePreloadDisplaySlotCeiling(0, 100)).toBe(6);
    expect(resolvePreloadDisplaySlotCeiling(0, undefined)).toBe(0);
    expect(resolvePreloadDisplaySlotCeiling(2, 1_000_000)).toBe(2);
  });

  it('suggests a capped fraction of available RAM', () => {
    const available = 8 * 1024 * 1024 * 1024;
    expect(suggestPreloadMemoryBudgetBytes(available)).toBe(
      Math.floor(available * 0.12),
    );
    expect(suggestPreloadMemoryBudgetBytes(32 * 1024 * 1024 * 1024)).toBe(
      Math.floor(1.5 * 1024 * 1024 * 1024),
    );
  });

  it('merges display-ready over byte status', () => {
    const merged = mergeByteAndDisplayStatus(
      { 1: { phase: 'ready', progress: 1 }, 2: { phase: 'loading' } },
      new Set([2]),
    );
    expect(merged[1]).toEqual({ phase: 'ready', progress: 1 });
    expect(merged[2]).toEqual({ phase: 'display-ready', progress: 1 });
  });

  it('defaults neighbor settle debounce to 600ms', () => {
    expect(PRELOAD_DISPLAY_SETTLE_MS).toBe(600);
  });
});
