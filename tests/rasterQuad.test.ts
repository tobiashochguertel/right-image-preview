import { describe, expect, it } from 'vitest';

import { buildRasterQuad } from '../src/components/ImagePreview/renderers/raster-webgl/rasterQuad';

describe('buildRasterQuad', () => {
  it('maps a centred image from screen pixels into clip space', () => {
    const vertices = buildRasterQuad(
      100,
      50,
      { width: 200, height: 100, dpr: 2 },
      { scale: 1, translateX: 0, translateY: 0, rotation: 0, flipH: false, flipV: false },
    );

    expect([...vertices]).toEqual([
      -0.5, 0.5, 0, 0,
      0.5, 0.5, 1, 0,
      -0.5, -0.5, 0, 1,
      0.5, -0.5, 1, 1,
    ]);
  });

  it('applies translate, quarter-turn rotation, and flip without changing texture coordinates', () => {
    const vertices = buildRasterQuad(
      100,
      50,
      { width: 200, height: 100, dpr: 1 },
      { scale: 1, translateX: 10, translateY: -5, rotation: 90, flipH: true, flipV: false },
    );

    expect(round([...vertices])).toEqual([
      0.35, -0.9, 0, 0,
      0.35, 1.1, 1, 0,
      -0.15, -0.9, 0, 1,
      -0.15, 1.1, 1, 1,
    ]);
  });
});

function round(values: number[]): number[] {
  return values.map((value) => Math.round(value * 1000) / 1000);
}
