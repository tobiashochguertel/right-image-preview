export type MediaSource = {
    type: 'url';
    href: string;
    /**
     * Trusted source size supplied by the host when a custom protocol (for
     * example Tauri `asset:`) cannot expose Content-Length to fetch.
     */
    contentLength?: number;
} | {
    type: 'blob';
    blob: Blob;
    mimeType?: string;
} | {
    type: 'bytes';
    data: ArrayBuffer;
    mimeType?: string;
};
export interface MediaSourceInput {
    source?: MediaSource;
    /** Legacy URL input. `source` wins when both are present. */
    src?: string;
}
export interface MediaSourceUrlLease {
    href: string;
    /** True only when this lease created the object URL. */
    owned: boolean;
    dispose(): void;
}
export interface ObjectUrlApi {
    createObjectURL(blob: Blob): string;
    revokeObjectURL(href: string): void;
}
export interface ReadMediaSourceOptions {
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    /** Throttled transfer progress for the complete media body. */
    onProgress?: (progress: MediaDownloadProgress) => void;
}
export interface MediaDownloadProgress {
    loadedBytes: number;
    /** Present only when the response exposes a trustworthy Content-Length. */
    totalBytes?: number;
    /** 0–1 when totalBytes is known; omitted for an indeterminate transfer. */
    progress?: number;
    complete: boolean;
}
export declare function resolveMediaSource(input: MediaSourceInput): MediaSource | null;
export declare function mediaSourceMimeType(source: MediaSource): string | undefined;
export declare function createMediaSourceUrlLease(source: MediaSource, objectUrlApi?: ObjectUrlApi): MediaSourceUrlLease;
/**
 * Returns a decode-ready Blob without copying Blob inputs. URL sources are fetched;
 * byte sources necessarily allocate one Blob wrapper at this API boundary.
 */
export declare function acquireMediaBlob(source: MediaSource, options?: ReadMediaSourceOptions): Promise<Blob>;
/** Read only the prefix needed by format sniffing. */
export declare function readMediaSourcePrefix(source: MediaSource, maxBytes?: number, options?: ReadMediaSourceOptions): Promise<Uint8Array>;
