import { DefaultGroupedSelection, ImageGroup, ImageItem, ImagePreviewProps } from './types.js';
/** Internal flat index range after {@link flattenGroupedImages}. Not a public input shape. */
export interface FlattenedGroupSlice {
    name: string;
    start: number;
    end: number;
    /** Optional stable id for the group (e.g. folder path). */
    id?: string;
}
/**
 * Flattens {@link ImageGroup}[] into a single list plus index slices for in-group navigation.
 * Empty `images` arrays inside a group are skipped.
 */
export declare function flattenGroupedImages(grouped: ImageGroup[]): {
    images: ImageItem[];
    groupSlices: FlattenedGroupSlice[];
};
/**
 * Maps {@link DefaultGroupedSelection} to an index in the flattened list produced by {@link flattenGroupedImages}.
 * Out-of-range group or in-group indices are clamped. Empty groups are not counted in `defaultGroupIndex`.
 */
export declare function resolveDefaultGroupedFlatIndex(groupedImages: ImageGroup[], selection: DefaultGroupedSelection): number;
/** Resolves props to a flat image list and optional group slices. Priority: `groupedImages` → `images` → `src`. */
export declare function resolvePreviewImages(props: ImagePreviewProps): {
    images: ImageItem[];
    groupSlices: FlattenedGroupSlice[] | undefined;
};
