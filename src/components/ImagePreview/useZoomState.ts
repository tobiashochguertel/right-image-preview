import { useCallback, useRef, useState } from 'react';
import type {
  FirstZoomInStrategy,
  NativePercent,
  ZoomInAtMaxBehaviour,
  ZoomMode,
  ZoomOutBelowMinBehaviour,
  ZoomState,
} from './types';

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
  peekZoomIn(
    fitEquivalentNativePercent?: number,
  ): { mode: ZoomMode; percent: NativePercent } | null;
  /** Returns what the next zoom-out state would be WITHOUT applying it. */
  peekZoomOut(
    fitEquivalentNativePercent?: number,
  ): { mode: ZoomMode; percent: NativePercent } | null;
}

function clampToStops(percent: NativePercent, stops: NativePercent[]): NativePercent {
  if (stops.includes(percent)) return percent;
  // Snap to nearest stop
  return stops.reduce((prev, curr) =>
    Math.abs(curr - percent) < Math.abs(prev - percent) ? curr : prev,
  );
}

export function useZoomState(options: ZoomStateOptions): ZoomStateActions {
  const {
    stops,
    initialMode,
    initialNativePercent,
    firstZoomInStrategy,
    zoomOutBelowMinBehaviour,
    zoomInAtMaxBehaviour,
    onZoomChange,
    onMaxStopReached,
  } = options;

  const sortedStops = [...stops].sort((a, b) => a - b);
  const minStop = sortedStops[0];
  const maxStop = sortedStops[sortedStops.length - 1];
  /**
   * Ratio of the top stop gap — used to extend the ladder geometrically beyond
   * `maxStop` (and back down into it). Fit mode can exceed every stop (e.g. a
   * small SVG upscaled to fill the viewport at 950%), so wheel zoom must keep
   * stepping smoothly instead of snapping down to `maxStop`.
   */
  const beyondStopRatio =
    sortedStops.length > 1 ? maxStop / sortedStops[sortedStops.length - 2] : 1.25;

  /** Smallest zoom level strictly above `percent`: next stop, or a geometric step past `maxStop`. */
  const nextZoomAbove = useCallback(
    (percent: number): NativePercent => {
      const above = sortedStops.find((s) => s > percent);
      if (above !== undefined) return above;
      // `percent + 1` guards the (degenerate) case where the rounded step would not move.
      return Math.max(percent + 1, Math.round(percent * beyondStopRatio));
    },
    [sortedStops, beyondStopRatio],
  );

  /** Largest zoom level strictly below `percent`: previous stop, or a geometric step down when above `maxStop`. */
  const nextZoomBelow = useCallback(
    (percent: number): NativePercent | undefined => {
      if (percent > maxStop) {
        const geometric = percent / beyondStopRatio;
        if (geometric > maxStop) return Math.round(geometric);
      }
      return [...sortedStops].reverse().find((s) => s < percent);
    },
    [sortedStops, maxStop, beyondStopRatio],
  );

  const resolveInitialNative = (): NativePercent => {
    if (initialNativePercent !== undefined) {
      return clampToStops(initialNativePercent, sortedStops);
    }
    return minStop;
  };

  const [mode, setMode] = useState<ZoomMode>(initialMode);
  const [nativePercent, setNativePercent] = useState<NativePercent>(resolveInitialNative);

  // Actions update this ref together with React state so sequential calls in one event
  // observe the state produced by the previous action without mutating refs during render.
  const stateRef = useRef({ mode, nativePercent });

  const notify = useCallback(
    (nextMode: ZoomMode, nextNative: NativePercent, fitEquiv?: number) => {
      onZoomChange?.({
        mode: nextMode,
        nativePercent: nextNative,
        fitEquivalentNativePercent: fitEquiv,
      });
    },
    [onZoomChange],
  );

  const fit = useCallback(() => {
    stateRef.current = { ...stateRef.current, mode: 'fit' };
    setMode('fit');
    notify('fit', stateRef.current.nativePercent);
  }, [notify]);

  const setNative = useCallback(
    (percent: NativePercent) => {
      // Accept any positive value — do NOT snap to stops.
      // Stops are only used by zoomIn/zoomOut increment logic.
      stateRef.current = { mode: 'native', nativePercent: percent };
      setMode('native');
      setNativePercent(percent);
      notify('native', percent);
    },
    [notify],
  );

  const zoomIn = useCallback(
    (fitEquivalentNativePercent?: number) => {
      const { mode: currentMode, nativePercent: currentNative } = stateRef.current;

      if (currentMode === 'fit') {
        // Entering native from fit
        const equiv = fitEquivalentNativePercent ?? 0;
        let targetStop: NativePercent;
        if (equiv >= maxStop) {
          // Fit already exceeds the top stop (e.g. an SVG upscaled to fill the
          // viewport at 950%): continue zooming in geometrically — snapping to
          // `maxStop` here would be a zoom-IN that visibly zooms OUT.
          targetStop = nextZoomAbove(equiv);
        } else if (firstZoomInStrategy === 'hundred') {
          targetStop = clampToStops(100, sortedStops);
        } else if (firstZoomInStrategy === 'first-stop') {
          targetStop = minStop;
        } else {
          // 'above-fit': smallest stop strictly greater than fit-equivalent
          targetStop = sortedStops.find((s) => s > equiv) ?? maxStop;
        }
        stateRef.current = { mode: 'native', nativePercent: targetStop };
        setMode('native');
        setNativePercent(targetStop);
        notify('native', targetStop, fitEquivalentNativePercent);
        return;
      }

      const nextStop = nextZoomAbove(currentNative);

      if (currentNative === maxStop && zoomInAtMaxBehaviour === 'notify') {
        onMaxStopReached?.();
      }

      stateRef.current = { mode: 'native', nativePercent: nextStop };
      setNativePercent(nextStop);
      notify('native', nextStop, fitEquivalentNativePercent);
    },
    [
      sortedStops,
      minStop,
      maxStop,
      nextZoomAbove,
      firstZoomInStrategy,
      zoomInAtMaxBehaviour,
      onMaxStopReached,
      notify,
    ],
  );

  const zoomOut = useCallback(
    (fitEquivalentNativePercent?: number) => {
      const { mode: currentMode, nativePercent: currentNative } = stateRef.current;

      // In fit mode the effective zoom is the fit-equivalent percent — stepping
      // down from it is required when fit lands above the stops list.
      const effective = currentMode === 'fit'
        ? (fitEquivalentNativePercent ?? 0)
        : currentNative;

      // Largest stop strictly below the effective zoom (geometric step when above maxStop)
      const below = nextZoomBelow(effective);

      if (below === undefined || below < minStop) {
        // Already at or below minimum stop
        if (zoomOutBelowMinBehaviour === 'fit' && currentMode !== 'fit') {
          stateRef.current = { mode: 'fit', nativePercent: currentNative };
          setMode('fit');
          notify('fit', currentNative, fitEquivalentNativePercent);
        }
        return;
      }

      stateRef.current = { mode: 'native', nativePercent: below };
      setMode('native');
      setNativePercent(below);
      notify('native', below, fitEquivalentNativePercent);
    },
    [minStop, nextZoomBelow, zoomOutBelowMinBehaviour, notify],
  );

  const peekZoomIn = useCallback(
    (fitEquivalentNativePercent?: number): { mode: ZoomMode; percent: NativePercent } | null => {
      const { mode: m, nativePercent: np } = stateRef.current;
      if (m === 'fit') {
        const equiv = fitEquivalentNativePercent ?? 0;
        let targetStop: NativePercent;
        if (equiv >= maxStop) {
          targetStop = nextZoomAbove(equiv);
        } else if (firstZoomInStrategy === 'hundred') {
          targetStop = clampToStops(100, sortedStops);
        } else if (firstZoomInStrategy === 'first-stop') {
          targetStop = minStop;
        } else {
          targetStop = sortedStops.find((s) => s > equiv) ?? maxStop;
        }
        return { mode: 'native', percent: targetStop };
      }
      return { mode: 'native', percent: nextZoomAbove(np) };
    },
    [sortedStops, minStop, maxStop, nextZoomAbove, firstZoomInStrategy],
  );

  const peekZoomOut = useCallback(
    (
      fitEquivalentNativePercent?: number,
    ): { mode: ZoomMode; percent: NativePercent } | null => {
      const { mode: m, nativePercent: np } = stateRef.current;
      const effective = m === 'fit' ? (fitEquivalentNativePercent ?? 0) : np;
      const below = nextZoomBelow(effective);
      if (below === undefined || below < minStop) {
        if (zoomOutBelowMinBehaviour === 'fit' && m !== 'fit')
          return { mode: 'fit', percent: np };
        return null;
      }
      return { mode: 'native', percent: below };
    },
    [minStop, nextZoomBelow, zoomOutBelowMinBehaviour],
  );

  const reset = useCallback(() => {
    stateRef.current = {
      mode: initialMode,
      nativePercent: resolveInitialNative(),
    };
    setMode(initialMode);
    setNativePercent(stateRef.current.nativePercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, initialNativePercent]);

  const getState = useCallback(
    (fitEquivalentNativePercent?: number): ZoomState => ({
      mode: stateRef.current.mode,
      nativePercent: stateRef.current.nativePercent,
      fitEquivalentNativePercent,
    }),
    [],
  );

  return {
    mode,
    nativePercent,
    zoomIn,
    zoomOut,
    fit,
    setNative,
    reset,
    getState,
    peekZoomIn,
    peekZoomOut,
  };
}
