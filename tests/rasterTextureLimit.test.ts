import { describe, expect, it } from 'vitest';

import {
  fitRasterToByteLimit,
  fitRasterToTextureLimit,
} from '../src/components/ImagePreview/renderers/raster-webgl/RasterPipeline';

describe('fitRasterToTextureLimit', () => {
  it('keeps supported dimensions unchanged', () => {
    expect(fitRasterToTextureLimit(4000, 3000, 8192)).toEqual({ width: 4000, height: 3000 });
  });

  it('preserves aspect ratio while clamping the longest edge', () => {
    expect(fitRasterToTextureLimit(16000, 12000, 8192)).toEqual({ width: 8192, height: 6144 });
    expect(fitRasterToTextureLimit(4000, 20000, 8192)).toEqual({ width: 1638, height: 8192 });
  });
});

describe('fitRasterToByteLimit', () => {
  it('keeps an RGBA8 target within the configured logical byte budget', () => {
    const target = fitRasterToByteLimit(16_000, 12_000, 64 * 1024 * 1024);

    expect(target.width * target.height * 4).toBeLessThanOrEqual(64 * 1024 * 1024);
    expect(target.width / target.height).toBeCloseTo(4 / 3, 2);
  });

  it('also caps extremely thin images after the one-pixel minimum is applied', () => {
    expect(fitRasterToByteLimit(10_000, 1, 4)).toEqual({ width: 1, height: 1 });
  });
});
