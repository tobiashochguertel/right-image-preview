import { describe, expect, it, vi } from 'vitest';

import { TextureCache } from '../src/components/ImagePreview/renderers/raster-webgl/TextureCache';
import type { RasterTextureEntry } from '../src/components/ImagePreview/renderers/raster-webgl/types';

describe('TextureCache', () => {
  it('evicts the least-recent unprotected texture and releases it on the GPU', () => {
    const deleteTexture = vi.fn();
    const cache = new TextureCache({ deleteTexture } as unknown as WebGL2RenderingContext, 20);
    const first = entry('first', 10, 1);
    const second = entry('second', 10, 2);
    const third = entry('third', 10, 3);
    cache.put(first);
    cache.put(second);
    cache.protect(['second']);
    cache.put(third);

    expect(cache.get('first')).toBeUndefined();
    expect(cache.get('second')).toBe(second);
    expect(cache.get('third')).toBe(third);
    expect(deleteTexture).toHaveBeenCalledWith(first.texture);
    expect(cache.snapshot()).toMatchObject({ count: 2, usedBytes: 20, oversubscribed: false });
  });

  it('allows one over-budget current texture and clears resources explicitly', () => {
    const deleteTexture = vi.fn();
    const cache = new TextureCache({ deleteTexture } as unknown as WebGL2RenderingContext, 8);
    const oversized = entry('large', 16, 1);
    cache.put(oversized);

    expect(cache.snapshot()).toMatchObject({ count: 1, usedBytes: 16, oversubscribed: true });
    cache.clear();
    expect(deleteTexture).toHaveBeenCalledWith(oversized.texture);
    expect(cache.snapshot()).toMatchObject({ count: 0, usedBytes: 0 });
  });

  it('retains a higher-priority neighbor instead of a newer lower-priority one', () => {
    const deleteTexture = vi.fn();
    const cache = new TextureCache({ deleteTexture } as unknown as WebGL2RenderingContext, 20);
    const current = entry('current', 10, 1);
    const nearest = entry('nearest', 10, 2);
    const farther = entry('farther', 10, 3);

    cache.put(current, 100);
    cache.protect(['current']);
    cache.put(nearest, 20);
    expect(cache.put(farther, 19)).toBe(false);

    expect(cache.has('current')).toBe(true);
    expect(cache.has('nearest')).toBe(true);
    expect(cache.has('farther')).toBe(false);
    expect(deleteTexture).toHaveBeenCalledWith(farther.texture);
  });

  it('can protect the current Full, current Screen, and immediately previous Screen together', () => {
    const deleteTexture = vi.fn();
    const cache = new TextureCache({ deleteTexture } as unknown as WebGL2RenderingContext, 30);
    const previousScreen = entry('previous|display', 10, 1);
    const currentScreen = entry('current|display', 10, 2);
    const currentFull = { ...entry('current|full', 10, 3), quality: 'full' as const };

    cache.put(previousScreen, 40);
    cache.put(currentScreen, 100);
    cache.protect(['previous|display', 'current|display', 'current|full']);
    cache.put(currentFull, 100);
    cache.put(entry('farther|browse', 10, 4), 10);

    expect(cache.has('previous|display')).toBe(true);
    expect(cache.has('current|display')).toBe(true);
    expect(cache.has('current|full')).toBe(true);
    expect(cache.has('farther|browse')).toBe(false);
  });

  it('admits many small textures until actual uploaded bytes reach the budget', () => {
    const cache = new TextureCache(
      { deleteTexture: vi.fn() } as unknown as WebGL2RenderingContext,
      50,
    );
    cache.put(entry('current', 10, 1), 100);
    cache.protect(['current']);

    const retained = [1, 2, 3, 4, 5].filter((index) =>
      cache.put(entry(`small-${index}`, 10, index + 1), 20 - index));

    expect(retained).toEqual([1, 2, 3, 4]);
    expect(cache.snapshot()).toMatchObject({ count: 5, usedBytes: 50, oversubscribed: false });
    expect(cache.has('small-5')).toBe(false);
  });

  it('can drop all neighbor textures when preload is explicitly disabled', () => {
    const deleteTexture = vi.fn();
    const cache = new TextureCache({ deleteTexture } as unknown as WebGL2RenderingContext, 50);
    cache.put(entry('current', 10, 1), 100);
    cache.put(entry('neighbor-a', 10, 2), 20);
    cache.put(entry('neighbor-b', 10, 3), 19);

    expect(cache.retainOnly(['current'])).toBe(true);
    expect(cache.retainOnly(['current'])).toBe(false);

    expect(cache.has('current')).toBe(true);
    expect(cache.has('neighbor-a')).toBe(false);
    expect(cache.has('neighbor-b')).toBe(false);
    expect(deleteTexture).toHaveBeenCalledTimes(2);
  });

  it('adjusts its budget without rebuilding and preserves the protected current texture', () => {
    const deleteTexture = vi.fn();
    const cache = new TextureCache({ deleteTexture } as unknown as WebGL2RenderingContext, 30);
    const current = entry('current', 10, 1);
    cache.put(current, 100);
    cache.put(entry('neighbor-a', 10, 2), 20);
    cache.put(entry('neighbor-b', 10, 3), 19);
    cache.protect(['current']);

    cache.setMaxBytes(15);

    expect(cache.get('current')).toBe(current);
    expect(cache.snapshot()).toMatchObject({ count: 1, usedBytes: 10, maxBytes: 15 });
    expect(deleteTexture).toHaveBeenCalledTimes(2);
  });

  it('reports only resource keys whose textures are still resident', () => {
    const cache = new TextureCache(
      { deleteTexture: vi.fn() } as unknown as WebGL2RenderingContext,
      20,
    );
    cache.put(entry('photo-a', 10, 1));
    cache.put(entry('photo-b', 10, 2));
    cache.put({ ...entry('preview-only', 1, 3), quality: 'preview' });
    cache.delete('photo-a');

    expect(cache.residentResourceKeys()).toEqual(['photo-b']);
  });
});

function entry(key: string, estimatedBytes: number, lastUsedAt: number): RasterTextureEntry {
  return {
    key,
    resourceKey: key,
    quality: 'display',
    texture: { key } as unknown as WebGLTexture,
    textureWidth: 1,
    textureHeight: 1,
    naturalWidth: 1,
    naturalHeight: 1,
    estimatedBytes,
    lastUsedAt,
    readyAt: lastUsedAt,
    textureLimited: false,
  };
}
