export type ThumbPaceHoldDir = 'prev' | 'next';
export interface UseThumbPacedNavigationParams {
    currentIndex: number;
    /**
     * True when the current media renderer has **presented** this visit in the
     * main stage. Download/decode/layout readiness alone must not count.
     */
    thumbReady: boolean;
    prev(): void;
    next(): void;
    /**
     * Minimum key/pointer hold time before the first automatic continuation.
     * The leading step is always immediate.
     */
    repeatDelayMs?: number;
    /**
     * After each image becomes presented, wait this long before allowing another
     * hold-step (and only if still held). Callers should pass
     * {@link ImagePreviewProps.holdMinVisibleMs}; the hook falls back to
     * {@link NAV_HOLD_MIN_VISIBLE_MS} only if omitted.
     */
    minVisibleMs?: number;
}
export interface UseThumbPacedNavigationResult {
    /**
     * Begin ←/→ hold. Steps **once immediately**, then only continues after each
     * landed image has been paintable for {@link minVisibleMs} while still held.
     */
    beginHold(dir: ThumbPaceHoldDir): void;
    /** End hold — cancels the single pending dwell timer; no queued steps. */
    endHold(dir?: ThumbPaceHoldDir): void;
    isHolding(): boolean;
    /** Reactive hold state for suspending expensive background work. */
    holdingDirection: ThumbPaceHoldDir | null;
}
/**
 * Hold navigation without a step queue:
 *
 * 1. Key/pointer down → exactly one immediate step.
 * 2. On the new index: wait for the renderer's presented signal, then wait
 *    `minVisibleMs`. If still held → one more step. Repeat.
 * 3. Release → clear the only timer; never drain a backlog of next() calls.
 */
export declare function useThumbPacedNavigation({ currentIndex, thumbReady, prev, next, repeatDelayMs, minVisibleMs, }: UseThumbPacedNavigationParams): UseThumbPacedNavigationResult;
