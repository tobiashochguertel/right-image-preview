import { MediaSource, ReadMediaSourceOptions } from './media-source';
export type MediaKind = 'raster' | 'svg' | 'animated-image' | 'video' | 'unknown';
export interface MediaKindHints {
    kind?: MediaKind;
    mimeType?: string;
    href?: string;
    header?: Uint8Array | ArrayBuffer;
}
export interface DetectMediaKindOptions extends ReadMediaSourceOptions {
    kind?: MediaKind;
    mimeType?: string;
    href?: string;
    sniffBytes?: number;
}
export declare function resolveMediaKind(hints: MediaKindHints): MediaKind;
export declare function detectMediaKind(source: MediaSource, options?: DetectMediaKindOptions): Promise<MediaKind>;
export declare function sniffMediaKind(input: Uint8Array | ArrayBuffer): MediaKind | null;
