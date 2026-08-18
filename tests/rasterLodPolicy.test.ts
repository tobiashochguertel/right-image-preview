import { describe, expect, it } from 'vitest';

import { fitRasterToScreenLod } from '../src/components/ImagePreview/renderers/raster-webgl/rasterLod';
import { readRasterNaturalSize } from '../src/components/ImagePreview/renderers/raster-webgl/rasterDimensions';
import {
  RASTER_TEXTURE_BUDGET_4K_BYTES,
  RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES,
  RASTER_TEXTURE_BUDGET_FHD_BYTES,
  RASTER_TEXTURE_BUDGET_HD_BYTES,
  RASTER_TEXTURE_BUDGET_QHD_BYTES,
  suggestRasterHardwareTextureBudgetBytes,
  suggestRasterTextureBudgetBytes,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterMemoryBudget';

describe('Raster LOD policy', () => {
  it('decodes only the pixels needed to fill the physical viewport', () => {
    expect(fitRasterToScreenLod(7000, 4000, 3840, 2160)).toEqual({
      width: 3780,
      height: 2160,
    });
    expect(fitRasterToScreenLod(1200, 800, 3840, 2160)).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it('derives a conservative Tauri hardware budget and backs off under RAM pressure', () => {
    const gib = 1024 ** 3;
    expect(suggestRasterHardwareTextureBudgetBytes({
      totalMemoryBytes: 64 * gib,
      availableMemoryBytes: 32 * gib,
      gpuBudgetBytes: 20 * gib,
    })).toBe(RASTER_TEXTURE_BUDGET_4K_BYTES);
    expect(suggestRasterHardwareTextureBudgetBytes({
      totalMemoryBytes: 64 * gib,
      availableMemoryBytes: 6 * gib,
      gpuBudgetBytes: 20 * gib,
    })).toBe(RASTER_TEXTURE_BUDGET_QHD_BYTES);
  });

  it('uses deterministic display tiers with 512 MiB for 4K', () => {
    const budget = (width: number, height: number, dpr = 1) =>
      suggestRasterTextureBudgetBytes({ width, height, dpr });
    expect(budget(1366, 768)).toBe(RASTER_TEXTURE_BUDGET_HD_BYTES);
    expect(budget(1920, 1080)).toBe(RASTER_TEXTURE_BUDGET_FHD_BYTES);
    expect(budget(2560, 1440)).toBe(RASTER_TEXTURE_BUDGET_QHD_BYTES);
    expect(budget(3840, 2160)).toBe(RASTER_TEXTURE_BUDGET_4K_BYTES);
    expect(budget(1920, 1080, 2)).toBe(RASTER_TEXTURE_BUDGET_4K_BYTES);
    expect(budget(5120, 2880)).toBe(RASTER_TEXTURE_BUDGET_4K_BYTES);
    expect(budget(6016, 3384)).toBe(RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES);
  });

  it('reads JPEG dimensions before bitmap decode', async () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11,
      0x08, 0x0f, 0xa0, 0x1b, 0x58,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xd9,
    ]);
    expect(await readRasterNaturalSize(new Blob([jpeg], { type: 'image/jpeg' }))).toEqual({
      width: 7000,
      height: 4000,
    });
  });
});
