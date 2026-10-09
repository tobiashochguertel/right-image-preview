import { NativePercent, ZoomMode } from './types.js';
export interface UsePinchZoomOptions {
    /** Container element ref whose pointer events are monitored. */
    containerRef: React.RefObject<HTMLDivElement | null>;
    enabled: boolean;
    mode: ZoomMode;
    /** The current rendered CSS scale — used to compute the new scale from the pinch ratio. */
    currentScale: number;
    /** Sorted ascending zoom stops (native %). Used to clamp the output. */
    stops: NativePercent[];
    fitEquivalentNativePercent: number | undefined;
    /** Switch to Fit mode. */
    fit(): void;
    /**
     * Switch to Native mode at an arbitrary percentage (not clamped to stops).
     * The pinch gesture intentionally uses continuous scaling.
     */
    setNative(percent: NativePercent): void;
    /**
     * Pre-adjust translate to keep the midpoint of the two fingers fixed while
     * scaling.  Call this BEFORE setNative so both land in the same render.
     */
    zoomAnchorTranslate(prevScale: number, newScale: number, anchorX: number, anchorY: number): void;
}
/**
 * Two-finger pinch-to-zoom using Pointer Events (works on touch screens and
 * trackpads that expose multi-touch via pointer events).
 *
 * - In Fit mode, entering pinch immediately switches to Native at the current
 *   fit-equivalent % so the transition feels seamless.
 * - The midpoint between the two fingers is used as the zoom anchor so the
 *   focal area stays under the user's fingers.
 * - Scale is continuous (not snapped to stops) during the gesture; clamped to
 *   [minStop, maxStop * 4] to prevent extreme values.
 */
export declare function usePinchZoom(options: UsePinchZoomOptions): void;
