import { MediaSource } from '../core/media-source';
import { ImageItem, ImagePreviewProps } from '../types';
export declare function normaliseImages(props: ImagePreviewProps): ImageItem[];
/**
 * Resolves the lightweight visual used by the minimap and thumbnail strip.
 * A renderer-neutral main `source` must never shadow an explicitly supplied
 * legacy `minimapSrc`; desktop hosts commonly provide both.
 */
export declare function resolveMinimapMediaSource(item: ImageItem): MediaSource;
/**
 * Resolves only the bottom-strip visual. Explicit `null` is a host backpressure signal:
 * keep the tile empty until a generated thumbnail arrives and never fall back to the original.
 */
export declare function resolveThumbnailMediaSource(item: ImageItem): MediaSource | null;
