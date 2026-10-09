import { ExifGroupId, ExifValue, ImageExif } from '../types';
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
export declare function isExifValuePresent(value: ExifValue): boolean;
export declare function formatExifValue(value: ExifValue, boolYes: string, boolNo: string): string | null;
/**
 * Builds ordered, non-empty EXIF groups for the info panel.
 * Empty fields and empty groups are omitted.
 */
export declare function buildExifDisplayGroups(exif: ImageExif | undefined | null, boolYes: string, boolNo: string): ExifDisplayGroup[];
