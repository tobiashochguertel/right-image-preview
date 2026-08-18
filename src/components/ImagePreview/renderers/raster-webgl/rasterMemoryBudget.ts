const MIB = 1024 * 1024;

export const RASTER_TEXTURE_BUDGET_HD_BYTES = 192 * MIB;
export const RASTER_TEXTURE_BUDGET_FHD_BYTES = 256 * MIB;
export const RASTER_TEXTURE_BUDGET_QHD_BYTES = 384 * MIB;
export const RASTER_TEXTURE_BUDGET_4K_BYTES = 512 * MIB;
export const RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES = 768 * MIB;

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
export function suggestRasterTextureBudgetBytes({
  width,
  height,
  dpr,
}: RasterDisplayMetrics): number {
  const physicalPixels = Math.max(1, width) * Math.max(1, height) * Math.max(1, dpr) ** 2;
  if (physicalPixels <= 1_500_000) return RASTER_TEXTURE_BUDGET_HD_BYTES;
  if (physicalPixels <= 2_600_000) return RASTER_TEXTURE_BUDGET_FHD_BYTES;
  if (physicalPixels <= 5_000_000) return RASTER_TEXTURE_BUDGET_QHD_BYTES;
  // macOS may expose a 4K panel's scaled backing surface as 5120×2880.
  // Keep both native 4K and that high-DPI backing mode in the 512 MiB tier.
  if (physicalPixels <= 16_000_000) return RASTER_TEXTURE_BUDGET_4K_BYTES;
  return RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES;
}

/** Device-aware host policy for Tauri/native shells. Explicit byte props still win. */
export function suggestRasterHardwareTextureBudgetBytes({
  totalMemoryBytes,
  availableMemoryBytes,
  gpuBudgetBytes,
}: RasterHardwareProfile): number {
  const ramTier = memoryCapacityTier(totalMemoryBytes);
  const gpuTier = gpuBudgetBytes && gpuBudgetBytes > 0
    ? gpuCapacityTier(gpuBudgetBytes)
    : RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES;
  const result = Math.min(ramTier, gpuTier);
  const pressure = availableMemoryBytes / Math.max(1, totalMemoryBytes);
  const tiers = [
    RASTER_TEXTURE_BUDGET_HD_BYTES,
    RASTER_TEXTURE_BUDGET_FHD_BYTES,
    RASTER_TEXTURE_BUDGET_QHD_BYTES,
    RASTER_TEXTURE_BUDGET_4K_BYTES,
    RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES,
  ];
  const downgrade = pressure < 0.08 ? 2 : pressure < 0.15 ? 1 : 0;
  const index = Math.max(0, tiers.indexOf(result) - downgrade);
  return tiers[index];
}

function gpuCapacityTier(bytes: number): number {
  const gib = Math.max(0, bytes) / (1024 ** 3);
  if (gib <= 2) return RASTER_TEXTURE_BUDGET_HD_BYTES;
  if (gib <= 4) return RASTER_TEXTURE_BUDGET_FHD_BYTES;
  if (gib <= 6) return RASTER_TEXTURE_BUDGET_QHD_BYTES;
  if (gib <= 10) return RASTER_TEXTURE_BUDGET_4K_BYTES;
  return RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES;
}

function memoryCapacityTier(bytes: number): number {
  const gib = Math.max(0, bytes) / (1024 ** 3);
  if (gib <= 8) return RASTER_TEXTURE_BUDGET_HD_BYTES;
  if (gib <= 16) return RASTER_TEXTURE_BUDGET_FHD_BYTES;
  if (gib <= 32) return RASTER_TEXTURE_BUDGET_QHD_BYTES;
  if (gib <= 64) return RASTER_TEXTURE_BUDGET_4K_BYTES;
  return RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES;
}

export function detectRasterTextureBudgetBytes(): number {
  if (typeof window === 'undefined' || typeof screen === 'undefined') {
    return RASTER_TEXTURE_BUDGET_QHD_BYTES;
  }
  return suggestRasterTextureBudgetBytes({
    width: screen.width || window.innerWidth || 1,
    height: screen.height || window.innerHeight || 1,
    dpr: window.devicePixelRatio || 1,
  });
}
