export type RasterDecodeWorkerSetting = number | 'auto';

export const RASTER_DECODE_WORKER_DEFAULT_MAX = 3;
export const RASTER_DECODE_WORKER_HARD_MAX = 3;
export const RASTER_DECODE_HEAVY_PIXEL_THRESHOLD = 80_000_000;

export interface ResolveRasterDecodeWorkerCountOptions {
  workers?: RasterDecodeWorkerSetting;
  maxWorkers?: number;
  hardwareConcurrency?: number;
}

/** Conservative decode concurrency: image codecs may already use internal threads. */
export function resolveRasterDecodeWorkerCount({
  workers = 'auto',
  maxWorkers = RASTER_DECODE_WORKER_DEFAULT_MAX,
  hardwareConcurrency = detectHardwareConcurrency(),
}: ResolveRasterDecodeWorkerCountOptions = {}): number {
  const safeMax = clampWorkerCount(maxWorkers);
  if (workers !== 'auto' && Number.isFinite(workers)) {
    return Math.min(safeMax, clampWorkerCount(workers));
  }
  const logicalThreads = Math.max(1, Math.floor(hardwareConcurrency || 1));
  const automatic = logicalThreads <= 4 ? 1 : logicalThreads <= 8 ? 2 : 3;
  return Math.min(safeMax, automatic);
}

export function isHeavyRasterDecode(naturalPixels: number | undefined): boolean {
  return Number.isFinite(naturalPixels) &&
    (naturalPixels ?? 0) >= RASTER_DECODE_HEAVY_PIXEL_THRESHOLD;
}

function clampWorkerCount(value: number): number {
  if (!Number.isFinite(value)) return RASTER_DECODE_WORKER_DEFAULT_MAX;
  return Math.max(1, Math.min(RASTER_DECODE_WORKER_HARD_MAX, Math.floor(value)));
}

function detectHardwareConcurrency(): number {
  if (typeof navigator === 'undefined') return 2;
  return navigator.hardwareConcurrency || 2;
}
