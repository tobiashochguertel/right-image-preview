import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useZoomState } from '../src/components/ImagePreview/useZoomState';

const DEFAULT_OPTS = {
  stops: [25, 50, 100, 200, 400],
  initialMode: 'fit' as const,
  firstZoomInStrategy: 'above-fit' as const,
  zoomOutBelowMinBehaviour: 'fit' as const,
  zoomInAtMaxBehaviour: 'noop' as const,
};

describe('useZoomState', () => {
  describe('initial state', () => {
    it('starts in fit mode by default', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      expect(result.current.mode).toBe('fit');
    });

    it('starts in native mode when initialMode=native', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 100 }),
      );
      expect(result.current.mode).toBe('native');
      expect(result.current.nativePercent).toBe(100);
    });

    it('clamps initialNativePercent to nearest stop', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 80 }),
      );
      // Nearest to 80 among [25,50,100,200,400] is 100
      expect(result.current.nativePercent).toBe(100);
    });
  });

  describe('zoomIn from fit mode', () => {
    it('strategy=above-fit: enters native at smallest stop above fit-equivalent', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      expect(result.current.mode).toBe('fit');

      act(() => {
        // fitEquivalentNativePercent = 60% (e.g., image is wider than viewport)
        result.current.zoomIn(60);
      });

      expect(result.current.mode).toBe('native');
      // smallest stop > 60 is 100
      expect(result.current.nativePercent).toBe(100);
    });

    it('strategy=above-fit: continues geometrically when fit-equivalent is above all stops', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      act(() => {
        // A small SVG upscaled by Fit (e.g. to 950%): zoom-IN must not snap
        // DOWN to maxStop — extend the ladder by the top-gap ratio (400/200=2).
        result.current.zoomIn(500); // above all stops
      });
      expect(result.current.nativePercent).toBe(1000);
    });

    it('strategy=first-stop: always enters at first stop', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, firstZoomInStrategy: 'first-stop' }),
      );
      act(() => {
        result.current.zoomIn(60);
      });
      expect(result.current.nativePercent).toBe(25);
    });

    it('strategy=hundred: always enters at 100%', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, firstZoomInStrategy: 'hundred' }),
      );
      act(() => {
        result.current.zoomIn(60);
      });
      expect(result.current.nativePercent).toBe(100);
    });
  });

  describe('zoomIn from native mode', () => {
    it('advances to the next stop', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 50 }),
      );
      act(() => result.current.zoomIn());
      expect(result.current.nativePercent).toBe(100);
    });

    it('extends past max stop geometrically when behaviour=noop', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 400 }),
      );
      act(() => result.current.zoomIn());
      expect(result.current.nativePercent).toBe(800);
    });

    it('calls onMaxStopReached when behaviour=notify', () => {
      const onMaxStopReached = vi.fn();
      const { result } = renderHook(() =>
        useZoomState({
          ...DEFAULT_OPTS,
          initialMode: 'native',
          initialNativePercent: 400,
          zoomInAtMaxBehaviour: 'notify',
          onMaxStopReached,
        }),
      );
      act(() => result.current.zoomIn());
      expect(onMaxStopReached).toHaveBeenCalledOnce();
      // ...but zoom still continues past the top stop.
      expect(result.current.nativePercent).toBe(800);
    });
  });

  describe('zoomOut from native mode', () => {
    it('goes to the previous stop', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 200 }),
      );
      act(() => result.current.zoomOut());
      expect(result.current.nativePercent).toBe(100);
    });

    it('switches to fit when below min stop and behaviour=fit', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 25 }),
      );
      act(() => result.current.zoomOut());
      expect(result.current.mode).toBe('fit');
    });

    it('does nothing at min stop when behaviour=noop', () => {
      const { result } = renderHook(() =>
        useZoomState({
          ...DEFAULT_OPTS,
          initialMode: 'native',
          initialNativePercent: 25,
          zoomOutBelowMinBehaviour: 'noop',
        }),
      );
      act(() => result.current.zoomOut());
      expect(result.current.mode).toBe('native');
      expect(result.current.nativePercent).toBe(25);
    });
  });

  describe('zoomOut from fit mode', () => {
    it('is a noop without a fit-equivalent', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      act(() => result.current.zoomOut());
      expect(result.current.mode).toBe('fit');
    });

    it('is a noop when fit-equivalent is already at/below the first stop', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      act(() => result.current.zoomOut(20)); // below min stop 25
      expect(result.current.mode).toBe('fit');
    });

    it('steps down to the stop below the fit-equivalent', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      act(() => result.current.zoomOut(150));
      expect(result.current.mode).toBe('native');
      expect(result.current.nativePercent).toBe(100);
    });

    it('steps down geometrically when fit-equivalent exceeds all stops', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      // Wheel-down at fit=950% must zoom out, not sit dead (previous behaviour)
      // or jump to maxStop.
      act(() => result.current.zoomOut(950));
      expect(result.current.mode).toBe('native');
      expect(result.current.nativePercent).toBe(475); // 950 / 2
    });
  });

  describe('fit()', () => {
    it('switches to fit mode from native', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 100 }),
      );
      act(() => result.current.fit());
      expect(result.current.mode).toBe('fit');
    });
  });

  describe('setNative()', () => {
    it('enters native mode at given percent', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      act(() => result.current.setNative(200));
      expect(result.current.mode).toBe('native');
      expect(result.current.nativePercent).toBe(200);
    });

    it('keeps arbitrary percent from setNative (no stop snapping)', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      act(() => result.current.setNative(130));
      expect(result.current.nativePercent).toBe(130);
    });
  });

  describe('sequential zoom round-trip', () => {
    it('fit → zoomIn → zoomIn → zoomOut → zoomOut → fit', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));

      act(() => result.current.zoomIn(60)); // fit → native 100
      expect(result.current.mode).toBe('native');
      expect(result.current.nativePercent).toBe(100);

      act(() => result.current.zoomIn()); // 100 → 200
      expect(result.current.nativePercent).toBe(200);

      act(() => result.current.zoomOut()); // 200 → 100
      expect(result.current.nativePercent).toBe(100);

      act(() => result.current.zoomOut()); // 100 → 50
      expect(result.current.nativePercent).toBe(50);

      act(() => result.current.zoomOut()); // 50 → 25
      expect(result.current.nativePercent).toBe(25);

      act(() => result.current.zoomOut()); // 25 → fit (below min)
      expect(result.current.mode).toBe('fit');
    });
  });

  describe('onZoomChange callback', () => {
    it('is called on each zoom action with correct state', () => {
      const onZoomChange = vi.fn();
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, onZoomChange }),
      );
      act(() => result.current.zoomIn(60));
      expect(onZoomChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ mode: 'native', nativePercent: 100 }),
      );
      act(() => result.current.fit());
      expect(onZoomChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ mode: 'fit' }),
      );
    });
  });

  describe('reset()', () => {
    it('restores initial state', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      act(() => {
        result.current.zoomIn(60);
        result.current.zoomIn();
      });
      act(() => result.current.reset());
      expect(result.current.mode).toBe('fit');
    });
  });

  describe('boundary stops', () => {
    it('extends past the top stop instead of dead-ending', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 400 }),
      );
      act(() => result.current.zoomIn()); // at max — continues geometrically
      expect(result.current.nativePercent).toBe(800);
    });

    it('rejoins the stop ladder when zooming out crosses back below maxStop', () => {
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native', initialNativePercent: 100 }),
      );
      act(() => result.current.setNative(410)); // just above maxStop
      act(() => result.current.zoomOut());
      // Geometric step would be 205 — below maxStop, so the previous stop wins.
      expect(result.current.nativePercent).toBe(400);
      act(() => result.current.zoomOut());
      expect(result.current.nativePercent).toBe(200);
    });

    it('never produces a non-finite percent when native is above maxStop', () => {
      // Regression: native > maxStop (reachable via pinch zoom, maxStop × 4)
      // used to index stops[-1] → undefined percent.
      const { result } = renderHook(() =>
        useZoomState({ ...DEFAULT_OPTS, initialMode: 'native' }),
      );
      act(() => result.current.setNative(500));
      act(() => result.current.zoomIn());
      const zoomedIn = result.current.nativePercent;
      expect(Number.isFinite(zoomedIn)).toBe(true);
      expect(zoomedIn).toBe(1000);
      act(() => result.current.zoomOut());
      expect(result.current.nativePercent).toBe(500);
    });

    it('peekZoomIn/peekZoomOut predict the applied targets past maxStop', () => {
      const { result } = renderHook(() => useZoomState(DEFAULT_OPTS));
      expect(result.current.peekZoomIn(950)).toEqual({ mode: 'native', percent: 1900 });
      expect(result.current.peekZoomOut(950)).toEqual({ mode: 'native', percent: 475 });
      expect(result.current.peekZoomOut(20)).toBeNull();
    });
  });
});
