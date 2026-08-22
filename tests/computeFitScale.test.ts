import { describe, expect, it } from 'vitest';
import { computeFitScale, resolveFitMaxScale } from '../src/components/ImagePreview/useImageTransform';

const SMALL = { naturalWidth: 320, naturalHeight: 180 };
const LARGE = { naturalWidth: 7008, naturalHeight: 4672 };
const VIEWPORT = { width: 1044, height: 580 };

describe('resolveFitMaxScale', () => {
  it('treats omitted / invalid values as no cap', () => {
    expect(resolveFitMaxScale(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(resolveFitMaxScale(0)).toBe(Number.POSITIVE_INFINITY);
    expect(resolveFitMaxScale(-10)).toBe(Number.POSITIVE_INFINITY);
    expect(resolveFitMaxScale(Number.NaN)).toBe(Number.POSITIVE_INFINITY);
  });

  it('converts native percent to a scale cap', () => {
    expect(resolveFitMaxScale(100)).toBe(1);
    expect(resolveFitMaxScale(200)).toBe(2);
  });
});

describe('computeFitScale', () => {
  it('upscales small images when Fit is uncapped (CSS contain)', () => {
    const scale = computeFitScale(SMALL, VIEWPORT);
    expect(scale).toBeCloseTo(Math.min(1044 / 320, 580 / 180), 6);
    expect(scale).toBeGreaterThan(1);
  });

  it('keeps small images at 100% when Fit is capped at 1', () => {
    expect(computeFitScale(SMALL, VIEWPORT, 1)).toBe(1);
  });

  it('still downscales large images when Fit is capped at 1', () => {
    const scale = computeFitScale(LARGE, VIEWPORT, 1);
    expect(scale).toBeCloseTo(Math.min(1044 / 7008, 580 / 4672), 6);
    expect(scale).toBeLessThan(1);
  });

  it('returns 1 when the container has not been measured', () => {
    expect(computeFitScale(SMALL, { width: 0, height: 0 }, 1)).toBe(1);
  });
});
