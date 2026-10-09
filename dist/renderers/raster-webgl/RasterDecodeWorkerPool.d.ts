import { MediaDownloadProgress } from '../../core/media-source';
import { RasterSize } from './rasterLod';
import { RasterDecodeWorkerRequest, RasterDecodeWorkerResponse } from './rasterDecodeProtocol';
import { RasterDecodeWorkerSetting } from './rasterDecodePolicy';
export interface RasterDecodeRequest {
    key: string;
    blob?: Blob;
    url?: {
        href: string;
        contentLength?: number;
    };
    onProgress?: (progress: MediaDownloadProgress) => void;
    targetSize?: RasterSize;
    fitBox?: RasterSize;
    maxTextureSize?: number;
    naturalPixels?: number;
    priority: number;
    /** Foreground work may hard-preempt lower-priority running decodes. */
    foreground?: boolean;
}
export interface RasterDecodeResult {
    bitmap: ImageBitmap;
    naturalSize?: RasterSize;
}
export interface RasterDecodeWorkerLike {
    onmessage: ((event: MessageEvent<RasterDecodeWorkerResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage(message: RasterDecodeWorkerRequest): void;
    terminate(): void;
}
export interface RasterDecodeWorkerPoolOptions {
    workers?: RasterDecodeWorkerSetting;
    maxWorkers?: number;
    hardwareConcurrency?: number;
    workerFactory?: () => RasterDecodeWorkerLike;
    inlineDecode?: (request: RasterDecodeRequest) => Promise<{
        bitmap: ImageBitmap;
        naturalSize?: RasterSize;
    }>;
}
/**
 * Main-thread-owned scheduler. Workers execute one decode at a time and never own queues.
 * Ultra-large natural images are exclusive so decoder working sets remain bounded.
 */
export declare class RasterDecodeWorkerPool {
    readonly workerCount: number;
    private readonly slots;
    private readonly pending;
    private readonly workerFactory;
    private readonly inlineDecode;
    private inlineRunning;
    private nextId;
    private sequence;
    private disposed;
    constructor(options?: RasterDecodeWorkerPoolOptions);
    decode(request: RasterDecodeRequest): Promise<RasterDecodeResult>;
    promote(key: string, priority: number, foreground?: boolean): void;
    /** Queued work is removed; a hard running cancel terminates and recreates only its slot. */
    cancel(key: string, hard?: boolean): boolean;
    dispose(): void;
    private drain;
    private drainInline;
    private runOnWorker;
    private replaceWorker;
    private onWorkerMessage;
    private preemptLowerPriority;
    private terminateRunning;
    private activeJobs;
    private hasIdleWorker;
    private softCancel;
    private resolveJob;
    private rejectJob;
    private sortPending;
}
