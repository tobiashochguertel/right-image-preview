export interface RasterScreenHistoryEntry {
  resourceKey: string;
  flatIndex?: number;
}

export interface RasterResidentDisplayTexture {
  resourceKey: string;
  quality: string;
  bytes: number;
}

export interface RasterScreenHistoryPin extends RasterScreenHistoryEntry {
  bytes: number;
}

export interface SelectRasterScreenHistoryPinsOptions {
  enabled: boolean;
  resourceKey?: string;
  history: readonly RasterScreenHistoryEntry[];
  residentTextures: readonly RasterResidentDisplayTexture[];
  budgetBytes: number;
  currentReservedBytes: number;
  immediateNeighborScreenBytes: number;
}

/** A bounded MRU list; entries are retained only when their texture already exists. */
export const RASTER_SCREEN_HISTORY_MAX_ENTRIES = 32;

export function rememberRasterScreenHistory(
  history: readonly RasterScreenHistoryEntry[],
  leaving: RasterScreenHistoryEntry,
  currentResourceKey: string,
): readonly RasterScreenHistoryEntry[] {
  return [
    leaving,
    ...history.filter((item) =>
      item.resourceKey !== leaving.resourceKey && item.resourceKey !== currentResourceKey),
  ].slice(0, RASTER_SCREEN_HISTORY_MAX_ENTRIES);
}

/**
 * Chooses only currently-resident Screen textures. This function deliberately
 * has no source or decode inputs: evicted history must never create background
 * network/decode/upload work.
 */
export function selectRasterScreenHistoryPins({
  enabled,
  resourceKey,
  history,
  residentTextures,
  budgetBytes,
  currentReservedBytes,
  immediateNeighborScreenBytes,
}: SelectRasterScreenHistoryPinsOptions): readonly RasterScreenHistoryPin[] {
  if (!enabled || !resourceKey) return [];
  const displayBytes = new Map(
    residentTextures
      .filter((texture) => texture.quality === 'display')
      .map((texture) => [texture.resourceKey, texture.bytes]),
  );
  // First keep enough headroom for current and the closest Screen candidate on
  // both sides. History consumes only the real remaining capacity.
  let room = Math.max(
    0,
    budgetBytes - currentReservedBytes - immediateNeighborScreenBytes,
  );
  const pins: RasterScreenHistoryPin[] = [];
  for (const candidate of history) {
    if (candidate.resourceKey === resourceKey) continue;
    const bytes = displayBytes.get(candidate.resourceKey);
    if (!bytes || bytes > room) continue;
    pins.push({ ...candidate, bytes });
    room -= bytes;
  }
  return pins;
}
