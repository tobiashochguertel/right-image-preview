import type { MediaSource } from '../../core/media-source';
import { useMediaSourceUrl } from '../../core/use-media-source-url';
import type { MediaStageTransformProps } from '../media-stage-types';

export interface RasterFallbackViewerProps extends MediaStageTransformProps {
  source: MediaSource;
  alt: string;
  /** Full-image dimensions retained when `source` is a bounded Preview. */
  naturalSize?: { width: number; height: number };
}

/** Native browser Raster fallback used only when the WebGL2 route is unsafe. */
export function RasterFallbackViewer(props: RasterFallbackViewerProps) {
  const {
    source,
    alt,
    naturalSize,
    transform,
    onDimensions,
    onPhaseChange,
    onError,
    onPresented,
  } = props;
  const href = useMediaSourceUrl(source);
  return (
    <div data-rip-raster-fallback="" style={stageStyle}>
      <img
        src={href}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          onDimensions(
            naturalSize?.width ?? event.currentTarget.naturalWidth,
            naturalSize?.height ?? event.currentTarget.naturalHeight,
          );
          onPhaseChange('display-ready');
          onPresented();
        }}
        onError={() => onError(new Error('Unable to load Raster fallback source'))}
        style={
          naturalSize && (naturalSize.width > 8192 || naturalSize.height > 8192)
            ? {
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }
            : {
                display: 'block',
                maxWidth: 'none',
                maxHeight: 'none',
                width: naturalSize?.width,
                height: naturalSize?.height,
                transform: transform.cssTransform,
                transformOrigin: 'center center',
              }
        }
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
