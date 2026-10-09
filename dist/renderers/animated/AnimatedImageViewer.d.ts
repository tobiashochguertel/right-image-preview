import { MediaSource } from '../../core/media-source';
import { MediaStageTransformProps } from '../media-stage-types';
export interface AnimatedImageViewerProps extends MediaStageTransformProps {
    source: MediaSource;
    alt: string;
}
export declare function AnimatedImageViewer(props: AnimatedImageViewerProps): import("react/jsx-runtime").JSX.Element;
