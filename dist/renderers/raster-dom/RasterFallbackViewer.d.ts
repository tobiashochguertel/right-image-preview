import { MediaSource } from '../../core/media-source';
import { MediaStageTransformProps } from '../media-stage-types';
export interface RasterFallbackViewerProps extends MediaStageTransformProps {
    source: MediaSource;
    alt: string;
    /** Full-image dimensions retained when `source` is a bounded Preview. */
    naturalSize?: {
        width: number;
        height: number;
    };
}
/** Native browser Raster fallback used only when the WebGL2 route is unsafe. */
export declare function RasterFallbackViewer(props: RasterFallbackViewerProps): import("react/jsx-runtime").JSX.Element;
