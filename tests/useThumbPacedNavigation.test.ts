import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThumbPacedNavigation } from '../src/components/ImagePreview/useThumbPacedNavigation';

describe('useThumbPacedNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('steps once immediately on beginHold', () => {
    const next = vi.fn();
    const { result } = renderHook(() =>
      useThumbPacedNavigation({
        currentIndex: 2,
        thumbReady: true,
        next,
        prev: vi.fn(),
        minVisibleMs: 300,
      }),
    );

    act(() => result.current.beginHold('next'));
    expect(next).toHaveBeenCalledTimes(1);
    expect(result.current.holdingDirection).toBe('next');
    act(() => result.current.endHold('next'));
    expect(result.current.holdingDirection).toBeNull();
  });

  it('separates the first repeat delay from the per-image visible dwell', () => {
    const next = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentIndex }) => useThumbPacedNavigation({
        currentIndex,
        thumbReady: true,
        next,
        prev: vi.fn(),
        repeatDelayMs: 300,
        minVisibleMs: 100,
      }),
      { initialProps: { currentIndex: 0 } },
    );

    act(() => result.current.beginHold('next'));
    act(() => rerender({ currentIndex: 1 }));
    act(() => vi.advanceTimersByTime(299));
    expect(next).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(next).toHaveBeenCalledTimes(2);

    act(() => rerender({ currentIndex: 2 }));
    act(() => vi.advanceTimersByTime(99));
    expect(next).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(1));
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('starts the visible dwell only after a slow image is presented', () => {
    const next = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentIndex, thumbReady }) => useThumbPacedNavigation({
        currentIndex,
        thumbReady,
        next,
        prev: vi.fn(),
        repeatDelayMs: 300,
        minVisibleMs: 200,
      }),
      { initialProps: { currentIndex: 0, thumbReady: true } },
    );

    act(() => result.current.beginHold('next'));
    act(() => rerender({ currentIndex: 1, thumbReady: false }));
    act(() => vi.advanceTimersByTime(500));
    expect(next).toHaveBeenCalledTimes(1);
    act(() => rerender({ currentIndex: 1, thumbReady: true }));
    act(() => vi.advanceTimersByTime(199));
    expect(next).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('short press: release before min-visible on the new image → no second step', () => {
    const next = vi.fn();
    const { result, rerender } = renderHook(
      ({ thumbReady, currentIndex }) =>
        useThumbPacedNavigation({
          currentIndex,
          thumbReady,
          next,
          prev: vi.fn(),
          minVisibleMs: 300,
        }),
      { initialProps: { thumbReady: true, currentIndex: 0 } },
    );

    act(() => result.current.beginHold('next'));
    expect(next).toHaveBeenCalledTimes(1);

    act(() => rerender({ thumbReady: true, currentIndex: 1 }));
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.endHold('next');
    });
    act(() => vi.advanceTimersByTime(500));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('while held: waits until paintable, then minVisibleMs, then steps once — no backlog after endHold', () => {
    const next = vi.fn();
    const { result, rerender } = renderHook(
      ({ thumbReady, currentIndex }) =>
        useThumbPacedNavigation({
          currentIndex,
          thumbReady,
          next,
          prev: vi.fn(),
          minVisibleMs: 300,
        }),
      { initialProps: { thumbReady: true, currentIndex: 0 } },
    );

    act(() => result.current.beginHold('next'));
    expect(next).toHaveBeenCalledTimes(1);

    // Land on index 1 — not paintable yet (e.g. large original, no thumb).
    act(() => rerender({ thumbReady: false, currentIndex: 1 }));
    act(() => vi.advanceTimersByTime(2000));
    expect(next).toHaveBeenCalledTimes(1);

    // Becomes paintable → must still wait minVisibleMs.
    act(() => rerender({ thumbReady: true, currentIndex: 1 }));
    act(() => vi.advanceTimersByTime(299));
    expect(next).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(1));
    expect(next).toHaveBeenCalledTimes(2);

    // Land on 2, paint instantly, wait 300ms → step to 3.
    act(() => rerender({ thumbReady: true, currentIndex: 2 }));
    act(() => vi.advanceTimersByTime(300));
    expect(next).toHaveBeenCalledTimes(3);

    act(() => rerender({ thumbReady: true, currentIndex: 3 }));
    act(() => result.current.endHold('next'));
    // Would have stepped again after 300ms if still held — must not.
    act(() => vi.advanceTimersByTime(1000));
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('endHold cancels a pending dwell even if paint was already ready', () => {
    const next = vi.fn();
    const { result, rerender } = renderHook(
      ({ thumbReady, currentIndex }) =>
        useThumbPacedNavigation({
          currentIndex,
          thumbReady,
          next,
          prev: vi.fn(),
          minVisibleMs: 300,
        }),
      { initialProps: { thumbReady: true, currentIndex: 0 } },
    );

    act(() => result.current.beginHold('next'));
    act(() => rerender({ thumbReady: true, currentIndex: 1 }));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.endHold('next'));
    act(() => vi.advanceTimersByTime(1000));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('minVisibleMs=0: endHold before setTimeout(0) runs → no further steps (no backlog)', () => {
    const next = vi.fn();
    const { result, rerender } = renderHook(
      ({ thumbReady, currentIndex }) =>
        useThumbPacedNavigation({
          currentIndex,
          thumbReady,
          next,
          prev: vi.fn(),
          repeatDelayMs: 0,
          minVisibleMs: 0,
        }),
      { initialProps: { thumbReady: true, currentIndex: 0 } },
    );

    act(() => result.current.beginHold('next'));
    expect(next).toHaveBeenCalledTimes(1);

    // Land + immediately ready → arms wait=0 timer.
    act(() => rerender({ thumbReady: true, currentIndex: 1 }));

    // Release before the macrotask runs (classic holdMinVisibleMs=0 race).
    act(() => result.current.endHold('next'));
    act(() => {
      vi.runAllTimers();
    });
    expect(next).toHaveBeenCalledTimes(1);

    // Later paint flips must not resume a dead hold.
    act(() => rerender({ thumbReady: true, currentIndex: 1 }));
    act(() => vi.runAllTimers());
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('minVisibleMs=0 while held: continues only while holdRef is set; stops hard on endHold', () => {
    const next = vi.fn();
    const { result, rerender } = renderHook(
      ({ thumbReady, currentIndex }) =>
        useThumbPacedNavigation({
          currentIndex,
          thumbReady,
          next,
          prev: vi.fn(),
          repeatDelayMs: 0,
          minVisibleMs: 0,
        }),
      { initialProps: { thumbReady: true, currentIndex: 0 } },
    );

    act(() => result.current.beginHold('next'));
    expect(next).toHaveBeenCalledTimes(1);

    act(() => rerender({ thumbReady: true, currentIndex: 1 }));
    act(() => vi.runAllTimers());
    expect(next).toHaveBeenCalledTimes(2);

    act(() => rerender({ thumbReady: true, currentIndex: 2 }));
    act(() => result.current.endHold('next'));
    act(() => vi.runAllTimers());
    expect(next).toHaveBeenCalledTimes(2);
  });
});
