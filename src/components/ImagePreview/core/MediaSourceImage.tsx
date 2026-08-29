import type { ImgHTMLAttributes } from 'react';

import type { MediaSource } from './media-source';
import { useMediaSourceUrl } from './use-media-source-url';

export interface MediaSourceImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  source: MediaSource;
}

/** DOM image adapter for thumbnails/minimaps and native media renderers. */
export function MediaSourceImage({ source, ...props }: MediaSourceImageProps) {
  const href = useMediaSourceUrl(source);
  return <img {...props} src={href} />;
}
