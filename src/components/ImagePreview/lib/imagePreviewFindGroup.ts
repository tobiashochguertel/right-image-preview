import type { FlattenedGroupSlice } from '../flattenGroupedImages';

/** Find which slice the flat index falls into. Returns null if not grouped. */
export function findGroup(
  slices: FlattenedGroupSlice[] | undefined,
  idx: number,
): { group: FlattenedGroupSlice; groupIdx: number } | null {
  if (!slices) return null;
  const groupIdx = slices.findIndex((g) => idx >= g.start && idx <= g.end);
  if (groupIdx === -1) return null;
  return { group: slices[groupIdx], groupIdx };
}
