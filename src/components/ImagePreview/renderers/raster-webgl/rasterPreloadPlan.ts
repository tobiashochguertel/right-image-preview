import { resolveMediaKind } from '../../core/media-kind';
import type { MediaSource } from '../../core/media-source';
import type { ImageItem } from '../../types';
import {
  capRasterSizeToEdge,
  fitRasterToScreenLod,
  scaleRasterLodBox,
  type RasterSize,
} from './rasterLod';

export type RasterPreloadRange = number | 'auto';

/** Minimum Screen-LOD protection under normal budget conditions. */
export const RASTER_SCREEN_FORWARD_MIN = 3;
export const RASTER_SCREEN_BACKWARD_MIN = 2;

export interface RasterPreloadSource {
  resourceKey: string;
  source: MediaSource;
  previewSource?: MediaSource;
  flatIndex?: number;
  knownSize?: RasterSize;
  side: 'forward' | 'backward';
  distance: number;
}

export type RasterNeighborLod = 'browse' | 'screen';

export interface RasterPlannedPreload extends RasterPreloadSource {
  lod: RasterNeighborLod;
  targetBox: RasterSize;
  estimatedBytes: number;
  priority: number;
}

export interface RasterPreloadPlanSnapshot {
  viewport: {
    cssWidth: number;
    cssHeight: number;
    dpr: number;
    pixelWidth: number;
    pixelHeight: number;
  };
  budgetBytes: number;
  reservedBytes: number;
  estimatedBytes: number;
  screenForwardIndexes: readonly number[];
  screenBackwardIndexes: readonly number[];
  browseForwardIndexes: readonly number[];
  browseBackwardIndexes: readonly number[];
  /** Existing, non-contiguous Screen textures retained from recently viewed images. */
  historyScreenIndexes: readonly number[];
  historyScreenBytes: number;
}

export interface RasterDynamicLodPlanOptions {
  candidates: readonly RasterPreloadSource[];
  viewport: { width: number; height: number; dpr: number };
  budgetBytes: number;
  reservedBytes: number;
  maxTextureSize: number;
}

export interface RasterPreloadPlanOptions {
  images: readonly ImageItem[];
  currentIndex: number;
  direction: 1 | -1;
  range: RasterPreloadRange;
  maxCount: number;
  allowPreviewSource?: boolean;
}

/** Builds a direction-aware candidate pool. LOD and retained count are decided later by the viewport planner. */
export function buildRasterPreloadPlan({
  images,
  currentIndex,
  direction,
  range,
  maxCount,
  allowPreviewSource = true,
}: RasterPreloadPlanOptions): RasterPreloadSource[] {
  if (range === 0 || maxCount <= 0 || images.length <= 1) return [];
  if (range === 'auto') {
    return buildAutoPlan(
      images,
      currentIndex,
      direction,
      Math.max(1, Math.floor(maxCount)),
      allowPreviewSource,
    );
  }
  const distanceLimit = Math.max(0, Math.floor(range));
  const result: RasterPreloadSource[] = [];

  for (let distance = 1; distance <= distanceLimit; distance += 1) {
    const forwardIndex = currentIndex + distance * direction;
    const backwardIndex = currentIndex - distance * direction;
    for (const index of [forwardIndex, backwardIndex]) {
      const candidate = toRasterPreloadSource(
        images,
        index,
        index === forwardIndex ? 'forward' : 'backward',
        distance,
        allowPreviewSource,
      );
      if (candidate) result.push(candidate);
      if (result.length >= maxCount) return result;
    }
  }
  return result;
}

function buildAutoPlan(
  images: readonly ImageItem[],
  currentIndex: number,
  direction: 1 | -1,
  maxCount: number,
  allowPreviewSource: boolean,
): RasterPreloadSource[] {
  const forward: RasterPreloadSource[] = [];
  const backward: RasterPreloadSource[] = [];
  let forwardDone = false;
  let backwardDone = false;
  // Do not materialize the whole folder. In a large all-raster folder the old
  // implementation walked every image on every navigation, even though the
  // public safety cap meant only the first `maxCount` candidates could ever be
  // scheduled. We only need up to that many candidates on either side; if a
  // side runs out (or consists mostly of non-raster media), keep searching the
  // other side until it too reaches the cap or its physical boundary.
  for (let distance = 1; distance < images.length; distance += 1) {
    if (!forwardDone) {
      const index = currentIndex + distance * direction;
      if (index < 0 || index >= images.length) {
        forwardDone = true;
      } else {
        const ahead = toRasterPreloadSource(
          images,
          index,
          'forward',
          distance,
          allowPreviewSource,
        );
        if (ahead) forward.push(ahead);
        if (forward.length >= maxCount) forwardDone = true;
      }
    }
    if (!backwardDone) {
      const index = currentIndex - distance * direction;
      if (index < 0 || index >= images.length) {
        backwardDone = true;
      } else {
        const behind = toRasterPreloadSource(
          images,
          index,
          'backward',
          distance,
          allowPreviewSource,
        );
        if (behind) backward.push(behind);
        if (backward.length >= maxCount) backwardDone = true;
      }
    }
    if (forwardDone && backwardDone) break;
  }

  const result: RasterPreloadSource[] = [];
  const push = (item: RasterPreloadSource | undefined) => {
    if (item && result.length < maxCount) result.push(item);
  };
  for (let index = 0; index < RASTER_SCREEN_BACKWARD_MIN; index += 1) {
    push(forward[index]);
    push(backward[index]);
  }
  for (let index = RASTER_SCREEN_BACKWARD_MIN; index < RASTER_SCREEN_FORWARD_MIN; index += 1) {
    push(forward[index]);
  }
  let forwardIndex = RASTER_SCREEN_FORWARD_MIN;
  let backwardIndex = RASTER_SCREEN_BACKWARD_MIN;
  while (result.length < maxCount && (
    forwardIndex < forward.length || backwardIndex < backward.length
  )) {
    push(forward[forwardIndex++]);
    push(backward[backwardIndex++]);
  }
  return result;
}

function toRasterPreloadSource(
  images: readonly ImageItem[],
  index: number,
  side: RasterPreloadSource['side'],
  distance: number,
  allowPreviewSource: boolean,
): RasterPreloadSource | undefined {
  const item = images[index];
  if (!item) return undefined;
  const href = item.source?.type === 'url' ? item.source.href : item.src;
  const hinted = resolveMediaKind({ kind: item.kind, mimeType: item.mimeType, href });
  const kind = hinted === 'unknown' ? resolveMediaKind({ href: item.name }) : hinted;
  if (kind !== 'raster') return undefined;
  return {
    resourceKey: item.id ?? item.src,
    source: item.source ?? { type: 'url', href: item.src },
    previewSource: allowPreviewSource
      ? item.minimapSource ?? (item.minimapSrc
          ? { type: 'url', href: item.minimapSrc }
          : undefined)
      : undefined,
    flatIndex: index,
    side,
    distance,
    knownSize:
      Number(item.exif?.width) > 0 && Number(item.exif?.height) > 0
        ? {
            width: Number(item.exif?.width),
            height: Number(item.exif?.height),
          }
        : undefined,
  };
}

/**
 * Plans fixed, contiguous bands from the current image outward: a nearest Screen
 * core, then a Browse ring. Browse is never auto-upgraded to Screen later, so
 * the blue/violet meaning stays stable for the whole visit.
 */
export function planRasterNeighborLods({
  candidates,
  viewport,
  budgetBytes,
  reservedBytes,
  maxTextureSize,
}: RasterDynamicLodPlanOptions): {
  entries: RasterPlannedPreload[];
  snapshot: RasterPreloadPlanSnapshot;
} {
  const screenBox = capRasterSizeToEdge({
    width: Math.max(1, Math.round(viewport.width * viewport.dpr)),
    height: Math.max(1, Math.round(viewport.height * viewport.dpr)),
  });
  const browseBox = scaleRasterLodBox(screenBox);
  const budgetLeft = Math.max(0, Math.floor(budgetBytes - reservedBytes));
  const costs = new Map(candidates.map((candidate) => [candidate.resourceKey, {
    browse: estimateRasterTextureBytes(candidate.knownSize, browseBox, maxTextureSize),
    screen: estimateRasterTextureBytes(candidate.knownSize, screenBox, maxTextureSize),
  }]));
  const state = new Map<string, RasterNeighborLod>();
  const admissionOrder = new Map<string, number>();
  let nextAdmissionOrder = 0;
  let used = 0;
  const bySide = {
    forward: candidates.filter((candidate) => candidate.side === 'forward')
      .sort((a, b) => a.distance - b.distance),
    backward: candidates.filter((candidate) => candidate.side === 'backward')
      .sort((a, b) => a.distance - b.distance),
  } as const;
  const totalScreenBytes = candidates.reduce(
    (sum, candidate) => sum + costs.get(candidate.resourceKey)!.screen,
    0,
  );
  const representativeScreenBytes = percentile(
    candidates.map((candidate) => costs.get(candidate.resourceKey)!.screen),
    0.75,
  );
  // When all candidate Screen textures fit, Browse has no visual benefit: use
  // only Screen. Otherwise P75 guards the core size against a run of larger
  // images without letting one unusually tiny image inflate the estimate.
  const estimatedScreenCapacity = representativeScreenBytes > 0
    ? Math.floor(budgetLeft / representativeScreenBytes)
    : 0;
  const targetScreenCount = totalScreenBytes <= budgetLeft
    ? candidates.length
    : Math.min(
        candidates.length,
        Math.max(2, Math.min(5, estimatedScreenCapacity)),
      );
  const screenCursor = { forward: 0, backward: 0 };
  const screenBlocked = { forward: false, backward: false };
  const admitScreen = (side: RasterPreloadSource['side']) => {
    if (screenBlocked[side]) return;
    const candidate = bySide[side][screenCursor[side]];
    if (!candidate) {
      screenBlocked[side] = true;
      return;
    }
    const cost = costs.get(candidate.resourceKey)!.screen;
    // Never skip a nearer item on the same side: a blue/green/blue gap is
    // worse than leaving this side shorter under an unusually small budget.
    if (used + cost > budgetLeft) {
      screenBlocked[side] = true;
      return;
    }
    state.set(candidate.resourceKey, 'screen');
    admissionOrder.set(candidate.resourceKey, nextAdmissionOrder++);
    screenCursor[side] += 1;
    used += cost;
  };
  // Expand from the active image outwards on both sides. A tie is resolved in
  // favour of the active navigation direction, so a five-item core is 3/2.
  while (state.size < targetScreenCount) {
    const forwardCount = screenCursor.forward;
    const backwardCount = screenCursor.backward;
    const preferred: RasterPreloadSource['side'] =
      forwardCount <= backwardCount ? 'forward' : 'backward';
    const alternative: RasterPreloadSource['side'] =
      preferred === 'forward' ? 'backward' : 'forward';
    const before = state.size;
    admitScreen(preferred);
    if (state.size === before) admitScreen(alternative);
    if (state.size === before) break;
  }

  const coverageCursor = { ...screenCursor };

  const nextCoverageCandidate = (side: RasterPreloadSource['side']) => {
    const list = bySide[side];
    while (coverageCursor[side] < list.length) {
      const candidate = list[coverageCursor[side]++];
      if (!state.has(candidate.resourceKey)) return candidate;
    }
    return undefined;
  };
  const coverageCandidate = {
    forward: nextCoverageCandidate('forward'),
    backward: nextCoverageCandidate('backward'),
  };

  while (true) {
    const forwardCount = [...state.keys()]
      .filter((key) => bySide.forward.some((candidate) => candidate.resourceKey === key)).length;
    const backwardCount = state.size - forwardCount;
    // Start each equal-distance expansion on the active direction, but never
    // let it run away from the reverse side while both sides can be admitted.
    const preferred: RasterPreloadSource['side'] =
      forwardCount <= backwardCount ? 'forward' : 'backward';
    const sides: readonly RasterPreloadSource['side'][] =
      [preferred, preferred === 'forward' ? 'backward' : 'forward'];
    const coverageSide = sides.find((side) => {
      const candidate = coverageCandidate[side];
      return candidate && used + costs.get(candidate.resourceKey)!.browse <= budgetLeft;
    });
    if (!coverageSide) break;
    const candidate = coverageCandidate[coverageSide]!;
    state.set(candidate.resourceKey, 'browse');
    admissionOrder.set(candidate.resourceKey, nextAdmissionOrder++);
    used += costs.get(candidate.resourceKey)!.browse;
    coverageCandidate[coverageSide] = nextCoverageCandidate(coverageSide);
  }

  const entries = candidates
    .flatMap<RasterPlannedPreload>((candidate, order) => {
      const lod = state.get(candidate.resourceKey);
      if (!lod) return [];
      const itemCosts = costs.get(candidate.resourceKey)!;
      return [{
        ...candidate,
        lod,
        targetBox: lod === 'screen' ? screenBox : browseBox,
        estimatedBytes: lod === 'screen' ? itemCosts.screen : itemCosts.browse,
        priority: (lod === 'screen' ? 90 : 60) -
          (admissionOrder.get(candidate.resourceKey) ?? order) / Math.max(1, candidates.length),
      }];
    })
    .sort((a, b) => b.priority - a.priority);

  const indexes = (lod: RasterNeighborLod, side: RasterPreloadSource['side']) => entries
    .filter((entry) => entry.lod === lod && entry.side === side && entry.flatIndex != null)
    .map((entry) => entry.flatIndex!);
  return {
    entries,
    snapshot: {
      viewport: {
        cssWidth: viewport.width,
        cssHeight: viewport.height,
        dpr: viewport.dpr,
        pixelWidth: screenBox.width,
        pixelHeight: screenBox.height,
      },
      budgetBytes,
      reservedBytes,
      estimatedBytes: reservedBytes + used,
      screenForwardIndexes: indexes('screen', 'forward'),
      screenBackwardIndexes: indexes('screen', 'backward'),
      browseForwardIndexes: indexes('browse', 'forward'),
      browseBackwardIndexes: indexes('browse', 'backward'),
      historyScreenIndexes: [],
      historyScreenBytes: 0,
    },
  };
}

export function estimateRasterTextureBytes(
  naturalSize: RasterSize | undefined,
  targetBox: RasterSize,
  maxTextureSize: number,
): number {
  const fitted = naturalSize
    ? fitRasterToScreenLod(
        naturalSize.width,
        naturalSize.height,
        targetBox.width,
        targetBox.height,
      )
    : targetBox;
  const limit = Math.max(1, maxTextureSize);
  const scale = Math.min(1, limit / Math.max(fitted.width, fitted.height));
  return Math.max(4, Math.round(fitted.width * scale) * Math.round(fitted.height * scale) * 4);
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
}
