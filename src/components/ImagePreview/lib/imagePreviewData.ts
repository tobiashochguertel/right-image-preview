import { resolvePreviewImages } from '../flattenGroupedImages';
import type { ImageItem, ImagePreviewProps } from '../types';

export function normaliseImages(props: ImagePreviewProps): ImageItem[] {
  return resolvePreviewImages(props).images;
}
