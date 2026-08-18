import { describe, expect, it } from 'vitest';

import {
  buildRasterPreloadPlan,
  planRasterNeighborLods,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterPreloadPlan';
import type { ImageItem } from '../src/components/ImagePreview/types';

const images: ImageItem[] = [
  { id: 'a', src: '/a.jpg', exif: { width: 100, height: 80 } },
  { id: 'video', src: '/clip.mp4', kind: 'video' },
  { id: 'b', src: '/b.png', kind: 'raster' },
  { id: 'svg', src: '/diagram.svg', kind: 'svg' },
  { id: 'c', src: '/c.webp', kind: 'raster' },
  { id: 'd', src: '/d.avif' },
];

describe('buildRasterPreloadPlan', () => {
  it('walks across mixed media and prioritizes the active navigation direction', () => {
    const plan = buildRasterPreloadPlan({
      images,
      currentIndex: 1,
      direction: 1,
      range: 'auto',
      maxCount: 10,
    });

    expect(plan.map((item) => item.resourceKey)).toEqual(['b', 'a', 'c', 'd']);
    expect(plan[1].knownSize).toEqual({ width: 100, height: 80 });
  });

  it('reverses priority after backward navigation and respects the auto ceiling', () => {
    const plan = buildRasterPreloadPlan({
      images,
      currentIndex: 4,
      direction: -1,
      range: 'auto',
      maxCount: 2,
    });

    expect(plan.map((item) => item.resourceKey)).toEqual(['b', 'd']);
  });

  it('orders a 3-forward / 2-backward baseline before expanding farther', () => {
    const rows: ImageItem[] = Array.from({ length: 15 }, (_, index) => ({
      id: String(index),
      src: `/${index}.jpg`,
    }));
    const plan = buildRasterPreloadPlan({
      images: rows,
      currentIndex: 6,
      direction: 1,
      range: 'auto',
      maxCount: 10,
    });

    expect(plan.map((item) => item.resourceKey)).toEqual([
      '7', '5', '8', '4', '9', '10', '3', '11', '2', '12',
    ]);
  });

  it('treats a numeric radius as a hard flat-index boundary', () => {
    const plan = buildRasterPreloadPlan({
      images,
      currentIndex: 1,
      direction: 1,
      range: 1,
      maxCount: 1,
    });

    expect(plan.map((item) => item.resourceKey)).toEqual(['b']);
  });

  it('uses only Screen when the small image-stage viewport can fit every candidate', () => {
    const rows: ImageItem[] = Array.from({ length: 31 }, (_, index) => ({
      id: String(index),
      src: `/${index}.jpg`,
      exif: { width: 7000, height: 4000 },
    }));
    const candidates = buildRasterPreloadPlan({
      images: rows,
      currentIndex: 15,
      direction: 1,
      range: 'auto',
      maxCount: 30,
    });
    const common = {
      candidates,
      budgetBytes: 512 * 1024 * 1024,
      reservedBytes: 170 * 1024 * 1024,
      maxTextureSize: 16_384,
    };
    const small = planRasterNeighborLods({
      ...common,
      viewport: { width: 1000, height: 600, dpr: 1 },
    });
    const large = planRasterNeighborLods({
      ...common,
      viewport: { width: 2560, height: 1440, dpr: 1.5 },
    });
    const screenCount = (plan: typeof small) =>
      plan.snapshot.screenForwardIndexes.length + plan.snapshot.screenBackwardIndexes.length;
    const browseCount = (plan: typeof small) =>
      plan.snapshot.browseForwardIndexes.length + plan.snapshot.browseBackwardIndexes.length;

    expect(screenCount(small)).toBe(candidates.length);
    expect(screenCount(large)).toBe(5);
    expect(browseCount(small)).toBe(0);
    expect(browseCount(large)).toBeGreaterThan(0);
    expect(large.snapshot.screenForwardIndexes.length).toBeGreaterThanOrEqual(3);
    expect(large.snapshot.screenBackwardIndexes.length).toBeGreaterThanOrEqual(2);
    expect(large.snapshot.browseForwardIndexes.length +
      large.snapshot.browseBackwardIndexes.length).toBeGreaterThan(0);
  });

  it('shrinks the Screen core to one neighbour per side under full-screen pressure', () => {
    const rows: ImageItem[] = Array.from({ length: 21 }, (_, index) => ({
      id: String(index),
      src: `/${index}.jpg`,
      exif: { width: 7000, height: 4000 },
    }));
    const plan = planRasterNeighborLods({
      candidates: buildRasterPreloadPlan({
        images: rows,
        currentIndex: 10,
        direction: 1,
        range: 'auto',
        maxCount: 20,
      }),
      viewport: { width: 2560, height: 1440, dpr: 2 },
      budgetBytes: 150 * 1024 * 1024,
      reservedBytes: 0,
      maxTextureSize: 16_384,
    });

    expect(plan.snapshot.screenForwardIndexes).toEqual([11]);
    expect(plan.snapshot.screenBackwardIndexes).toEqual([9]);
    expect(plan.snapshot.browseForwardIndexes.length +
      plan.snapshot.browseBackwardIndexes.length).toBeGreaterThan(0);
  });

  it('keeps each direction as a contiguous Screen core followed by a Browse ring', () => {
    const rows: ImageItem[] = Array.from({ length: 61 }, (_, index) => ({
      id: String(index),
      src: `/${index}.jpg`,
      exif: { width: 7000, height: 4000 },
    }));
    const candidates = buildRasterPreloadPlan({
      images: rows,
      currentIndex: 30,
      direction: 1,
      range: 'auto',
      maxCount: 50,
    });
    const plan = planRasterNeighborLods({
      candidates,
      viewport: { width: 2560, height: 1440, dpr: 2 },
      budgetBytes: 512 * 1024 * 1024,
      reservedBytes: 50 * 1024 * 1024,
      maxTextureSize: 16_384,
    });

    for (const side of ['forward', 'backward'] as const) {
      const entries = plan.entries
        .filter((entry) => entry.side === side)
        .sort((a, b) => a.distance - b.distance);
      expect(entries.map((entry) => entry.distance)).toEqual(
        Array.from({ length: entries.length }, (_, index) => index + 1),
      );
      const firstBrowse = entries.findIndex((entry) => entry.lod === 'browse');
      if (firstBrowse >= 0) {
        expect(entries.slice(firstBrowse).every((entry) => entry.lod === 'browse')).toBe(true);
      }
    }
    const browseCount = plan.entries.filter((entry) => entry.lod === 'browse').length;
    expect(browseCount).toBeGreaterThan(0);
  });
});
