export interface RasterQuadTransform {
    scale: number;
    translateX: number;
    translateY: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
}
export interface RasterViewport {
    width: number;
    height: number;
    dpr: number;
}
export declare function buildRasterQuad(naturalWidth: number, naturalHeight: number, viewport: RasterViewport, transform: RasterQuadTransform): Float32Array;
