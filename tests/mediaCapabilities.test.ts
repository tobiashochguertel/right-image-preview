import { describe, expect, it } from 'vitest';

import { mediaCapabilitiesForKind } from '../src/components/ImagePreview/renderers/media-capabilities';

describe('mediaCapabilitiesForKind', () => {
  it('keeps raster and SVG transforms enabled', () => {
    expect(mediaCapabilitiesForKind('raster')).toMatchObject({
      zoom: true, nativeZoom: true, pan: true, rotate: true, flip: true, minimap: true,
    });
    expect(mediaCapabilitiesForKind('svg')).toMatchObject({ zoom: true, rotate: true, flip: true });
  });

  it('limits video and unknown commands', () => {
    expect(mediaCapabilitiesForKind('video')).toMatchObject({
      zoom: true, nativeZoom: false, pan: false, rotate: false, flip: false, minimap: false,
    });
    expect(mediaCapabilitiesForKind('unknown')).toMatchObject({
      zoom: false, nativeZoom: false, pan: false, rotate: false, flip: false, minimap: false,
    });
  });
});
