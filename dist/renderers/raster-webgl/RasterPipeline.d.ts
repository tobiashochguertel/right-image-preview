import { MediaDownloadProgress, MediaSource } from '../../core/media-source';
import { TextureCache } from './TextureCache';
import { WebGLRasterRenderer } from './WebGLRasterRenderer';
import { RasterTextureEntry, RasterTextureQuality } from './types';
import { RasterSize } from './rasterLod';
import { RasterDecodeWorkerPool } from './RasterDecodeWorkerPool';
import { RasterDecodeWorkerSetting } from './rasterDecodePolicy';
import { RasterContextStatus } from './rasterRendererState';
export declare const DEFAULT_RASTER_TEXTURE_BUDGET_BYTES: number;
export interface RasterRuntimeSnapshot {
    downloads: Readonly<Record<string, MediaDownloadProgress>>;
    residentResourceKeys: readonly string[];
    residentTextures: readonly RasterResidentTextureSnapshot[];
    cache: {
        count: number;
        usedBytes: number;
        reservedBytes: number;
        maxBytes: number;
        oversubscribed: boolean;
    };
    context: {
        status: RasterContextStatus;
        generation: number;
    };
}
export interface RasterResidentTextureSnapshot {
    resourceKey: string;
    quality: RasterTextureQuality;
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
    bytes: number;
}
export interface RasterPipelineOptions {
    decodeWorkers?: RasterDecodeWorkerSetting;
    decodeWorkerMax?: number;
    /** Test/host injection point; normal consumers use the Worker settings above. */
    decodePool?: RasterDecodeWorkerPool;
    fullDecodeMaxBytes?: number;
}
export declare class RasterFullDecodeBlockedError extends Error {
    readonly estimatedBytes: number;
    readonly limitBytes: number;
    constructor(estimatedBytes: number, limitBytes: number);
}
export declare class RasterPipeline {
    readonly renderer: WebGLRasterRenderer;
    readonly cache: TextureCache;
    private readonly inFlight;
    private readonly decodePool;
    private readonly uploadQueue;
    private disposed;
    private readonly unsubscribeContext;
    private contextGeneration;
    private contextLost;
    private contextStatus;
    private readonly listeners;
    private readonly downloads;
    /** Only the foreground original is retained between Screen and Full LOD. */
    private foregroundBlob;
    private displayGeneration;
    private displayBox;
    private activeResourceKey;
    private requestSequence;
    private readonly fullDecodeMaxBytes;
    constructor(renderer: WebGLRasterRenderer, budgetBytes?: number, options?: RasterPipelineOptions);
    subscribe(listener: () => void): () => void;
    get generation(): number;
    get isContextLost(): boolean;
    get currentContextStatus(): RasterContextStatus;
    runtimeSnapshot(): RasterRuntimeSnapshot;
    /** Reconciles resident neighbor LODs with the current image-stage viewport. */
    reconcileViewportLods(screenBox: RasterSize, browseBox: RasterSize, keepResourceKey?: string): void;
    retainOnly(keys: readonly string[]): void;
    release(key: string): void;
    setBudgetBytes(budgetBytes: number): void;
    /** Cancels background work removed by the latest Screen/Browse corridor plan. */
    reconcileDecodePlan(desiredTextureKeys: readonly string[]): void;
    prepare(resourceKey: string, source: MediaSource, quality: RasterTextureQuality, naturalSize?: {
        width: number;
        height: number;
    }, priority?: number, screenBox?: RasterSize): Promise<RasterTextureEntry>;
    dispose(): void;
    private createEntry;
    private activateResource;
    private cancelAllInFlight;
    private cancelInFlight;
    private cachedEntryMeetsMinimum;
    private cachedEntryMatchesTarget;
    private emit;
}
export declare function fitRasterToTextureLimit(width: number, height: number, maxTextureSize: number): {
    width: number;
    height: number;
};
export declare function fitRasterToByteLimit(width: number, height: number, maxBytes: number): {
    width: number;
    height: number;
};
