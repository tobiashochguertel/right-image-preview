import type { MediaSource } from '../../core/media-source';
import { useMediaSourceUrl } from '../../core/use-media-source-url';
import type { MediaStageTransformProps } from '../media-stage-types';
import { videoTransformStyle } from './zoomPan';

export interface VideoViewerProps extends MediaStageTransformProps {
  source: MediaSource;
  onPlaybackChange?(playing: boolean): void;
}

export function VideoViewer(props: VideoViewerProps) {
  const {
    source,
    transform,
    onDimensions,
    onPhaseChange,
    onError,
    onPresented,
    onPlaybackChange,
  } = props;
  const href = useMediaSourceUrl(source);
  return (
    <div data-rip-video-viewer="" style={stageStyle}>
      <video
        src={href}
        controls
        playsInline
        onPlay={() => onPlaybackChange?.(true)}
        onPause={() => onPlaybackChange?.(false)}
        onEnded={() => onPlaybackChange?.(false)}
        onLoadedData={(event) => {
          onDimensions(event.currentTarget.videoWidth, event.currentTarget.videoHeight);
          onPhaseChange('display-ready');
          onPresented();
        }}
        onError={() => onError(new Error('Unable to load video source'))}
        style={{ display: 'block', maxWidth: 'none', maxHeight: 'none', ...videoTransformStyle(transform) }}
      />
    </div>
  );
}

const stageStyle = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', overflow: 'hidden',
} as const;
