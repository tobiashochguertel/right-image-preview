import { MediaSource } from '../../core/media-source';
import { MediaStageTransformProps } from '../media-stage-types';
export interface VideoViewerProps extends MediaStageTransformProps {
    source: MediaSource;
    onPlaybackChange?(playing: boolean): void;
}
export declare function VideoViewer(props: VideoViewerProps): import("react/jsx-runtime").JSX.Element;
