import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThumbnailsStrip } from '../src/components/ImagePreview/parts/ThumbnailsStrip';

const entries = [0, 1, 2].map((flatIndex) => ({
  flatIndex,
  item: { id: `image-${flatIndex}`, src: `/image-${flatIndex}.jpg` },
}));

describe('ThumbnailsStrip preload status', () => {
  it('virtualizes a large strip on its first render around the active item', () => {
    const manyEntries = Array.from({ length: 500 }, (_, flatIndex) => ({
      flatIndex,
      item: { id: `large-${flatIndex}`, src: `/large-${flatIndex}.jpg` },
    }));
    const { container } = render(
      <ThumbnailsStrip
        entries={manyEntries}
        activeFlatIndex={250}
        ariaLabel="thumbs"
        thumbAria={(index) => `thumb-${index}`}
        onSelect={vi.fn()}
      />,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.length).toBeLessThan(100);
    expect(container.querySelector('[aria-current="true"]')).not.toBeNull();
  });

  it('uses the measured download ratio for the green bar', () => {
    const { container } = render(
      <ThumbnailsStrip
        entries={entries}
        activeFlatIndex={0}
        preloadStatus={{
          1: { phase: 'loading', progress: 0.42, loadedBytes: 42, totalBytes: 100 },
        }}
        ariaLabel="thumbs"
        thumbAria={(index) => `thumb-${index}`}
        onSelect={vi.fn()}
      />,
    );

    const fill = container.querySelector<HTMLElement>('[data-preload-bar="loading"] > span');
    expect(fill?.style.width).toBe('42%');
    expect(fill?.style.background).toBe('rgb(52, 211, 153)');
  });

  it('shows an animated indeterminate segment instead of a fake fixed ratio', () => {
    const { container } = render(
      <ThumbnailsStrip
        entries={entries}
        activeFlatIndex={0}
        preloadStatus={{ 1: { phase: 'loading', loadedBytes: 42 } }}
        ariaLabel="thumbs"
        thumbAria={(index) => `thumb-${index}`}
        onSelect={vi.fn()}
      />,
    );

    const fill = container.querySelector<HTMLElement>('[data-preload-bar="loading"] > span');
    expect(fill?.style.width).toBe('32%');
    expect(fill?.style.animation).toContain('_rip_thumbnail_preload');
  });

  it('colors measured Screen and Browse preparation progress by their fixed target LOD', () => {
    const { container } = render(
      <ThumbnailsStrip
        entries={entries}
        activeFlatIndex={0}
        preloadStatus={{
          1: { phase: 'loading', targetLod: 'screen', progress: 0.35 },
          2: { phase: 'loading', targetLod: 'browse', progress: 0.65 },
        }}
        ariaLabel="thumbs"
        thumbAria={(index) => `thumb-${index}`}
        onSelect={vi.fn()}
      />,
    );

    const fills = container.querySelectorAll<HTMLElement>('[data-preload-bar="loading"] > span');
    expect(fills[0]?.style.background).toBe('rgb(96, 165, 250)');
    expect(fills[0]?.style.width).toBe('35%');
    expect(fills[1]?.style.background).toBe('rgb(192, 132, 252)');
    expect(fills[1]?.style.width).toBe('65%');
  });

  it('keeps active and inactive thumbnails at full opacity', () => {
    const { container } = render(
      <ThumbnailsStrip
        entries={entries}
        activeFlatIndex={1}
        preloadStatus={{ 0: { phase: 'display-ready', progress: 1 } }}
        ariaLabel="thumbs"
        thumbAria={(index) => `thumb-${index}`}
        onSelect={vi.fn()}
      />,
    );

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.style.opacity === '1')).toBe(true);
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    expect(buttons[1].style.boxShadow).toContain('rgba(96, 165, 250, 0.55)');
  });

  it('uses a calm, visually distinct violet bar for Browse-ready textures', () => {
    const { container } = render(
      <ThumbnailsStrip
        entries={entries}
        activeFlatIndex={0}
        preloadStatus={{ 1: { phase: 'browse-ready', progress: 1 } }}
        ariaLabel="thumbs"
        thumbAria={(index) => `thumb-${index}`}
        onSelect={vi.fn()}
      />,
    );

    const fill = container.querySelector<HTMLElement>(
      '[data-preload-bar="browse-ready"] > span',
    );
    expect(fill?.style.background).toBe('rgb(192, 132, 252)');
  });
});
