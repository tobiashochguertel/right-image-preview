import type { MediaSource } from '../../core/media-source';
import { useMediaSourceUrl } from '../../core/use-media-source-url';
import type { MediaStageTransformProps } from '../media-stage-types';

export interface RasterFallbackViewerProps extends MediaStageTransformProps {
  source: MediaSource;
  alt: string;
}

/** Native browser Raster fallback used only when the WebGL2 route is unsafe. */
export function RasterFallbackViewer(props: RasterFallbackViewerProps) {
  const { source, alt, transform, onDimensions, onPhaseChange, onError, onPresented } = props;
  const href = useMediaSourceUrl(source);
  return (
    <div data-rip-raster-fallback="" style={stageStyle}>
      <img
        src={href}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          onDimensions(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
          onPhaseChange('display-ready');
          onPresented();
        }}
        onError={() => onError(new Error('Unable to load Raster fallback source'))}
        style={{
          display: 'block',
          maxWidth: 'none',
          maxHeight: 'none',
          transform: transform.cssTransform,
          transformOrigin: 'center center',
        }}
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
