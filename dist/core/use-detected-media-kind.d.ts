import { MediaKind } from './media-kind';
import { MediaSource } from './media-source';
export interface UseDetectedMediaKindOptions {
    source: MediaSource;
    kind?: MediaKind;
    mimeType?: string;
    href?: string;
    fileName?: string;
}
export interface DetectedMediaKindState {
    kind: MediaKind;
    pending: boolean;
}
/**
 * Resolves cheap host/MIME/name hints synchronously, then sniffs ambiguous bytes.
 * A stale detection can never overwrite the kind of a newer source.
 */
export declare function useDetectedMediaKind(options: UseDetectedMediaKindOptions): DetectedMediaKindState;
