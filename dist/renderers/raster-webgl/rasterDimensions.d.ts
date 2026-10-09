export interface RasterNaturalSize {
    width: number;
    height: number;
}
/** Reads common raster dimensions from headers without decoding the full bitmap. */
export declare function readRasterNaturalSize(blob: Blob): Promise<RasterNaturalSize | undefined>;
