import { describe, expect, it } from 'vitest';

import { PriorityTaskQueue } from '../src/components/ImagePreview/renderers/raster-webgl/PriorityTaskQueue';

describe('PriorityTaskQueue', () => {
  it('lets current-image work overtake queued neighbor work', async () => {
    const queue = new PriorityTaskQueue(1);
    const order: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = queue.schedule(1, async () => {
      await gate;
      order.push('running-neighbor');
    });
    const queuedNeighbor = queue.schedule(1, async () => { order.push('queued-neighbor'); });
    const current = queue.schedule(100, async () => { order.push('current'); });

    releaseFirst();
    await Promise.all([first, queuedNeighbor, current]);
    expect(order).toEqual(['running-neighbor', 'current', 'queued-neighbor']);
  });

  it('rejects queued work when disposed', async () => {
    const queue = new PriorityTaskQueue(1);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const running = queue.schedule(1, () => gate);
    const queued = queue.schedule(1, async () => undefined);
    queue.dispose();
    await expect(queued).rejects.toThrow('disposed');
    release();
    await running;
  });

  it('reserves one concurrency lane for foreground work', async () => {
    const queue = new PriorityTaskQueue(2, 50);
    let releaseBackground!: () => void;
    const backgroundGate = new Promise<void>((resolve) => { releaseBackground = resolve; });
    const firstBackground = queue.schedule(1, () => backgroundGate);
    let secondStarted = false;
    const secondBackground = queue.schedule(1, async () => { secondStarted = true; });

    await Promise.resolve();
    expect(secondStarted).toBe(false);
    await queue.schedule(100, async () => undefined);
    expect(secondStarted).toBe(false);
    releaseBackground();
    await Promise.all([firstBackground, secondBackground]);
    expect(secondStarted).toBe(true);
  });

  it('cancels only queued work in the requested group', async () => {
    const queue = new PriorityTaskQueue(1);
    let release!: () => void;
    const running = queue.schedule(1, () => new Promise<void>((resolve) => { release = resolve; }));
    const stale = queue.schedule(1, async () => undefined, 'display');
    const full = queue.schedule(2, async () => undefined, 'full');

    queue.cancelPending('display');
    await expect(stale).rejects.toThrow('cancelled');
    release();
    await Promise.all([running, full]);
  });
});
