import { describe, expect, it } from 'vitest';
import {
  buildExifDisplayGroups,
  formatExifValue,
  isExifValuePresent,
} from '../src/components/ImagePreview/lib/exifDisplay';
import type { ImageExif } from '../src/components/ImagePreview/types';

describe('isExifValuePresent', () => {
  it('rejects nullish and blank strings', () => {
    expect(isExifValuePresent(undefined)).toBe(false);
    expect(isExifValuePresent(null)).toBe(false);
    expect(isExifValuePresent('')).toBe(false);
    expect(isExifValuePresent('  ')).toBe(false);
  });

  it('accepts numbers, booleans, and non-empty strings', () => {
    expect(isExifValuePresent(0)).toBe(true);
    expect(isExifValuePresent(false)).toBe(true);
    expect(isExifValuePresent('ISO')).toBe(true);
  });

  it('rejects non-finite numbers', () => {
    expect(isExifValuePresent(Number.NaN)).toBe(false);
  });
});

describe('formatExifValue', () => {
  it('formats booleans with locale strings', () => {
    expect(formatExifValue(true, 'Yes', 'No')).toBe('Yes');
    expect(formatExifValue(false, 'Yes', 'No')).toBe('No');
  });

  it('returns null for empty values', () => {
    expect(formatExifValue(null, 'Yes', 'No')).toBeNull();
    expect(formatExifValue('  ', 'Yes', 'No')).toBeNull();
  });
});

describe('buildExifDisplayGroups', () => {
  it('returns empty for missing exif', () => {
    expect(buildExifDisplayGroups(undefined, 'Yes', 'No')).toEqual([]);
  });

  it('omits empty fields and empty groups; keeps fixed order', () => {
    const exif: ImageExif = {
      model: 'X-T5',
      make: 'FUJIFILM',
      iso: 200,
      fileName: 'a.jpg',
      exposureTime: '',
      gpsLatitude: '1° N',
      extra: [
        { key: 'copyright', label: 'Copyright', value: 'Me', group: 'other' },
        { key: 'blank', value: '', group: 'other' },
      ],
    };
    const groups = buildExifDisplayGroups(exif, 'Yes', 'No');
    expect(groups.map((g) => g.id)).toEqual(['file', 'camera', 'exposure', 'gps', 'other']);
    expect(groups.find((g) => g.id === 'file')!.rows.map((r) => r.key)).toEqual(['fileName']);
    expect(groups.find((g) => g.id === 'camera')!.rows.map((r) => r.key)).toEqual(['make', 'model']);
    expect(groups.find((g) => g.id === 'exposure')!.rows.map((r) => r.key)).toEqual(['iso']);
    expect(groups.find((g) => g.id === 'gps')!.rows.map((r) => r.key)).toEqual(['gpsLatitude']);
    expect(groups.find((g) => g.id === 'other')!.rows).toHaveLength(1);
    expect(groups.find((g) => g.id === 'other')!.rows[0].value).toBe('Me');
  });

  it('places extra rows into the requested group', () => {
    const groups = buildExifDisplayGroups(
      {
        extra: [{ key: 'hdr', label: 'HDR', value: true, group: 'exposure' }],
      },
      'Yes',
      'No',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('exposure');
    expect(groups[0].rows[0].value).toBe('Yes');
  });
});
