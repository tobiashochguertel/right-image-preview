import { ShiftArrowAction, ZoomMode } from './types.js';
import { ThumbPaceHoldDir } from './useThumbPacedNavigation.js';
export interface UseImagePreviewKeyboardParams {
    resetHideTimer(): void;
    onClose?: () => void;
    zoomIn(fitEq?: number): void;
    zoomOut(fitEq?: number): void;
    fit(): void;
    setNative(percent: number): void;
    mode: ZoomMode;
    prev(): void;
    next(): void;
    prevGroup(): void;
    nextGroup(): void;
    rotateCW(): void;
    rotateCCW(): void;
    panByDelta(dx: number, dy: number): void;
    keyboardPanStepPx: number;
    shiftArrowAction: ShiftArrowAction;
    fitEquivalentNativePercent: number | undefined;
    /** When set, Delete / Backspace removes the current image. */
    onDeleteImage?: () => void;
    /**
     * When false, ignore all keys (e.g. `presentation="contained"` while focus is outside).
     * Default true.
     */
    keyboardActive?: boolean;
    /**
     * When true (browser fullscreen owned by the preview), Esc exits fullscreen instead of closing.
     */
    isFullscreen?: () => boolean;
    exitFullscreen?: () => void | Promise<void>;
    /**
     * Thumb-paced ←/→ hold (optional). When set, ArrowLeft/Right (without mod/shift)
     * use begin/end hold instead of calling prev/next on every key-repeat.
     */
    beginNavHold?: (dir: ThumbPaceHoldDir) => void;
    endNavHold?: (dir?: ThumbPaceHoldDir) => void;
}
/**
 * Global keydown for the preview dialog (zoom, navigate, pan, close).
 * Skips handling when focus is in an input/textarea (e.g. zoom % field).
 *
 * Listeners are registered once and read the latest params via a ref — so navigating
 * (which recreates `prev`/`next`) must not tear down the effect and call `endNavHold`
 * mid-hold (that bug made long-press ←/→ stop after one step).
 */
export declare function useImagePreviewKeyboard(p: UseImagePreviewKeyboardParams): void;
