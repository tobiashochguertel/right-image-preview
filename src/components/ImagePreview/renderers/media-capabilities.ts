import { NO_MEDIA_CAPABILITIES, type MediaCapabilities } from '../core/media-contract';
import type { MediaKind } from '../core/media-kind';
import { ANIMATED_IMAGE_CAPABILITIES } from './animated/zoomPan';
import { RASTER_WEBGL_CAPABILITIES } from './raster-webgl/zoomPan';
import { SVG_CAPABILITIES } from './svg/zoomPan';
import { VIDEO_CAPABILITIES } from './video/zoomPan';

export function mediaCapabilitiesForKind(kind: MediaKind): Readonly<MediaCapabilities> {
  switch (kind) {
    case 'raster': return RASTER_WEBGL_CAPABILITIES;
    case 'svg': return SVG_CAPABILITIES;
    case 'animated-image': return ANIMATED_IMAGE_CAPABILITIES;
    case 'video': return VIDEO_CAPABILITIES;
    default: return NO_MEDIA_CAPABILITIES;
  }
}
