import { FlattenedGroupSlice } from '../flattenGroupedImages';
/** Find which slice the flat index falls into. Returns null if not grouped. */
export declare function findGroup(slices: FlattenedGroupSlice[] | undefined, idx: number): {
    group: FlattenedGroupSlice;
    groupIdx: number;
} | null;
