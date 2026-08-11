import type { ExifGroupId, ExifValue, ImageExif, ImageExifExtraEntry } from '../types';

/** Well-known {@link ImageExif} keys in display order within each group (excludes `extra`). */
export type ExifKnownFieldKey = Exclude<keyof ImageExif, 'extra'>;

export interface ExifFieldRow {
  key: string;
  labelKey: ExifKnownFieldKey | null;
  /** Fallback label when {@link labelKey} is null (extra rows). */
  labelFallback: string | null;
  value: string;
}

export interface ExifDisplayGroup {
  id: ExifGroupId;
  rows: ExifFieldRow[];
}

const GROUP_ORDER: ExifGroupId[] = ['file', 'camera', 'exposure', 'gps', 'other'];

const KNOWN_FIELDS_BY_GROUP: Record<Exclude<ExifGroupId, 'other'>, ExifKnownFieldKey[]> = {
  file: ['fileName', 'fileSize', 'mimeType', 'width', 'height', 'colorSpace', 'orientation'],
  camera: ['make', 'model', 'lens', 'software', 'dateTimeOriginal', 'dateTimeDigitized', 'createDate'],
  exposure: [
    'exposureTime',
    'fNumber',
    'iso',
    'focalLength',
    'focalLength35mm',
    'exposureProgram',
    'meteringMode',
    'flash',
    'whiteBalance',
    'exposureBias',
  ],
  gps: ['gpsLatitude', 'gpsLongitude', 'gpsAltitude'],
};

const KNOWN_FIELD_SET = new Set<string>(
  (Object.values(KNOWN_FIELDS_BY_GROUP) as ExifKnownFieldKey[][]).flat(),
);

export function isExifValuePresent(value: ExifValue): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  return true; // boolean
}

export function formatExifValue(
  value: ExifValue,
  boolYes: string,
  boolNo: string,
): string | null {
  if (!isExifValuePresent(value)) return null;
  if (typeof value === 'boolean') return value ? boolYes : boolNo;
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

function normalizeExtraGroup(group: ExifGroupId | undefined): ExifGroupId {
  if (group === 'file' || group === 'camera' || group === 'exposure' || group === 'gps' || group === 'other') {
    return group;
  }
  return 'other';
}

/**
 * Builds ordered, non-empty EXIF groups for the info panel.
 * Empty fields and empty groups are omitted.
 */
export function buildExifDisplayGroups(
  exif: ImageExif | undefined | null,
  boolYes: string,
  boolNo: string,
): ExifDisplayGroup[] {
  if (!exif) return [];

  const buckets = new Map<ExifGroupId, ExifFieldRow[]>();
  for (const id of GROUP_ORDER) buckets.set(id, []);

  for (const groupId of ['file', 'camera', 'exposure', 'gps'] as const) {
    const keys = KNOWN_FIELDS_BY_GROUP[groupId];
    const rows = buckets.get(groupId)!;
    for (const key of keys) {
      const formatted = formatExifValue(exif[key], boolYes, boolNo);
      if (formatted == null) continue;
      rows.push({ key, labelKey: key, labelFallback: null, value: formatted });
    }
  }

  const extras: ImageExifExtraEntry[] = Array.isArray(exif.extra) ? exif.extra : [];
  for (const entry of extras) {
    if (!entry || typeof entry.key !== 'string' || entry.key.trim() === '') continue;
    // Skip extras that duplicate a known key already shown (or would collide).
    if (KNOWN_FIELD_SET.has(entry.key) && isExifValuePresent(exif[entry.key as ExifKnownFieldKey])) {
      continue;
    }
    const formatted = formatExifValue(entry.value, boolYes, boolNo);
    if (formatted == null) continue;
    const groupId = normalizeExtraGroup(entry.group);
    const label =
      typeof entry.label === 'string' && entry.label.trim() !== ''
        ? entry.label.trim()
        : entry.key;
    buckets.get(groupId)!.push({
      key: `extra:${entry.key}`,
      labelKey: null,
      labelFallback: label,
      value: formatted,
    });
  }

  return GROUP_ORDER
    .map((id) => ({ id, rows: buckets.get(id)! }))
    .filter((g) => g.rows.length > 0);
}
