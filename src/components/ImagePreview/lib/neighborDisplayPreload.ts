import type { ImageItem } from '../types';

/** Conservative fallback when pixel size is unknown (~12 MP RGBA). */
export const DEFAULT_DECODED_BYTES_GUESS = 12_000_000 * 4;

/**
 * When the host sets {@link ImagePreviewProps.preloadMemoryBudgetBytes} but leaves
 * `preloadDisplaySlots` at `0`, use this as the neighbor-slot ceiling while the budget
 * decides how many actually fill.
 */
export const DEFAULT_DISPLAY_SLOTS_WHEN_BUDGET_ONLY = 6;

/** Idle debounce before starting display decode after user activity. */
export const DISPLAY_PRELOAD_IDLE_MS = 120;

/**
 * Fraction of *available* RAM suggested for the neighbor display-ready pool
 * (excludes the current main image). Hosts may choose differently.
 */
export const SUGGESTED_PRELOAD_BUDGET_FRACTION_OF_AVAILABLE = 0.12;

/** Hard cap for {@link suggestPreloadMemoryBudgetBytes}. */
export const SUGGESTED_PRELOAD_BUDGET_MAX_BYTES = Math.floor(1.5 * 1024 * 1024 * 1024);

export function rgbaDecodedBytes(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_DECODED_BYTES_GUESS;
  }
  return Math.ceil(width) * Math.ceil(height) * 4;
}

function exifDim(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Default decoded-size estimate from EXIF width/height when present. */
export function defaultEstimateDecodedBytes(item: ImageItem): number {
  const w = exifDim(item.exif?.width);
  const h = exifDim(item.exif?.height);
  if (w != null && h != null) return rgbaDecodedBytes(w, h);
  return DEFAULT_DECODED_BYTES_GUESS;
}

/**
 * Suggest a neighbor display-ready byte budget from OS available memory (Tauri / sysinfo).
 * Does not reserve space for the current main image — budget is for neighbors only.
 */
export function suggestPreloadMemoryBudgetBytes(
  availableBytes: number,
  opts?: { fraction?: number; maxBytes?: number },
): number {
  if (!Number.isFinite(availableBytes) || availableBytes <= 0) return 0;
  const fraction = opts?.fraction ?? SUGGESTED_PRELOAD_BUDGET_FRACTION_OF_AVAILABLE;
  const maxBytes = opts?.maxBytes ?? SUGGESTED_PRELOAD_BUDGET_MAX_BYTES;
  return Math.max(0, Math.min(Math.floor(availableBytes * fraction), maxBytes));
}

/**
 * Resolve the neighbor slot ceiling: explicit `preloadDisplaySlots`, or a default
 * ceiling when only a memory budget is provided.
 */
export function resolvePreloadDisplaySlotCeiling(
  displaySlots: number,
  memoryBudgetBytes?: number,
): number {
  const slots = Math.max(0, Math.floor(displaySlots));
  if (slots > 0) return slots;
  if (
    memoryBudgetBytes != null &&
    Number.isFinite(memoryBudgetBytes) &&
    memoryBudgetBytes > 0
  ) {
    return DEFAULT_DISPLAY_SLOTS_WHEN_BUDGET_ONLY;
  }
  return 0;
}

/**
 * Neighbor indexes inside `radius`, ordered by distance to `currentIndex`
 * (alternating nearer sides), excluding current.
 */
export function orderedNeighborIndexes(
  currentIndex: number,
  radius: number,
  length: number,
): number[] {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0 || length === 0) return [];
  const out: number[] = [];
  for (let d = 1; d <= r; d++) {
    const right = currentIndex + d;
    const left = currentIndex - d;
    if (right >= 0 && right < length) out.push(right);
    if (left >= 0 && left < length) out.push(left);
  }
  return out;
}

/**
 * Pick flat indexes to keep display-ready under slot count + optional memory budget.
 * A candidate that alone exceeds the budget is skipped (no forced first slot).
 */
export function pickDisplaySlotIndexes(opts: {
  currentIndex: number;
  radius: number;
  images: ImageItem[];
  maxSlots: number;
  budgetBytes?: number;
  estimateBytes: (item: ImageItem) => number;
}): number[] {
  const maxSlots = Math.max(0, Math.floor(opts.maxSlots));
  if (maxSlots === 0) return [];
  const candidates = orderedNeighborIndexes(
    opts.currentIndex,
    opts.radius,
    opts.images.length,
  );
  const budget =
    opts.budgetBytes != null &&
    Number.isFinite(opts.budgetBytes) &&
    opts.budgetBytes > 0
      ? opts.budgetBytes
      : null;
  const picked: number[] = [];
  let used = 0;
  for (const idx of candidates) {
    if (picked.length >= maxSlots) break;
    const item = opts.images[idx];
    if (!item?.src) continue;
    const cost = Math.max(0, opts.estimateBytes(item));
    if (budget != null && used + cost > budget) continue;
    picked.push(idx);
    used += cost;
  }
  return picked;
}

export function mergeByteAndDisplayStatus(
  byteStatus: Readonly<Record<number, { phase: string; progress?: number }>>,
  displayReadyIndexes: ReadonlySet<number>,
): Record<number, { phase: string; progress?: number }> {
  const next: Record<number, { phase: string; progress?: number }> = { ...byteStatus };
  for (const idx of displayReadyIndexes) {
    next[idx] = { phase: 'display-ready', progress: 1 };
  }
  return next;
}
