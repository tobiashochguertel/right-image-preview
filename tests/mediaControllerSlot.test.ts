import { describe, expect, it, vi } from 'vitest';

import { MediaControllerSlot } from '../src/components/ImagePreview/core/media-controller-slot';
import type { MediaController } from '../src/components/ImagePreview/core/media-contract';

describe('MediaControllerSlot', () => {
  it('delivers repeated equal commands as separate executions', () => {
    const execute = vi.fn();
    const slot = new MediaControllerSlot();
    slot.attach(controller(execute));

    expect(slot.execute({ type: 'zoom-in' })).toBe(true);
    expect(slot.execute({ type: 'zoom-in' })).toBe(true);
    expect(slot.execute({ type: 'zoom-in' })).toBe(true);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('reports safe empty state before a renderer attaches', () => {
    const slot = new MediaControllerSlot();
    expect(slot.attached).toBe(false);
    expect(slot.execute({ type: 'fit' })).toBe(false);
    expect(slot.getViewState()).toEqual({});
    expect(slot.getCapabilities()).toMatchObject({
      zoom: false,
      pan: false,
      minimap: false,
    });
  });

  it('does not let stale renderer cleanup detach its replacement', () => {
    const firstExecute = vi.fn();
    const secondExecute = vi.fn();
    const slot = new MediaControllerSlot();
    const detachFirst = slot.attach(controller(firstExecute));
    const detachSecond = slot.attach(controller(secondExecute));

    detachFirst();
    expect(slot.execute({ type: 'reset' })).toBe(true);
    expect(firstExecute).not.toHaveBeenCalled();
    expect(secondExecute).toHaveBeenCalledTimes(1);

    detachSecond();
    expect(slot.attached).toBe(false);
  });
});

function controller(execute: MediaController['execute']): MediaController {
  return {
    execute,
    getCapabilities: () => ({
      zoom: true,
      nativeZoom: true,
      pan: true,
      rotate: true,
      flip: true,
      minimap: true,
    }),
    getViewState: () => ({
      zoomMode: 'fit',
      zoomPercent: 42,
    }),
  };
}
