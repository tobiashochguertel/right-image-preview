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
export declare const RASTER_SCREEN_HISTORY_MAX_ENTRIES = 32;
export declare function rememberRasterScreenHistory(history: readonly RasterScreenHistoryEntry[], leaving: RasterScreenHistoryEntry, currentResourceKey: string): readonly RasterScreenHistoryEntry[];
/**
 * Chooses only currently-resident Screen textures. This function deliberately
 * has no source or decode inputs: evicted history must never create background
 * network/decode/upload work.
 */
export declare function selectRasterScreenHistoryPins({ enabled, resourceKey, history, residentTextures, budgetBytes, currentReservedBytes, immediateNeighborScreenBytes, }: SelectRasterScreenHistoryPinsOptions): readonly RasterScreenHistoryPin[];
