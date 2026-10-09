import { ZoomMode } from './types.js';
export interface ImageDimensions {
    naturalWidth: number;
    naturalHeight: number;
}
export interface ContainerSize {
    width: number;
    height: number;
}
/** Accumulated rotation in degrees (not wrapped to 0-360, intentionally). */
export type Rotation = number;
export interface TransformState {
    scale: number;
    translateX: number;
    translateY: number;
    rotation: Rotation;
    flipH: boolean;
    flipV: boolean;
    /** Precomputed CSS transform string — apply directly to the img element. */
    cssTransform: string;
}
export interface UseImageTransformOptions {
    mode: ZoomMode;
    nativePercent: number;
    fitResetPan: boolean;
    /**
     * Upper bound for Fit scale (1 = 100% native). `Infinity` keeps classic CSS-contain
     * upscaling of small images.
     */
    fitMaxScale?: number;
}
export interface UseImageTransformResult {
    transform: TransformState;
    /** True while the user is actively dragging (disable CSS transition during pan). */
    isPanning: boolean;
    /** Fit-equivalent native% (undefined until both image and container are measured). */
    fitEquivalentNativePercent: number | undefined;
    /** Callback ref – pass as `ref={setContainerEl}` on the viewport div. */
    setContainerEl: (el: HTMLDivElement | null) => void;
    onImageLoad(dims: ImageDimensions): void;
    resetImageDims(): void;
    onPanStart(e: React.PointerEvent): void;
    onPanMove(e: React.PointerEvent): void;
    onPanEnd(e?: React.PointerEvent): void;
    resetPan(): void;
    rotateCW(): void;
    rotateCCW(): void;
    flipHorizontal(): void;
    flipVertical(): void;
    /** Reset rotation and flip to their initial state. */
    resetOrientation(): void;
    imageDims: ImageDimensions | null;
    containerSize: ContainerSize | null;
    /**
     * Adjust translate so the image point currently at (anchorX, anchorY) in
     * viewport-centre coordinates stays there after the scale changes from
     * prevScale to newScale.  Call this BEFORE the zoom state update so both
     * land in the same React render batch and the built-in proportional-adjust
     * effect skips its own correction.
     */
    zoomAnchorTranslate(prevScale: number, newScale: number, anchorX: number, anchorY: number): void;
    /**
     * Pan by a delta in **container / screen** pixels (same space as {@link translateX} / {@link translateY}).
     * Only applies in `native` mode. Clamps **stricter** than main-image drag (`imagePreviewTuning.ts`).
     */
    panByDelta(dx: number, dy: number): void;
    /**
     * In `native` mode, pan so the given natural-image point is centred in the viewport
     * (used by minimap background click). Clamped like {@link panByDelta}.
     */
    /** Returns clamped `(tx, ty)` applied to the transform, or `undefined` if unchanged / not in native mode. */
    panJumpToNatural(nx: number, ny: number): {
        tx: number;
        ty: number;
    } | undefined;
}
/**
 * Contain scale, optionally capped so Fit never upscales past `fitMaxScale`.
 * `fitMaxScale = 1` means Fit ≤ 100% native (small images stay actual size).
 */
export declare function computeFitScale(dims: ImageDimensions, container: ContainerSize, fitMaxScale?: number): number;
/** Convert `fitMaxNativePercent` to a Fit scale cap; invalid / omitted → no cap. */
export declare function resolveFitMaxScale(fitMaxNativePercent: number | undefined): number;
export declare function useImageTransform(options: UseImageTransformOptions): UseImageTransformResult;
