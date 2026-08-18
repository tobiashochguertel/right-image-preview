import { describe, expect, it } from 'vitest';

import { fitRasterToTextureLimit } from '../src/components/ImagePreview/renderers/raster-webgl/RasterPipeline';

describe('fitRasterToTextureLimit', () => {
  it('keeps supported dimensions unchanged', () => {
    expect(fitRasterToTextureLimit(4000, 3000, 8192)).toEqual({ width: 4000, height: 3000 });
  });

  it('preserves aspect ratio while clamping the longest edge', () => {
    expect(fitRasterToTextureLimit(16000, 12000, 8192)).toEqual({ width: 8192, height: 6144 });
    expect(fitRasterToTextureLimit(4000, 20000, 8192)).toEqual({ width: 1638, height: 8192 });
  });
});
