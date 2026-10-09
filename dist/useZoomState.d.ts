import { FirstZoomInStrategy, NativePercent, ZoomInAtMaxBehaviour, ZoomMode, ZoomOutBelowMinBehaviour, ZoomState } from './types.js';
export interface ZoomStateOptions {
    stops: NativePercent[];
    initialMode: ZoomMode;
    initialNativePercent?: NativePercent;
    firstZoomInStrategy: FirstZoomInStrategy;
    zoomOutBelowMinBehaviour: ZoomOutBelowMinBehaviour;
    zoomInAtMaxBehaviour: ZoomInAtMaxBehaviour;
    onZoomChange?: (state: ZoomState) => void;
    onMaxStopReached?: () => void;
}
export interface ZoomStateActions {
    mode: ZoomMode;
    nativePercent: NativePercent;
    zoomIn(fitEquivalentNativePercent?: number): void;
    zoomOut(fitEquivalentNativePercent?: number): void;
    fit(): void;
    setNative(percent: NativePercent): void;
    reset(): void;
    getState(fitEquivalentNativePercent?: number): ZoomState;
    /** Returns what the next zoom-in state would be WITHOUT applying it. */
    peekZoomIn(fitEquivalentNativePercent?: number): {
        mode: ZoomMode;
        percent: NativePercent;
    } | null;
    /** Returns what the next zoom-out state would be WITHOUT applying it. */
    peekZoomOut(fitEquivalentNativePercent?: number): {
        mode: ZoomMode;
        percent: NativePercent;
    } | null;
}
export declare function useZoomState(options: ZoomStateOptions): ZoomStateActions;
