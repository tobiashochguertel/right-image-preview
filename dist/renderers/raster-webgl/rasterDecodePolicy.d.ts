export type RasterDecodeWorkerSetting = number | 'auto';
export declare const RASTER_DECODE_WORKER_DEFAULT_MAX = 3;
export declare const RASTER_DECODE_WORKER_HARD_MAX = 3;
export declare const RASTER_DECODE_HEAVY_PIXEL_THRESHOLD = 80000000;
export interface ResolveRasterDecodeWorkerCountOptions {
    workers?: RasterDecodeWorkerSetting;
    maxWorkers?: number;
    hardwareConcurrency?: number;
}
/** Conservative decode concurrency: image codecs may already use internal threads. */
export declare function resolveRasterDecodeWorkerCount({ workers, maxWorkers, hardwareConcurrency, }?: ResolveRasterDecodeWorkerCountOptions): number;
export declare function isHeavyRasterDecode(naturalPixels: number | undefined): boolean;
