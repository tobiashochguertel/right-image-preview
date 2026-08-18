import type { CSSProperties } from 'react';
import type { MediaCapabilities } from '../../core/media-contract';
import type { TransformState } from '../../useImageTransform';

export const ANIMATED_IMAGE_CAPABILITIES: Readonly<MediaCapabilities> = Object.freeze({
  zoom: true,
  nativeZoom: true,
  pan: true,
  rotate: true,
  flip: true,
  minimap: false,
});

export function animatedTransformStyle(transform: TransformState): CSSProperties {
  return { transform: transform.cssTransform, transformOrigin: 'center center' };
}
