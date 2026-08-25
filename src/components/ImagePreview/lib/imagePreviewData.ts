import { resolvePreviewImages } from '../flattenGroupedImages';
import type { MediaSource } from '../core/media-source';
import type { ImageItem, ImagePreviewProps } from '../types';

export function normaliseImages(props: ImagePreviewProps): ImageItem[] {
  return resolvePreviewImages(props).images;
}

/**
 * Resolves the lightweight visual used by the minimap and thumbnail strip.
 * A renderer-neutral main `source` must never shadow an explicitly supplied
 * legacy `minimapSrc`; desktop hosts commonly provide both.
 */
export function resolveMinimapMediaSource(item: ImageItem): MediaSource {
  if (item.minimapSource) return item.minimapSource;
  if (item.minimapSrc) return { type: 'url', href: item.minimapSrc };
  return item.source ?? { type: 'url', href: item.src };
}

/**
 * Resolves only the bottom-strip visual. Explicit `null` is a host backpressure signal:
 * keep the tile empty until a generated thumbnail arrives and never fall back to the original.
 */
export function resolveThumbnailMediaSource(item: ImageItem): MediaSource | null {
  if (item.thumbnailSource !== undefined) return item.thumbnailSource;
  if (item.thumbnailSrc !== undefined) {
    return item.thumbnailSrc ? { type: 'url', href: item.thumbnailSrc } : null;
  }
  return resolveMinimapMediaSource(item);
}
