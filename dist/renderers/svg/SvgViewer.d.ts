import { MediaSource } from '../../core/media-source';
import { MediaStageTransformProps } from '../media-stage-types';
export interface SvgViewerProps extends MediaStageTransformProps {
    source: MediaSource;
    alt: string;
}
export declare function SvgViewer(props: SvgViewerProps): import("react/jsx-runtime").JSX.Element;
