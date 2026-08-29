import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KEYBOARD_PAN_STEP_VIEWPORT_FRACTION } from '../src/components/ImagePreview/imagePreviewTuning';
import { useImagePreviewKeyboard } from '../src/components/ImagePreview/useImagePreviewKeyboard';

function createParams() {
  return {
    resetHideTimer: vi.fn(),
    onClose: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fit: vi.fn(),
    setNative: vi.fn(),
    mode: 'native' as const,
    prev: vi.fn(),
    next: vi.fn(),
    prevGroup: vi.fn(),
    nextGroup: vi.fn(),
    rotateCW: vi.fn(),
    rotateCCW: vi.fn(),
    panByDelta: vi.fn(),
    keyboardPanStepPx: 90,
    shiftArrowAction: 'pan' as const,
    fitEquivalentNativePercent: 75,
  };
}

describe('useImagePreviewKeyboard panning', () => {
  it('uses 15% of the viewport shorter side as the keyboard pan step', () => {
    expect(KEYBOARD_PAN_STEP_VIEWPORT_FRACTION).toBe(0.15);
  });

  it('maps Ctrl/Command + arrows to viewport-direction panning', () => {
    const params = createParams();
    renderHook(() => useImagePreviewKeyboard(params));

    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true });
    fireEvent.keyUp(window, { key: 'ArrowLeft', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyUp(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyUp(window, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true });
    fireEvent.keyUp(window, { key: 'ArrowDown', ctrlKey: true });

    expect(params.panByDelta.mock.calls).toEqual([
      [90, 0],
      [-90, 0],
      [0, 90],
      [0, -90],
    ]);
    expect(params.prev).not.toHaveBeenCalled();
    expect(params.next).not.toHaveBeenCalled();
    expect(params.zoomIn).not.toHaveBeenCalled();
    expect(params.zoomOut).not.toHaveBeenCalled();
  });

  it('keeps Shift + arrows as a compatibility alias', () => {
    const params = createParams();
    renderHook(() => useImagePreviewKeyboard(params));

    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyUp(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowUp', shiftKey: true });

    expect(params.panByDelta.mock.calls).toEqual([
      [-90, 0],
      [0, 90],
    ]);
  });

  it('uses Shift + Left/Right for rotation when configured', () => {
    const params = {
      ...createParams(),
      shiftArrowAction: 'rotate' as const,
    };
    renderHook(() => useImagePreviewKeyboard(params));

    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyUp(window, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyUp(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowUp', shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });

    expect(params.rotateCCW).toHaveBeenCalledTimes(1);
    expect(params.rotateCW).toHaveBeenCalledTimes(1);
    expect(params.zoomIn).toHaveBeenCalledTimes(1);
    expect(params.zoomOut).toHaveBeenCalledTimes(1);
    expect(params.panByDelta).not.toHaveBeenCalled();
  });

  it('keeps Ctrl/Command panning ahead of the Shift rotation setting', () => {
    const params = {
      ...createParams(),
      shiftArrowAction: 'rotate' as const,
    };
    renderHook(() => useImagePreviewKeyboard(params));

    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true, shiftKey: true });

    expect(params.panByDelta).toHaveBeenCalledWith(-90, 0);
    expect(params.rotateCW).not.toHaveBeenCalled();
  });

  it('combines held perpendicular arrows into a normalized diagonal', () => {
    const params = createParams();
    renderHook(() => useImagePreviewKeyboard(params));

    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowDown', metaKey: true });

    expect(params.panByDelta).toHaveBeenCalledTimes(2);
    const [diagonalX, diagonalY] = params.panByDelta.mock.calls[1];
    expect(diagonalX).toBeCloseTo(-90 / Math.SQRT2);
    expect(diagonalY).toBeCloseTo(-90 / Math.SQRT2);

    fireEvent.keyUp(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowDown', metaKey: true, repeat: true });
    expect(params.panByDelta).toHaveBeenLastCalledWith(0, -90);
  });

  it('tracks repeated direction changes from the actual keys currently held', () => {
    const params = createParams();
    renderHook(() => useImagePreviewKeyboard(params));

    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowDown', metaKey: true });
    fireEvent.keyUp(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft', metaKey: true });
    fireEvent.keyUp(window, { key: 'ArrowDown', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyUp(window, { key: 'ArrowLeft', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyUp(window, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowDown', metaKey: true });

    expect(params.panByDelta).toHaveBeenCalledTimes(6);
    const diagonal = 90 / Math.SQRT2;
    expect(params.panByDelta.mock.calls[1][0]).toBeCloseTo(-diagonal);
    expect(params.panByDelta.mock.calls[1][1]).toBeCloseTo(-diagonal);
    expect(params.panByDelta.mock.calls[2][0]).toBeCloseTo(diagonal);
    expect(params.panByDelta.mock.calls[2][1]).toBeCloseTo(-diagonal);
    expect(params.panByDelta.mock.calls[3][0]).toBeCloseTo(diagonal);
    expect(params.panByDelta.mock.calls[3][1]).toBeCloseTo(diagonal);
    expect(params.panByDelta.mock.calls[4][0]).toBeCloseTo(-diagonal);
    expect(params.panByDelta.mock.calls[4][1]).toBeCloseTo(diagonal);
    expect(params.panByDelta.mock.calls[5][0]).toBeCloseTo(-diagonal);
    expect(params.panByDelta.mock.calls[5][1]).toBeCloseTo(-diagonal);
  });

  it('cancels opposite held directions and resumes after either one is released', () => {
    const params = createParams();
    renderHook(() => useImagePreviewKeyboard(params));

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true });
    fireEvent.keyUp(window, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, repeat: true });

    expect(params.panByDelta).toHaveBeenCalledTimes(2);
    expect(params.panByDelta).toHaveBeenLastCalledWith(90, 0);
  });
});
