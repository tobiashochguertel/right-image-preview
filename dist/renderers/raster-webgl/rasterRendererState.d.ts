import { RasterFullDecodeStatus } from './rasterLod';
export declare const RASTER_SAFE_TEXTURE_EDGE_RATIO = 0.9;
export type RasterRendererKind = 'webgl2' | 'dom-image';
export type RasterFallbackReason = 'webgl2-unavailable' | 'renderer-initialization-failed' | 'texture-too-large' | 'texture-budget-exceeded' | 'texture-create-failed' | 'texture-upload-failed' | 'context-lost' | 'context-restore-failed' | 'texture-invalid';
export type RasterContextStatus = 'healthy' | 'lost' | 'restored' | 'restore-failed';
export type RasterDecodeSourceKind = 'original' | 'preview';
export interface RasterRendererState {
    resourceKey?: string;
    renderer: RasterRendererKind;
    routeReason: 'fast-path' | 'fallback';
    fallbackReason?: RasterFallbackReason;
    webgl2Available: boolean;
    maxTextureSize?: number;
    safeTextureSize?: number;
    sourceWidth?: number;
    sourceHeight?: number;
    contextStatus: RasterContextStatus;
    decodeSource?: RasterDecodeSourceKind;
    fullDecodeStatus?: RasterFullDecodeStatus;
    fullDecodeEstimatedBytes?: number;
    fullDecodeLimitBytes?: number;
}
export interface RasterRendererRouteInput {
    webgl2Available: boolean;
    maxTextureSize?: number;
    naturalSize?: {
        width: number;
        height: number;
    };
}
export interface RasterRendererRoute {
    renderer: RasterRendererKind;
    fallbackReason?: RasterFallbackReason;
    safeTextureSize?: number;
}
export declare function resolveRasterRendererRoute(input: RasterRendererRouteInput): RasterRendererRoute;
export declare class RasterRendererFallbackError extends Error {
    readonly reason: RasterFallbackReason;
    readonly cause?: unknown;
    readonly naturalSize?: {
        width: number;
        height: number;
    };
    constructor(reason: RasterFallbackReason, message: string, cause?: unknown, naturalSize?: {
        width: number;
        height: number;
    });
}
export declare function rasterFallbackNaturalSize(cause: unknown): {
    width: number;
    height: number;
} | undefined;
export declare function rasterFallbackReason(cause: unknown): RasterFallbackReason | null;
