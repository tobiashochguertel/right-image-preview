import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MediaKind } from '../src/components/ImagePreview/core/media-kind';
import { MediaStage } from '../src/components/ImagePreview/renderers/MediaStage';

vi.mock('../src/components/ImagePreview/renderers/raster-webgl/WebGLRasterStage', () => ({
  WebGLRasterStage: ({
    active,
    resourceKey,
    preloadPaused,
    onPresented,
  }: {
    active: boolean;
    resourceKey?: string;
    preloadPaused?: boolean;
    onPresented(): void;
  }) => (
    <div
      data-rip-raster-canvas=""
      data-raster-active={active ? 'true' : 'false'}
      data-preload-paused={preloadPaused ? 'true' : 'false'}
      data-resource-key={resourceKey}
      onClick={onPresented}
    />
  ),
}));

const transform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  cssTransform: 'translate(0px, 0px) rotate(0deg) scale(1)',
};

describe('MediaStage dispatch', () => {
  it.each([
    ['svg', 'data-rip-svg-viewer'],
    ['animated-image', 'data-rip-animated-viewer'],
    ['video', 'data-rip-video-viewer'],
  ] as const)('mounts the independent %s viewer', (kind, attribute) => {
    const { container } = renderStage(kind);
    expect(container.querySelector(`[${attribute}]`)).not.toBeNull();
    expect(container.querySelector('[data-rip-raster-canvas]')).toHaveAttribute(
      'data-raster-active',
      'false',
    );
  });

  it('renders unsupported media and forwards it through the public error contract', async () => {
    const onPhaseChange = vi.fn();
    const onError = vi.fn();
    render(stageElement('unknown', 'sample-unknown', onPhaseChange, vi.fn(), onError));
    expect(screen.getByRole('status')).toHaveTextContent('Unsupported media: sample.bin');
    expect(onPhaseChange).toHaveBeenCalledWith('unsupported');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toEqual(
      new Error('Unsupported or unreadable media source'),
    );
  });

  it('does not report transient unknown media while byte detection is pending', () => {
    const onPhaseChange = vi.fn();
    const onError = vi.fn();
    render(stageElement('unknown', 'sample-pending', onPhaseChange, vi.fn(), onError, true));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onPhaseChange).toHaveBeenCalledWith('loading');
    expect(onPhaseChange).not.toHaveBeenCalledWith('unsupported');
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps the raster WebGL stage mounted across resource changes', () => {
    const view = renderStage('raster');
    const firstCanvas = view.container.querySelector('[data-rip-raster-canvas]');
    expect(firstCanvas).not.toBeNull();

    view.rerender(stageElement('raster', 'sample-raster-next'));

    const nextCanvas = view.container.querySelector('[data-rip-raster-canvas]');
    expect(nextCanvas).toBe(firstCanvas);
    expect(nextCanvas).toHaveAttribute('data-resource-key', 'sample-raster-next');
  });

  it('keeps the same raster stage through raster → video → raster navigation', () => {
    const view = render(stageElement('raster', 'raster-a'));
    const persistentCanvas = view.container.querySelector('[data-rip-raster-canvas]');

    view.rerender(stageElement('video', 'video-between'));
    expect(view.container.querySelector('[data-rip-raster-canvas]')).toBe(persistentCanvas);
    expect(persistentCanvas).toHaveAttribute('data-raster-active', 'false');
    expect(view.container.querySelector('[data-rip-video-viewer]')).not.toBeNull();

    view.rerender(stageElement('raster', 'raster-b'));
    expect(view.container.querySelector('[data-rip-raster-canvas]')).toBe(persistentCanvas);
    expect(persistentCanvas).toHaveAttribute('data-raster-active', 'true');
    expect(persistentCanvas).toHaveAttribute('data-resource-key', 'raster-b');
  });

  it('forwards the persistent Canvas presentation signal to the current visit', () => {
    const presentedA = vi.fn();
    const presentedB = vi.fn();
    const view = render(stageElement('raster', 'raster-a', vi.fn(), presentedA));
    const persistentCanvas = view.container.querySelector('[data-rip-raster-canvas]')!;

    fireEvent.click(persistentCanvas);
    expect(presentedA).toHaveBeenCalledTimes(1);

    view.rerender(stageElement('raster', 'raster-b', vi.fn(), presentedB));
    fireEvent.click(persistentCanvas);
    expect(presentedA).toHaveBeenCalledTimes(1);
    expect(presentedB).toHaveBeenCalledTimes(1);
  });

  it('suspends new Raster preload work only while video is playing', () => {
    const view = renderStage('video');
    const video = view.container.querySelector('video');
    const canvas = view.container.querySelector('[data-rip-raster-canvas]');
    expect(video).not.toBeNull();
    expect(canvas).toHaveAttribute('data-preload-paused', 'false');

    fireEvent.play(video!);
    expect(canvas).toHaveAttribute('data-preload-paused', 'true');

    fireEvent.pause(video!);
    expect(canvas).toHaveAttribute('data-preload-paused', 'false');
  });
});

function stageElement(
  kind: MediaKind,
  resourceKey = 'sample-' + kind,
  onPhaseChange = vi.fn(),
  onPresented = vi.fn(),
  onError = vi.fn(),
  kindPending = false,
) {
  return (
    <MediaStage
      resourceKey={resourceKey}
      kind={kind}
      kindPending={kindPending}
      source={{ type: 'url', href: `/${resourceKey}.bin` }}
      alt="sample"
      label="sample.bin"
      transform={transform}
      onDimensions={vi.fn()}
      onPhaseChange={onPhaseChange}
      onError={onError}
      onPresented={onPresented}
    />
  );
}

function renderStage(kind: MediaKind, onPhaseChange = vi.fn()) {
  return render(stageElement(kind, 'sample-' + kind, onPhaseChange));
}
