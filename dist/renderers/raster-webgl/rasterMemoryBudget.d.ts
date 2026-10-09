export declare const RASTER_TEXTURE_BUDGET_HD_BYTES: number;
export declare const RASTER_TEXTURE_BUDGET_FHD_BYTES: number;
export declare const RASTER_TEXTURE_BUDGET_QHD_BYTES: number;
export declare const RASTER_TEXTURE_BUDGET_4K_BYTES: number;
export declare const RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES: number;
export interface RasterDisplayMetrics {
    width: number;
    height: number;
    dpr: number;
}
export interface RasterHardwareProfile {
    totalMemoryBytes: number;
    availableMemoryBytes: number;
    /** OS-reported GPU working-set/budget guidance when the Tauri host can obtain it. */
    gpuBudgetBytes?: number;
}
/**
 * Conservative GPU-texture budget inferred from physical display pixels.
 * Browsers do not expose free VRAM, so this is only a deterministic default;
 * `preloadMemoryBudgetBytes` remains the authoritative host override.
 */
export declare function suggestRasterTextureBudgetBytes({ width, height, dpr, }: RasterDisplayMetrics): number;
/** Device-aware host policy for Tauri/native shells. Explicit byte props still win. */
export declare function suggestRasterHardwareTextureBudgetBytes({ totalMemoryBytes, availableMemoryBytes, gpuBudgetBytes, }: RasterHardwareProfile): number;
export declare function detectRasterTextureBudgetBytes(): number;
