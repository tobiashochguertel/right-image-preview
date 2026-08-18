import type { CSSProperties } from 'react';
import type { MediaCapabilities } from '../../core/media-contract';
import type { TransformState } from '../../useImageTransform';

export const VIDEO_CAPABILITIES: Readonly<MediaCapabilities> = Object.freeze({
  zoom: true,
  nativeZoom: false,
  pan: false,
  rotate: false,
  flip: false,
  minimap: false,
});

export function videoTransformStyle(transform: TransformState): CSSProperties {
  return { transform: transform.cssTransform, transformOrigin: 'center center' };
}
