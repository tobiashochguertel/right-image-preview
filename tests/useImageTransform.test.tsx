import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useImageTransform } from '../src/components/ImagePreview/useImageTransform';

describe('useImageTransform pan scheduling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('coalesces pointer moves into the latest transform for one animation frame', () => {
    let frame: FrameRequestCallback | undefined;
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frame = callback;
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const { result } = renderHook(() => useImageTransform({
      mode: 'native',
      nativePercent: 100,
      fitResetPan: true,
    }));
    const target = { setPointerCapture: vi.fn() };
    const pointer = (clientX: number): ReactPointerEvent => ({
      button: 0,
      buttons: 1,
      clientX,
      clientY: 0,
      pointerId: 1,
      nativeEvent: {} as PointerEvent,
      target,
    }) as unknown as ReactPointerEvent;

    act(() => result.current.onPanStart(pointer(0)));
    act(() => {
      result.current.onPanMove(pointer(10));
      result.current.onPanMove(pointer(25));
    });

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(result.current.transform.translateX).toBe(0);
    act(() => frame?.(performance.now()));
    expect(result.current.transform.translateX).toBe(25);
  });
});
