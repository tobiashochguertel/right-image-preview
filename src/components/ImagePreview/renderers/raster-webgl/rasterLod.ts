export const RASTER_SCREEN_LOD_OVERSAMPLE = 1;
export const RASTER_BROWSE_LOD_SCALE = 0.6;
export const RASTER_FULL_RESOLUTION_SETTLE_MS = 300;

export interface RasterSize {
  width: number;
  height: number;
}

/** Exact byte count for an uncompressed RGBA8 texture. */
export function rgbaTextureBytes(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0;
  }
  return Math.ceil(width) * Math.ceil(height) * 4;
}

/** Fits natural pixels into a physical viewport box without upscaling. */
export function fitRasterToScreenLod(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  oversample = RASTER_SCREEN_LOD_OVERSAMPLE,
): RasterSize {
  const width = Math.max(1, Math.floor(naturalWidth));
  const height = Math.max(1, Math.floor(naturalHeight));
  const boxWidth = Math.max(1, viewportWidth * Math.max(1, oversample));
  const boxHeight = Math.max(1, viewportHeight * Math.max(1, oversample));
  const scale = Math.min(1, boxWidth / width, boxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function scaleRasterLodBox(box: RasterSize, scale = RASTER_BROWSE_LOD_SCALE): RasterSize {
  const safeScale = Math.max(0.1, Math.min(1, scale));
  return {
    width: Math.max(1, Math.round(box.width * safeScale)),
    height: Math.max(1, Math.round(box.height * safeScale)),
  };
}

/**
 * Fit-mode Screen already covers its physical viewport. Full decode is only
 * useful once zoom demand outgrows that resident texture; starting it earlier
 * can stall some WebViews on very large local JPEGs without improving pixels.
 */
export function needsRasterFullResolution(
  naturalSize: RasterSize,
  textureSize: RasterSize,
  transformScale: number,
  dpr: number,
): boolean {
  if (textureSize.width >= naturalSize.width && textureSize.height >= naturalSize.height) {
    return false;
  }
  const physicalScale = Math.max(0, transformScale) * Math.max(1, dpr);
  return (
    (textureSize.width < naturalSize.width &&
      naturalSize.width * physicalScale > textureSize.width * 1.01) ||
    (textureSize.height < naturalSize.height &&
      naturalSize.height * physicalScale > textureSize.height * 1.01)
  );
}
