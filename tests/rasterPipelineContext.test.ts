import { describe, expect, it, vi } from 'vitest';

import { RasterPipeline } from '../src/components/ImagePreview/renderers/raster-webgl/RasterPipeline';
import type { WebGLContextEvent, WebGLRasterRenderer } from '../src/components/ImagePreview/renderers/raster-webgl/WebGLRasterRenderer';
import type { RasterTextureEntry } from '../src/components/ImagePreview/renderers/raster-webgl/types';

describe('RasterPipeline WebGL context lifecycle', () => {
  it('drops invalid cache handles on loss and advances generation after restore', () => {
    const deleteTexture = vi.fn();
    let contextListener: ((event: WebGLContextEvent) => void) | undefined;
    const renderer = {
      gl: { deleteTexture } as unknown as WebGL2RenderingContext,
      subscribeContext(listener: (event: WebGLContextEvent) => void) {
        contextListener = listener;
        return () => { contextListener = undefined; };
      },
    } as unknown as WebGLRasterRenderer;
    const pipeline = new RasterPipeline(renderer, 100);
    pipeline.cache.put(entry());

    contextListener?.('lost');
    expect(pipeline.isContextLost).toBe(true);
    expect(pipeline.cache.snapshot().count).toBe(0);
    expect(deleteTexture).not.toHaveBeenCalled();

    contextListener?.('restored');
    expect(pipeline.isContextLost).toBe(false);
    expect(pipeline.generation).toBe(1);
    pipeline.dispose();
    expect(contextListener).toBeUndefined();
  });
});

function entry(): RasterTextureEntry {
  return {
    key: 'current|display',
    resourceKey: 'current',
    quality: 'display',
    texture: {} as WebGLTexture,
    textureWidth: 1,
    textureHeight: 1,
    naturalWidth: 1,
    naturalHeight: 1,
    estimatedBytes: 4,
    lastUsedAt: 0,
    readyAt: 0,
    textureLimited: false,
  };
}
