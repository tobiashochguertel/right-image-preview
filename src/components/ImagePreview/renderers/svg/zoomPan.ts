import type { CSSProperties } from 'react';
import type { MediaCapabilities } from '../../core/media-contract';
import type { TransformState } from '../../useImageTransform';

export const SVG_CAPABILITIES: Readonly<MediaCapabilities> = Object.freeze({
  zoom: true,
  nativeZoom: true,
  pan: true,
  rotate: true,
  flip: true,
  minimap: true,
});

export function svgTransformStyle(transform: TransformState): CSSProperties {
  return { transform: transform.cssTransform, transformOrigin: 'center center' };
}
