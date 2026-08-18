import type { MediaCapabilities } from '../../core/media-contract';

export const RASTER_WEBGL_CAPABILITIES: Readonly<MediaCapabilities> = Object.freeze({
  zoom: true,
  nativeZoom: true,
  pan: true,
  rotate: true,
  flip: true,
  minimap: true,
});
