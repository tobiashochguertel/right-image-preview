import { describe, expect, it } from 'vitest';

import {
  RASTER_FULL_DECODE_MAX_BYTES,
  RASTER_PREVIEW_MAX_EDGE,
  capRasterSizeToEdge,
  fitRasterToScreenLod,
  needsRasterFullResolution,
  resolveRasterFullDecodePolicy,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterLod';
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

  it('caps Screen and Browse-sized work at the 4096px Preview edge', () => {
    expect(fitRasterToScreenLod(12_000, 8000, 7680, 4320)).toEqual({
      width: 4096,
      height: 2731,
    });
    expect(capRasterSizeToEdge({ width: 7680, height: 4320 })).toEqual({
      width: RASTER_PREVIEW_MAX_EDGE,
      height: 2304,
    });
  });

  it('blocks Full decode above 1 GiB without allocating a bitmap', () => {
    expect(resolveRasterFullDecodePolicy({ width: 16_384, height: 16_384 }))
      .toMatchObject({
        status: 'eligible',
        allowed: true,
        estimatedBytes: RASTER_FULL_DECODE_MAX_BYTES,
      });
    expect(resolveRasterFullDecodePolicy({ width: 16_385, height: 16_384 }))
      .toMatchObject({
        status: 'blocked',
        allowed: false,
        estimatedBytes: RASTER_FULL_DECODE_MAX_BYTES + 65_536,
      });
    expect(resolveRasterFullDecodePolicy({ width: Number.MAX_VALUE, height: 100 }))
      .toMatchObject({
        status: 'blocked',
        estimatedBytes: Number.MAX_SAFE_INTEGER,
      });
  });

  it('promotes to Full only after zoom outgrows the Screen texture', () => {
    expect(needsRasterFullResolution(
      { width: 7000, height: 4000 },
      { width: 5120, height: 2880 },
      0.36,
      2,
    )).toBe(false);
    expect(needsRasterFullResolution(
      { width: 7000, height: 4000 },
      { width: 5120, height: 2880 },
      1,
      2,
    )).toBe(true);
    expect(needsRasterFullResolution(
      { width: 1200, height: 800 },
      { width: 1200, height: 800 },
      1,
      2,
    )).toBe(false);
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
