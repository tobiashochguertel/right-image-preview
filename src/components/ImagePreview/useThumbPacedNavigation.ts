import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  NAV_HOLD_MIN_VISIBLE_MS,
  NAV_HOLD_REPEAT_DELAY_MS,
} from './imagePreviewTuning';

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
export function useThumbPacedNavigation({
  currentIndex,
  thumbReady,
  prev,
  next,
  repeatDelayMs = NAV_HOLD_REPEAT_DELAY_MS,
  minVisibleMs = NAV_HOLD_MIN_VISIBLE_MS,
}: UseThumbPacedNavigationParams): UseThumbPacedNavigationResult {
  const holdRef = useRef<ThumbPaceHoldDir | null>(null);
  const [holdingDirection, setHoldingDirection] = useState<ThumbPaceHoldDir | null>(null);
  const thumbReadyRef = useRef(thumbReady);
  const currentIndexRef = useRef(currentIndex);

  /** Index we already advanced away from after its min-visible dwell. */
  const advancedFromIndexRef = useRef<number | null>(null);
  /** When the current index first became paintable during this visit. */
  const visibleSinceRef = useRef<number | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevRef = useRef(prev);
  const nextRef = useRef(next);
  const minVisibleRef = useRef(minVisibleMs);
  const repeatDelayRef = useRef(repeatDelayMs);
  const holdStartedAtRef = useRef(0);
  const firstContinuationRef = useRef(false);

  useLayoutEffect(() => {
    thumbReadyRef.current = thumbReady;
    currentIndexRef.current = currentIndex;
    prevRef.current = prev;
    nextRef.current = next;
    minVisibleRef.current = minVisibleMs;
    repeatDelayRef.current = repeatDelayMs;
  }, [currentIndex, minVisibleMs, next, prev, repeatDelayMs, thumbReady]);

  const clearDwellTimer = useCallback(() => {
    if (dwellTimerRef.current != null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const stepNow = useCallback((dir: ThumbPaceHoldDir) => {
    // 再读一次 hold：setTimeout(0) 可能在 keyup/endHold 之后才跑到 step。
    if (holdRef.current !== dir) return;
    if (dir === 'next') nextRef.current();
    else prevRef.current();
  }, []);

  const armDwellIfNeeded = useCallback(() => {
    const dir = holdRef.current;
    if (!dir) return;
    if (!thumbReadyRef.current) return;
    if (advancedFromIndexRef.current === currentIndexRef.current) return;

    if (visibleSinceRef.current == null) {
      visibleSinceRef.current = performance.now();
    }

    clearDwellTimer();
    const minMs = Math.max(0, minVisibleRef.current);
    const elapsed = performance.now() - visibleSinceRef.current;
    const visibleWait = Math.max(0, minMs - elapsed);
    const repeatWait = firstContinuationRef.current
      ? Math.max(0, Math.max(0, repeatDelayRef.current) - (
          performance.now() - holdStartedAtRef.current
        ))
      : 0;
    const wait = Math.max(visibleWait, repeatWait);

    const continueIfHeld = () => {
      dwellTimerRef.current = null;
      if (holdRef.current !== dir) return;
      if (!thumbReadyRef.current) return;
      const idx = currentIndexRef.current;
      if (advancedFromIndexRef.current === idx) return;
      advancedFromIndexRef.current = idx;
      firstContinuationRef.current = false;
      stepNow(dir);
    };
    // Even the 0ms mode goes through the same single cancellable timer. This
    // yields until React has committed the newly presented visit, while keyup
    // can still cancel it before another step is dispatched.
    dwellTimerRef.current = setTimeout(continueIfHeld, wait);
  }, [clearDwellTimer, stepNow]);

  const beginHold = useCallback(
    (dir: ThumbPaceHoldDir) => {
      clearDwellTimer();
      holdRef.current = dir;
      setHoldingDirection(dir);
      holdStartedAtRef.current = performance.now();
      firstContinuationRef.current = true;
      // Immediate first switch — do not wait for min-visible on the image we leave.
      advancedFromIndexRef.current = currentIndexRef.current;
      visibleSinceRef.current = null;
      stepNow(dir);
      // Continuations are armed by the effect when we land on the next index.
    },
    [clearDwellTimer, stepNow],
  );

  const endHold = useCallback(
    (dir?: ThumbPaceHoldDir) => {
      if (dir != null && holdRef.current !== dir) return;
      clearDwellTimer();
      holdRef.current = null;
      setHoldingDirection(null);
      visibleSinceRef.current = null;
      firstContinuationRef.current = false;
    },
    [clearDwellTimer],
  );

  const isHolding = useCallback(() => holdRef.current != null, []);

  // New index while held: reset dwell clock for this visit.
  useEffect(() => {
    if (!holdRef.current) return;
    visibleSinceRef.current = null;
    clearDwellTimer();
    if (
      thumbReadyRef.current &&
      advancedFromIndexRef.current !== currentIndexRef.current
    ) {
      armDwellIfNeeded();
    }
  }, [currentIndex, armDwellIfNeeded, clearDwellTimer]);

  // Became paintable (or lost paint) on the current index.
  useEffect(() => {
    if (!holdRef.current) return;
    if (!thumbReady) {
      clearDwellTimer();
      visibleSinceRef.current = null;
      return;
    }
    if (advancedFromIndexRef.current === currentIndex) return;
    armDwellIfNeeded();
  }, [thumbReady, currentIndex, armDwellIfNeeded, clearDwellTimer]);

  useEffect(() => () => clearDwellTimer(), [clearDwellTimer]);

  return { beginHold, endHold, isHolding, holdingDirection };
}
