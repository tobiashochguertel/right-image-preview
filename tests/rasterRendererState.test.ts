import { describe, expect, it } from 'vitest';

import {
  RASTER_SAFE_TEXTURE_EDGE_RATIO,
  RasterRendererFallbackError,
  rasterFallbackReason,
  resolveRasterRendererRoute,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterRendererState';

describe('Raster renderer safety route', () => {
  it('uses the DOM fallback when WebGL2 is unavailable', () => {
    expect(resolveRasterRendererRoute({ webgl2Available: false })).toEqual({
      renderer: 'dom-image',
      fallbackReason: 'webgl2-unavailable',
    });
  });

  it('keeps sources within the safe texture edge on WebGL2', () => {
    const safeTextureSize = Math.floor(8192 * RASTER_SAFE_TEXTURE_EDGE_RATIO);
    expect(resolveRasterRendererRoute({
      webgl2Available: true,
      maxTextureSize: 8192,
      naturalSize: { width: safeTextureSize, height: 1200 },
    })).toEqual({ renderer: 'webgl2', safeTextureSize });
  });

  it('routes an over-limit or ultra-wide source to the DOM fallback', () => {
    const safeTextureSize = Math.floor(8192 * RASTER_SAFE_TEXTURE_EDGE_RATIO);
    expect(resolveRasterRendererRoute({
      webgl2Available: true,
      maxTextureSize: 8192,
      naturalSize: { width: safeTextureSize + 1, height: 100 },
    })).toEqual({
      renderer: 'dom-image',
      fallbackReason: 'texture-too-large',
      safeTextureSize,
    });
  });

  it('classifies only explicit renderer and texture-budget failures as fallback routes', () => {
    expect(rasterFallbackReason(new RasterRendererFallbackError(
      'texture-upload-failed',
      'upload failed',
    ))).toBe('texture-upload-failed');
    expect(rasterFallbackReason(new DOMException('budget', 'QuotaExceededError')))
      .toBe('texture-budget-exceeded');
    expect(rasterFallbackReason(new Error('decode failed'))).toBeNull();
  });
});
