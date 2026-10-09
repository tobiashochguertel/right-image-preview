import { ImgHTMLAttributes } from 'react';
import { MediaSource } from './media-source';
export interface MediaSourceImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    source: MediaSource;
}
/** DOM image adapter for thumbnails/minimaps and native media renderers. */
export declare function MediaSourceImage({ source, ...props }: MediaSourceImageProps): import("react/jsx-runtime").JSX.Element;
