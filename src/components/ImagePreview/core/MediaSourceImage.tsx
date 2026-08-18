import type { ImgHTMLAttributes } from 'react';

import type { MediaSource } from './media-source';
import { useMediaSourceUrl } from './use-media-source-url';

export interface MediaSourceImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  source: MediaSource;
}

/** DOM image adapter for thumbnails, minimaps, SVG, and animated media—not Raster main content. */
export function MediaSourceImage({ source, ...props }: MediaSourceImageProps) {
  const href = useMediaSourceUrl(source);
  return <img {...props} src={href} />;
}
