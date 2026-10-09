/**
 * Coordinate transforms for the navigation minimap.
 * Must stay in sync with {@link useImageTransform} CSS order:
 * translate(tx,ty) rotate(r) flip scale(s), transform-origin center.
 *
 * @see docs/minimap.md — pointer lifecycle (WebView) and Jacobian-based drag (rotation).
 * Jacobian step: `MINIMAP_JACOBIAN_EPS` in `imagePreviewTuning.ts`.
 */
export interface MinimapTransformParams {
    cw: number;
    ch: number;
    nw: number;
    nh: number;
    scale: number;
    tx: number;
    ty: number;
    rotationDeg: number;
    flipH: boolean;
    flipV: boolean;
}
/** Container pixel (top-left origin) → natural image pixel (top-left origin). */
export declare function containerToNatural(cx: number, cy: number, p: MinimapTransformParams): {
    nx: number;
    ny: number;
};
/** Natural image pixel → container pixel. */
export declare function naturalToContainer(nx: number, ny: number, p: MinimapTransformParams): {
    cx: number;
    cy: number;
};
/**
 * Container translate `(tx, ty)` so that natural `(nx, ny)` lies at the viewport centre `(cw/2, ch/2)`.
 * Uses the same layout as {@link naturalToContainer} with `tx = ty = 0` for the baseline position.
 */
export declare function translateForViewportCentreOnNatural(nx: number, ny: number, p: MinimapTransformParams): {
    tx: number;
    ty: number;
};
/** Natural → minimap inner pixel (same transform chain as main but scale = thumbS, tx = ty = 0). */
export declare function naturalToMinimapInner(nx: number, ny: number, mi: number, mj: number, nw: number, nh: number, thumbS: number, rotationDeg: number, flipH: boolean, flipV: boolean): {
    mx: number;
    my: number;
};
/** Minimap inner pixel → natural image pixel (inverse of {@link naturalToMinimapInner}). */
export declare function minimapInnerToNatural(mx: number, my: number, inner: number, nw: number, nh: number, thumbS: number, rotationDeg: number, flipH: boolean, flipV: boolean): {
    nx: number;
    ny: number;
};
/** Bounding box (half-width, half-height) of rotated unscaled rectangle. */
export declare function rotatedRectExtents(nw: number, nh: number, rotationDeg: number): {
    rw: number;
    rh: number;
};
export declare function clampNatural(nx: number, ny: number, nw: number, nh: number): {
    nx: number;
    ny: number;
};
/** Winding-number test: whether `(x, y)` lies inside a simple closed polygon (vertex indices wrap). */
export declare function pointInPolygon(x: number, y: number, poly: ReadonlyArray<readonly [number, number]>): boolean;
/**
 * Convert a pointer delta `(dmx, dmy)` in minimap / client space into container translate `(dtx, dty)` so the
 * viewport centre on the minimap follows the pointer 1:1.
 *
 * **Why not `cw / bw`?**  `bw` from the viewport quad’s axis-aligned box collapses when the quad is rotated,
 * which over-estimates pan gain. Here `J = ∂(mx,my)/∂(tx,ty)` is estimated numerically; then
 * `(dtx,dty) = J^{-1}(dmx,dmy)`.
 */
export declare function panDeltaFromMinimapPointerDelta(dmx: number, dmy: number, p: MinimapTransformParams, nw: number, nh: number, inner: number, thumbS: number): {
    dtx: number;
    dty: number;
};
