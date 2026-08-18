import { describe, expect, it } from 'vitest';
import {
  flattenGroupedImages,
  resolveDefaultGroupedFlatIndex,
  resolvePreviewImages,
} from '../src/components/ImagePreview/flattenGroupedImages';

describe('resolveDefaultGroupedFlatIndex', () => {
  it('maps group + in-group index to flat index', () => {
    const grouped = [
      { name: 'a', images: [{ src: '1' }, { src: '2' }] },
      { name: 'b', images: [{ src: '3' }] },
    ];
    expect(resolveDefaultGroupedFlatIndex(grouped, { defaultGroupIndex: 1, defaultIndexInGroup: 0 })).toBe(2);
    expect(resolveDefaultGroupedFlatIndex(grouped, { defaultGroupIndex: 0, defaultIndexInGroup: 1 })).toBe(1);
  });

  it('counts only non-empty groups for defaultGroupIndex', () => {
    const grouped = [
      { name: 'a', images: [{ src: '1' }] },
      { name: 'empty', images: [] },
      { name: 'b', images: [{ src: '2' }, { src: '3' }] },
    ];
    expect(flattenGroupedImages(grouped).groupSlices).toHaveLength(2);
    expect(resolveDefaultGroupedFlatIndex(grouped, { defaultGroupIndex: 1, defaultIndexInGroup: 1 })).toBe(2);
  });

  it('clamps out-of-range indices', () => {
    const grouped = [{ name: 'a', images: [{ src: '1' }] }];
    expect(resolveDefaultGroupedFlatIndex(grouped, { defaultGroupIndex: 99, defaultIndexInGroup: 0 })).toBe(0);
    expect(resolveDefaultGroupedFlatIndex(grouped, { defaultGroupIndex: 0, defaultIndexInGroup: 99 })).toBe(0);
  });
});

describe('resolvePreviewImages MediaSource', () => {
  it('accepts a source-only single media input and carries host hints', () => {
    const source = { type: 'bytes' as const, data: new ArrayBuffer(3), mimeType: 'image/jpeg' };
    const { images } = resolvePreviewImages({ source, kind: 'raster', mimeType: 'image/jpeg' });
    expect(images).toEqual([expect.objectContaining({
      src: 'media-source',
      source,
      kind: 'raster',
      mimeType: 'image/jpeg',
    })]);
  });
});
