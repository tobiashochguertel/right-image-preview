import { useMediaSourceUrl } from '../../core/use-media-source-url';
import type { MediaSource } from '../../core/media-source';
import type { MediaStageTransformProps } from '../media-stage-types';
import { svgTransformStyle } from './zoomPan';

export interface SvgViewerProps extends MediaStageTransformProps {
  source: MediaSource;
  alt: string;
}

export function SvgViewer(props: SvgViewerProps) {
  const { source, alt, transform, onDimensions, onPhaseChange, onError, onPresented } = props;
  const href = useMediaSourceUrl(source);
  return (
    <div data-rip-svg-viewer="" style={stageStyle}>
      <img
        src={href}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          onDimensions(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
          onPhaseChange('display-ready');
          onPresented();
        }}
        onError={() => onError(new Error('Unable to load SVG source'))}
        style={{ display: 'block', maxWidth: 'none', maxHeight: 'none', ...svgTransformStyle(transform) }}
      />
    </div>
  );
}

const stageStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  pointerEvents: 'none',
} as const;
