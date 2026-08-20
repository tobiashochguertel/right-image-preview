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
