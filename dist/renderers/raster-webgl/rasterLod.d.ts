export declare const RASTER_SCREEN_LOD_OVERSAMPLE = 1;
export declare const RASTER_BROWSE_LOD_SCALE = 0.6;
export declare const RASTER_FULL_RESOLUTION_SETTLE_MS = 300;
export declare const RASTER_PREVIEW_MAX_EDGE = 4096;
export declare const RASTER_FULL_DECODE_MAX_BYTES: number;
export interface RasterSize {
    width: number;
    height: number;
}
/** Conservative byte count for an uncompressed RGBA8 bitmap/texture. */
export declare function rgbaTextureBytes(width: number, height: number): number;
/** Fits natural pixels into a physical viewport box without upscaling. */
export declare function fitRasterToScreenLod(naturalWidth: number, naturalHeight: number, viewportWidth: number, viewportHeight: number, oversample?: number, maxEdge?: number): RasterSize;
export type RasterFullDecodeStatus = 'eligible' | 'blocked' | 'unknown';
export interface RasterFullDecodePolicy {
    status: RasterFullDecodeStatus;
    allowed: boolean;
    estimatedBytes?: number;
    limitBytes: number;
}
/** Decides Full decode admission from metadata; it never probes by allocating a bitmap. */
export declare function resolveRasterFullDecodePolicy(naturalSize: RasterSize | undefined, limitBytes?: number): RasterFullDecodePolicy;
export declare function normalizeRasterFullDecodeMaxBytes(value: number): number;
export declare function scaleRasterLodBox(box: RasterSize, scale?: number): RasterSize;
export declare function capRasterSizeToEdge(size: RasterSize, maxEdge?: number): RasterSize;
/**
 * Fit-mode Screen already covers its physical viewport. Full decode is only
 * useful once zoom demand outgrows that resident texture; starting it earlier
 * can stall some WebViews on very large local JPEGs without improving pixels.
 */
export declare function needsRasterFullResolution(naturalSize: RasterSize, textureSize: RasterSize, transformScale: number, dpr: number): boolean;
