import { ZoomMode } from './types.js';
export interface UseWheelZoomOptions {
    /** Container element ref whose wheel events are listened to. */
    containerRef: React.RefObject<HTMLDivElement | null>;
    enabled: boolean;
    mode: ZoomMode;
    /** Current rendered CSS scale — used for cursor-anchored zoom. Kept current via a ref. */
    currentScale: number;
    fitEquivalentNativePercent: number | undefined;
    zoomIn(fitEquiv?: number): void;
    zoomOut(fitEquiv?: number): void;
    /**
     * Returns what the next zoom-in state would be WITHOUT applying it, or null if at max.
     */
    peekZoomIn(fitEquiv?: number): {
        mode: ZoomMode;
        percent: number;
    } | null;
    /**
     * Returns what the next zoom-out state would be WITHOUT applying it, or null if at min.
     */
    peekZoomOut(fitEquiv?: number): {
        mode: ZoomMode;
        percent: number;
    } | null;
    /**
     * Pre-adjust translate so the point under the cursor stays fixed during a zoom step.
     * Must be called BEFORE the zoom state update (same render batch via flushSync).
     */
    zoomAnchorTranslate(prevScale: number, newScale: number, anchorX: number, anchorY: number): void;
}
/**
 * Attaches a wheel-zoom handler to `containerRef`.
 *
 * Zoom strategy:
 * - LINE delta: each line → ±1 stop (capped at MAX_STEPS_PER_DRAIN).
 * - PIXEL "notch band" (16-220 px): one stop per event.
 * - PIXEL small-delta + long inter-event gap: one stop (slow click-by-click mice).
 * - Otherwise: accumulate pixel/page deltas until threshold, advance one stop per threshold.
 *
 * A single physical event can zoom in at most one stop from Fit mode to avoid
 * the first-zoom snap jumping all the way through the stops list.
 */
export declare function useWheelZoom(options: UseWheelZoomOptions): void;
