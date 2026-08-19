import { describe, expect, it } from 'vitest';
import {
  rememberRasterScreenHistory,
  selectRasterScreenHistoryPins,
} from '../src/components/ImagePreview/renderers/raster-webgl/rasterScreenHistory';

describe('raster Screen history', () => {
  it('keeps most-recent visits uniquely while excluding the new current image', () => {
    expect(rememberRasterScreenHistory(
      [
        { resourceKey: 'two', flatIndex: 2 },
        { resourceKey: 'one', flatIndex: 1 },
      ],
      { resourceKey: 'four', flatIndex: 4 },
      'two',
    )).toEqual([
      { resourceKey: 'four', flatIndex: 4 },
      { resourceKey: 'one', flatIndex: 1 },
    ]);
  });

  it('pins only resident Screen textures after reserving current and both immediate neighbors', () => {
    const pins = selectRasterScreenHistoryPins({
      enabled: true,
      resourceKey: 'current',
      history: [
        { resourceKey: 'four', flatIndex: 4 },
        { resourceKey: 'two', flatIndex: 2 },
        { resourceKey: 'evicted', flatIndex: 99 },
      ],
      residentTextures: [
        { resourceKey: 'four', quality: 'display', bytes: 30 },
        { resourceKey: 'two', quality: 'display', bytes: 40 },
        { resourceKey: 'evicted', quality: 'browse', bytes: 1 },
      ],
      budgetBytes: 180,
      currentReservedBytes: 80,
      immediateNeighborScreenBytes: 40,
    });
    expect(pins).toEqual([
      { resourceKey: 'four', flatIndex: 4, bytes: 30 },
    ]);
  });

  it('does not resurrect history when preload is disabled or the texture is absent', () => {
    expect(selectRasterScreenHistoryPins({
      enabled: false,
      resourceKey: 'current',
      history: [{ resourceKey: 'four', flatIndex: 4 }],
      residentTextures: [{ resourceKey: 'four', quality: 'display', bytes: 1 }],
      budgetBytes: 100,
      currentReservedBytes: 1,
      immediateNeighborScreenBytes: 1,
    })).toEqual([]);
    expect(selectRasterScreenHistoryPins({
      enabled: true,
      resourceKey: 'current',
      history: [{ resourceKey: 'missing', flatIndex: 4 }],
      residentTextures: [],
      budgetBytes: 100,
      currentReservedBytes: 1,
      immediateNeighborScreenBytes: 1,
    })).toEqual([]);
  });
});
