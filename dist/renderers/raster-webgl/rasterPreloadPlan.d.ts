import { MediaSource } from '../../core/media-source';
import { ImageItem } from '../../types';
import { RasterSize } from './rasterLod';
export type RasterPreloadRange = number | 'auto';
/** Minimum Screen-LOD protection under normal budget conditions. */
export declare const RASTER_SCREEN_FORWARD_MIN = 3;
export declare const RASTER_SCREEN_BACKWARD_MIN = 2;
export interface RasterPreloadSource {
    resourceKey: string;
    source: MediaSource;
    previewSource?: MediaSource;
    flatIndex?: number;
    knownSize?: RasterSize;
    side: 'forward' | 'backward';
    distance: number;
}
export type RasterNeighborLod = 'browse' | 'screen';
export interface RasterPlannedPreload extends RasterPreloadSource {
    lod: RasterNeighborLod;
    targetBox: RasterSize;
    estimatedBytes: number;
    priority: number;
}
export interface RasterPreloadPlanSnapshot {
    viewport: {
        cssWidth: number;
        cssHeight: number;
        dpr: number;
        pixelWidth: number;
        pixelHeight: number;
    };
    budgetBytes: number;
    reservedBytes: number;
    estimatedBytes: number;
    screenForwardIndexes: readonly number[];
    screenBackwardIndexes: readonly number[];
    browseForwardIndexes: readonly number[];
    browseBackwardIndexes: readonly number[];
    /** Existing, non-contiguous Screen textures retained from recently viewed images. */
    historyScreenIndexes: readonly number[];
    historyScreenBytes: number;
}
export interface RasterDynamicLodPlanOptions {
    candidates: readonly RasterPreloadSource[];
    viewport: {
        width: number;
        height: number;
        dpr: number;
    };
    budgetBytes: number;
    reservedBytes: number;
    maxTextureSize: number;
}
export interface RasterPreloadPlanOptions {
    images: readonly ImageItem[];
    currentIndex: number;
    direction: 1 | -1;
    range: RasterPreloadRange;
    maxCount: number;
    allowPreviewSource?: boolean;
}
/** Builds a direction-aware candidate pool. LOD and retained count are decided later by the viewport planner. */
export declare function buildRasterPreloadPlan({ images, currentIndex, direction, range, maxCount, allowPreviewSource, }: RasterPreloadPlanOptions): RasterPreloadSource[];
/**
 * Plans fixed, contiguous bands from the current image outward: a nearest Screen
 * core, then a Browse ring. Browse is never auto-upgraded to Screen later, so
 * the blue/violet meaning stays stable for the whole visit.
 */
export declare function planRasterNeighborLods({ candidates, viewport, budgetBytes, reservedBytes, maxTextureSize, }: RasterDynamicLodPlanOptions): {
    entries: RasterPlannedPreload[];
    snapshot: RasterPreloadPlanSnapshot;
};
export declare function estimateRasterTextureBytes(naturalSize: RasterSize | undefined, targetBox: RasterSize, maxTextureSize: number): number;
