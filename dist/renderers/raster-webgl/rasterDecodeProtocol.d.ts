import { MediaDownloadProgress } from '../../core/media-source';
interface RasterDecodeWorkerRequestBase {
    id: number;
    resizeWidth?: number;
    resizeHeight?: number;
    fitWidth?: number;
    fitHeight?: number;
    maxTextureSize?: number;
}
export type RasterDecodeWorkerRequest = RasterDecodeWorkerRequestBase & ({
    blob: Blob;
    url?: never;
    contentLength?: never;
} | {
    blob?: never;
    url: string;
    contentLength?: number;
});
export interface RasterDecodeWorkerResponse {
    id: number;
    bitmap?: ImageBitmap;
    naturalWidth?: number;
    naturalHeight?: number;
    progress?: MediaDownloadProgress;
    error?: string;
}
export {};
