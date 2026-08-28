import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState, type ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImagePreview } from '../src/components/ImagePreview';
import type { ImagePreviewRef } from '../src/components/ImagePreview/types';

vi.mock('../src/components/ImagePreview/renderers/raster-webgl/WebGLRasterStage', async () => {
  const { useEffect } = await import('react');

  interface MockRasterSource {
    flatIndex?: number;
  }

  interface MockRasterProps {
    active: boolean;
    knownSize?: { width: number; height: number };
    preloadSources?: readonly MockRasterSource[];
    onDimensions(width: number, height: number): void;
    onPhaseChange(phase: 'display-ready'): void;
    onPresented(): void;
    onError(error: Error): void;
    onPreloadStateChange?(
      source: MockRasterSource,
      phase: 'display-ready',
    ): void;
  }

  return {
    WebGLRasterStage: ({
      active,
      knownSize,
      preloadSources,
      onDimensions,
      onPhaseChange,
      onPresented,
      onError,
      onPreloadStateChange,
    }: MockRasterProps) => {
      useEffect(() => {
        if (!active) return;
        onDimensions(knownSize?.width ?? 800, knownSize?.height ?? 600);
        onPhaseChange('display-ready');
        onPresented();
        preloadSources?.forEach((source) => {
          onPreloadStateChange?.(source, 'display-ready');
        });
      }, [
        active,
        knownSize?.height,
        knownSize?.width,
        onDimensions,
        onPhaseChange,
        onPreloadStateChange,
        onPresented,
        preloadSources,
      ]);

      return (
        <canvas
          data-rip-raster-canvas=""
          data-raster-active={active ? 'true' : 'false'}
          onClick={() => onError(new Error('mock Raster failure'))}
        />
      );
    },
  };
});

// jsdom doesn't load images, so naturalWidth/Height are 0 by default.
// We patch Image prototype to return predictable dimensions.
function mockImageLoad(naturalWidth = 800, naturalHeight = 600) {
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    get() {
      return naturalWidth;
    },
    configurable: true,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
    get() {
      return naturalHeight;
    },
    configurable: true,
  });
}

const SINGLE_SRC = 'https://example.com/image.jpg';
const IMAGES = [
  { src: 'https://example.com/a.jpg', alt: '图A' },
  { src: 'https://example.com/b.jpg', alt: '图B' },
  { src: 'https://example.com/c.jpg', alt: '图C' },
];

const GROUPED_IMAGES = [
  {
    name: '组A',
    images: [
      { src: 'https://example.com/a1.jpg' },
      { src: 'https://example.com/a2.jpg' },
      { src: 'https://example.com/a3.jpg' },
    ],
  },
  {
    name: '组B',
    images: [
      { src: 'https://example.com/b1.jpg' },
      { src: 'https://example.com/b2.jpg' },
      { src: 'https://example.com/b3.jpg' },
      { src: 'https://example.com/b4.jpg' },
    ],
  },
];

/** Tests assert Chinese copy; `resolveStrings(undefined)` is English. */
const ZH = { language: 'zh' as const } satisfies Pick<ComponentProps<typeof ImagePreview>, 'language'>;
const initialRequestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'requestFullscreen',
);
const initialExitFullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
const initialFullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');

function restoreInitialFullscreenApi() {
  if (initialRequestFullscreenDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', initialRequestFullscreenDescriptor);
  } else {
    delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
  }
  if (initialExitFullscreenDescriptor) {
    Object.defineProperty(document, 'exitFullscreen', initialExitFullscreenDescriptor);
  } else {
    delete (document as { exitFullscreen?: unknown }).exitFullscreen;
  }
  if (initialFullscreenElementDescriptor) {
    Object.defineProperty(document, 'fullscreenElement', initialFullscreenElementDescriptor);
  } else {
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
  }
}

function installBrowserFullscreenMock(options: {
  request?: (root: HTMLElement, setActive: (element: Element | null) => void) => void | Promise<void>;
  exit?: (setActive: (element: Element | null) => void) => void | Promise<void>;
} = {}) {
  const requestDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen');
  const exitDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
  const fullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
  let active: Element | null = null;
  const setActive = (element: Element | null) => {
    active = element;
  };
  const requestFullscreen = vi.fn(function requestFullscreen(this: HTMLElement) {
    return options.request?.(this, setActive);
  });
  const exitFullscreen = vi.fn(() => options.exit?.(setActive));

  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => active,
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  });

  return {
    requestFullscreen,
    exitFullscreen,
    restore() {
      if (requestDescriptor) Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', requestDescriptor);
      else delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
      if (exitDescriptor) Object.defineProperty(document, 'exitFullscreen', exitDescriptor);
      else delete (document as { exitFullscreen?: unknown }).exitFullscreen;
      if (fullscreenElementDescriptor) Object.defineProperty(document, 'fullscreenElement', fullscreenElementDescriptor);
      else delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    },
  };
}

describe('ImagePreview component', () => {
  beforeEach(() => {
    // Give jsdom images predictable natural dimensions for transform calculations.
    mockImageLoad();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreInitialFullscreenApi();
  });

  describe('visibility', () => {
    it('renders nothing when visible=false', () => {
      const { container } = render(
        <ImagePreview src={SINGLE_SRC} visible={false} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders dialog when visible=true', () => {
      render(<ImagePreview src={SINGLE_SRC} visible {...ZH} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('toolbar', () => {
    it('renders toolbar buttons', () => {
      render(<ImagePreview src={SINGLE_SRC} visible {...ZH} />);
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
      expect(screen.getByLabelText('放大')).toBeInTheDocument();
      expect(screen.getByLabelText('缩小')).toBeInTheDocument();
      expect(screen.getByLabelText('适应视口')).toBeInTheDocument();
      expect(screen.getByLabelText('原始比例 (100%)')).toBeInTheDocument();
      expect(screen.getByLabelText('关闭 (Esc)')).toBeInTheDocument();
    });
  });

  describe('close behaviour', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(<ImagePreview src={SINGLE_SRC} visible onClose={onClose} {...ZH} />);
      await userEvent.click(screen.getByLabelText('关闭 (Esc)'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape key', async () => {
      const onClose = vi.fn();
      render(<ImagePreview src={SINGLE_SRC} visible onClose={onClose} {...ZH} />);
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    it('closes from the WebGL hit-floor black surround but not from the rendered image', async () => {
      const onClose = vi.fn();
      const { container } = render(
        <ImagePreview
          src={SINGLE_SRC}
          exif={{ width: 800, height: 400 }}
          visible
          closeOnMaskClick
          onClose={onClose}
          {...ZH}
        />,
      );
      const hitFloor = container.querySelector<HTMLElement>('[data-rip-floor="hit"]');
      expect(hitFloor).not.toBeNull();
      vi.spyOn(hitFloor!, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        toJSON: () => ({}),
      });
      await waitFor(() => {
        expect(screen.getByRole('toolbar').textContent).toContain('100%');
      });

      fireEvent.click(hitFloor!, { clientX: 400, clientY: 300 });
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(hitFloor!, { clientX: 400, clientY: 50 });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('multi-image', () => {
    it('does not render prev/next side arrows for single image', () => {
      render(<ImagePreview src={SINGLE_SRC} visible {...ZH} />);
      expect(screen.queryByLabelText('上一张')).not.toBeInTheDocument();
    });

    it('renders prev/next side arrows for multiple images', () => {
      render(<ImagePreview images={IMAGES} visible {...ZH} />);
      // Side nav arrows + toolbar arrows
      expect(screen.getAllByLabelText('上一张').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('下一张').length).toBeGreaterThan(0);
    });

    it('calls onIndexChange when next is clicked', async () => {
      const onIndexChange = vi.fn();
      render(<ImagePreview images={IMAGES} visible onIndexChange={onIndexChange} {...ZH} />);
      const nextBtns = screen.getAllByLabelText('下一张');
      await userEvent.click(nextBtns[0]);
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it('navigates via arrow keys', async () => {
      const onIndexChange = vi.fn();
      render(<ImagePreview images={IMAGES} visible onIndexChange={onIndexChange} {...ZH} />);
      await userEvent.keyboard('{ArrowRight}');
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });
  });

  describe('zoom via toolbar', () => {
    it('shows fit-equivalent percentage in zoom slot when in fit mode', async () => {
      render(<ImagePreview src={SINGLE_SRC} visible initialMode="fit" {...ZH} />);
      await waitFor(() => {
        expect(screen.getByRole('toolbar').textContent).toMatch(/\d+%/);
      });
    });

    it('calls onZoomChange with native mode after zoomIn click', async () => {
      const onZoomChange = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          initialMode="fit"
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByLabelText('放大'));
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'native' }),
      );
    });

    it('calls onZoomChange with fit mode after fit button click', async () => {
      const onZoomChange = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          initialMode="native"
          initialNativePercent={100}
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByLabelText('适应视口'));
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'fit' }),
      );
    });
  });

  describe('keyboard zoom shortcuts', () => {
    it('zooms in with + key', async () => {
      const onZoomChange = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          initialMode="fit"
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );
      await userEvent.keyboard('+');
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'native' }),
      );
    });

    it('sets native 100% with key 1', async () => {
      const onZoomChange = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );
      await userEvent.keyboard('1');
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'native', nativePercent: 100 }),
      );
    });

    it('fits with key 0', async () => {
      const onZoomChange = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          initialMode="native"
          initialNativePercent={200}
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );
      await userEvent.keyboard('0');
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'fit' }),
      );
    });
  });

  describe('imperative ref API', () => {
    it('exposes zoomIn / zoomOut / fit / setNative', async () => {
      const onZoomChange = vi.fn();
      const ref = createRef<ImagePreviewRef>();
      render(
        <ImagePreview
          ref={ref}
          src={SINGLE_SRC}
          visible
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );

      act(() => ref.current!.setNative(200));
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'native', nativePercent: 200 }),
      );

      act(() => ref.current!.fit());
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'fit' }),
      );

      act(() => ref.current!.zoomIn());
      const lastCall = onZoomChange.mock.calls[onZoomChange.mock.calls.length - 1][0];
      expect(lastCall.mode).toBe('native');
    });

    it('getState returns current state', async () => {
      const ref = createRef<ImagePreviewRef>();
      render(<ImagePreview ref={ref} src={SINGLE_SRC} visible {...ZH} />);

      const state = ref.current!.getState();
      expect(state).toHaveProperty('mode');
      expect(state).toHaveProperty('nativePercent');
    });

    it('navigates via prev/next ref methods', async () => {
      const onIndexChange = vi.fn();
      const ref = createRef<ImagePreviewRef>();
      render(
        <ImagePreview
          ref={ref}
          images={IMAGES}
          visible
          onIndexChange={onIndexChange}
          {...ZH}
        />,
      );

      act(() => ref.current!.next());
      expect(onIndexChange).toHaveBeenCalledWith(1);

      act(() => ref.current!.next());
      expect(onIndexChange).toHaveBeenCalledWith(2);

      act(() => ref.current!.prev());
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });
  });

  describe('wheel behaviour', () => {
    it('zooms in on scroll up', async () => {
      const onZoomChange = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          wheelEnabled
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );
      const dialog = screen.getByRole('dialog');
      // Wheel event must not be passive for preventDefault to work
      fireEvent.wheel(dialog, { deltaY: -100 });
      expect(onZoomChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'native' }),
      );
    });

    it('does nothing when wheelEnabled=false', () => {
      const onZoomChange = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          wheelEnabled={false}
          onZoomChange={onZoomChange}
          {...ZH}
        />,
      );
      const dialog = screen.getByRole('dialog');
      fireEvent.wheel(dialog, { deltaY: -100 });
      expect(onZoomChange).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has aria-modal on the dialog', () => {
      render(<ImagePreview src={SINGLE_SRC} visible {...ZH} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('all toolbar buttons have aria-label', () => {
      render(<ImagePreview src={SINGLE_SRC} visible {...ZH} />);
      const toolbar = screen.getByRole('toolbar');
      const buttons = toolbar.querySelectorAll('button');
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute('aria-label');
      });
    });
  });

  describe('onImageError and errorFallback', () => {
    it('calls onImageError when the image fails to load', async () => {
      const onImageError = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          onImageError={onImageError}
          {...ZH}
        />,
      );
      const canvas = screen.getByRole('dialog').querySelector('canvas')!;
      fireEvent.click(canvas);
      expect(onImageError).toHaveBeenCalledWith(0, SINGLE_SRC);
    });

    it('renders errorFallback when the image fails to load', async () => {
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          errorFallback={() => <div data-testid="err-fallback">Failed</div>}
          {...ZH}
        />,
      );
      const canvas = screen.getByRole('dialog').querySelector('canvas')!;
      fireEvent.click(canvas);
      expect(screen.getByTestId('err-fallback')).toBeInTheDocument();
    });

    it('does not render errorFallback before an error', () => {
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          errorFallback={() => <div data-testid="err-fallback">Failed</div>}
          {...ZH}
        />,
      );
      expect(screen.queryByTestId('err-fallback')).not.toBeInTheDocument();
    });

    it('routes unknown or unreadable media through onImageError and errorFallback', async () => {
      const onImageError = vi.fn();
      render(
        <ImagePreview
          images={[
            {
              id: 'missing-png',
              src: '/missing.png',
              name: 'missing.png',
              kind: 'unknown',
            },
          ]}
          visible
          onImageError={onImageError}
          errorFallback={() => <div data-testid="unknown-fallback">Could not open</div>}
          {...ZH}
        />,
      );

      await waitFor(() => {
        expect(onImageError).toHaveBeenCalledWith(0, '/missing.png');
      });
      expect(screen.getByTestId('unknown-fallback')).toBeInTheDocument();
    });

    it('does not report a valid PNG while byte detection is pending', async () => {
      const onImageError = vi.fn();
      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x44, 0x41, 0x54,
        0x00, 0x00, 0x00, 0x00,
      ]);
      render(
        <ImagePreview
          images={[
            {
              id: 'valid-png',
              src: '/valid.png',
              name: 'valid.png',
              source: { type: 'bytes', data: png.buffer, mimeType: 'image/png' },
            },
          ]}
          visible
          onImageError={onImageError}
          errorFallback={() => <div data-testid="png-fallback">Could not open</div>}
          {...ZH}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog').querySelector('[data-rip-raster-canvas]'))
          .toHaveAttribute('data-raster-active', 'true');
      });
      expect(onImageError).not.toHaveBeenCalled();
      expect(screen.queryByTestId('png-fallback')).not.toBeInTheDocument();
    });
  });

  describe('strings prop (locale overrides)', () => {
    it('overrides individual locale strings', () => {
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          strings={{ close: 'Dismiss' }}
        />,
      );
      expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
    });

    it('strings override takes precedence over language prop', () => {
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          strings={{ zoomIn: 'Custom Zoom In' }}
          {...ZH}
        />,
      );
      expect(screen.getByLabelText('Custom Zoom In')).toBeInTheDocument();
    });
  });

  describe('presentation contained', () => {
    it('uses region without aria-modal', () => {
      render(
        <div style={{ position: 'relative', width: 400, height: 300 }}>
          <ImagePreview src={SINGLE_SRC} visible presentation="contained" {...ZH} />
        </div>,
      );
      const region = screen.getByRole('region', { name: '图片预览' });
      expect(region).not.toHaveAttribute('aria-modal');
      expect(region).toHaveStyle({ position: 'absolute' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ignores arrow keys while focus is outside the preview', async () => {
      const onIndexChange = vi.fn();
      render(
        <div>
          <button type="button">侧栏</button>
          <div style={{ position: 'relative', width: 400, height: 300 }}>
            <ImagePreview
              images={IMAGES}
              visible
              presentation="contained"
              onIndexChange={onIndexChange}
              {...ZH}
            />
          </div>
        </div>,
      );
      screen.getByRole('button', { name: '侧栏' }).focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(onIndexChange).not.toHaveBeenCalled();
    });

    it('handles arrow keys after focusing the preview', async () => {
      const onIndexChange = vi.fn();
      render(
        <div style={{ position: 'relative', width: 400, height: 300 }}>
          <ImagePreview
            images={IMAGES}
            visible
            presentation="contained"
            onIndexChange={onIndexChange}
            {...ZH}
          />
        </div>,
      );
      const region = screen.getByRole('region', { name: '图片预览' });
      region.focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });
  });

  describe('flat thumbnails scope', () => {
    it('lists the full flat sequence across groups', () => {
      render(
        <ImagePreview
          groupedImages={GROUPED_IMAGES}
          visible
          showThumbnails
          thumbnailsScope="flat"
          defaultGroupedSelection={{ defaultGroupIndex: 0, defaultIndexInGroup: 0 }}
          {...ZH}
        />,
      );
      expect(screen.getAllByRole('button', { name: /第 \d+ 张，共 7 张/ })).toHaveLength(7);
    });

    it('prev/next cross group boundaries along the flat list', () => {
      const onIndexChange = vi.fn();
      const ref = createRef<ImagePreviewRef>();
      render(
        <ImagePreview
          ref={ref}
          groupedImages={GROUPED_IMAGES}
          visible
          defaultGroupedSelection={{ defaultGroupIndex: 0, defaultIndexInGroup: 2 }}
          onIndexChange={onIndexChange}
          {...ZH}
        />,
      );

      // Group A last image (flat 2) → Group B first (flat 3)
      act(() => ref.current!.next());
      expect(onIndexChange).toHaveBeenLastCalledWith(3);

      act(() => ref.current!.prev());
      expect(onIndexChange).toHaveBeenLastCalledWith(2);
    });
  });

  describe('controlled index and goTo', () => {
    it('mirrors controlled index from the host', async () => {
      function Host() {
        const [index, setIndex] = useState(0);
        return (
          <>
            <button type="button" onClick={() => setIndex(2)}>跳到 2</button>
            <ImagePreview
              images={IMAGES}
              visible
              index={index}
              onIndexChange={setIndex}
              {...ZH}
            />
          </>
        );
      }
      render(<Host />);
      expect(screen.getByRole('toolbar').textContent).toMatch(/1\s*\/\s*3/);
      await userEvent.click(screen.getByRole('button', { name: '跳到 2' }));
      expect(screen.getByRole('toolbar').textContent).toMatch(/3\s*\/\s*3/);
    });

    it('exposes goTo on the ref', async () => {
      const ref = createRef<ImagePreviewRef>();
      const onIndexChange = vi.fn();
      render(
        <ImagePreview
          ref={ref}
          images={IMAGES}
          visible
          onIndexChange={onIndexChange}
          {...ZH}
        />,
      );
      act(() => {
        ref.current?.goTo(2);
      });
      expect(onIndexChange).toHaveBeenCalledWith(2);
    });
  });

  describe('neighbor preload', () => {
    it('reports neighbor indexes when preloadRadius > 0', async () => {
      const onPreloadIndexesChange = vi.fn();
      render(
        <ImagePreview
          images={IMAGES}
          visible
          defaultIndex={1}
          preloadRadius={1}
          onPreloadIndexesChange={onPreloadIndexesChange}
          {...ZH}
        />,
      );
      await waitFor(() => {
        expect(onPreloadIndexesChange).toHaveBeenCalledWith([2, 0]);
      });
    });

    it('does not preload when radius is 0', () => {
      const onPreloadIndexesChange = vi.fn();
      render(
        <ImagePreview
          images={IMAGES}
          visible
          preloadRadius={0}
          onPreloadIndexesChange={onPreloadIndexesChange}
          {...ZH}
        />,
      );
      expect(onPreloadIndexesChange).toHaveBeenCalledWith([]);
    });

    it('reports display-ready after decode preload', async () => {
      const created: HTMLImageElement[] = [];
      const OriginalImage = globalThis.Image;
      globalThis.Image = class extends OriginalImage {
        constructor() {
          super();
          created.push(this);
          queueMicrotask(() => {
            this.onload?.(new Event('load') as never);
          });
        }
      } as unknown as typeof Image;

      const onPreloadStatusChange = vi.fn();
      const progressiveImages = [
        {
          src: 'https://example.com/a.jpg',
          minimapSrc: 'https://example.com/a-mini.jpg',
        },
        {
          src: 'https://example.com/b.jpg',
          minimapSrc: 'https://example.com/b-mini.jpg',
        },
        {
          src: 'https://example.com/c.jpg',
          minimapSrc: 'https://example.com/c-mini.jpg',
        },
      ];
      try {
        render(
          <ImagePreview
            images={progressiveImages}
            visible
            defaultIndex={1}
            preloadRadius={1}
            progressiveMain
            onPreloadStatusChange={onPreloadStatusChange}
            {...ZH}
          />,
        );

        await waitFor(
          () => {
            const last = onPreloadStatusChange.mock.calls.at(-1)?.[0] as Record<
              number,
              { phase: string }
            >;
            expect(
              last?.[0]?.phase === 'display-ready' || last?.[2]?.phase === 'display-ready',
            ).toBe(true);
          },
          { timeout: 3000 },
        );
      } finally {
        globalThis.Image = OriginalImage;
      }
    });
  });

  describe('fullscreen chrome', () => {
    it('shows a fullscreen toolbar button', () => {
      render(<ImagePreview src={SINGLE_SRC} visible {...ZH} />);
      expect(screen.getByLabelText('进入全屏')).toBeInTheDocument();
    });

    it('gives a supplied host adapter exclusive control over fullscreen', async () => {
      const enter = vi.fn();
      const exit = vi.fn();
      const requestFullscreen = vi.fn();
      const exitFullscreen = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        configurable: true,
        value: requestFullscreen,
      });
      Object.defineProperty(document, 'exitFullscreen', {
        configurable: true,
        value: exitFullscreen,
      });
      const fullscreenElement = vi.fn(() => null);
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: fullscreenElement,
      });

      const { rerender } = render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          fullscreen={{ isFullscreen: false, enter, exit }}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByLabelText('进入全屏'));
      expect(enter).toHaveBeenCalledTimes(1);
      expect(exit).not.toHaveBeenCalled();
      expect(requestFullscreen).not.toHaveBeenCalled();
      expect(exitFullscreen).not.toHaveBeenCalled();
      expect(fullscreenElement).not.toHaveBeenCalled();

      rerender(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          fullscreen={{ isFullscreen: true, enter, exit }}
          {...ZH}
        />,
      );
      expect(screen.getByLabelText('退出全屏')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(exit).toHaveBeenCalledTimes(1);
      expect(requestFullscreen).not.toHaveBeenCalled();
      expect(exitFullscreen).not.toHaveBeenCalled();
      expect(fullscreenElement).not.toHaveBeenCalled();
    });

    it('delegates ref fullscreen methods to the supplied host adapter', async () => {
      const ref = createRef<ImagePreviewRef>();
      const enter = vi.fn(async () => {});
      const exit = vi.fn(async () => {});
      render(
        <ImagePreview
          ref={ref}
          src={SINGLE_SRC}
          visible
          fullscreen={{ isFullscreen: false, enter, exit }}
          {...ZH}
        />,
      );

      await expect(ref.current?.requestFullscreen()).resolves.toBe(true);
      await ref.current?.exitFullscreen();
      expect(enter).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledTimes(1);
      expect(ref.current?.isFullscreen()).toBe(false);
    });

    it('prevents duplicate host adapter calls while an operation is pending', async () => {
      let resolveEnter: (() => void) | undefined;
      const enter = vi.fn(() => new Promise<void>((resolve) => {
        resolveEnter = resolve;
      }));
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          fullscreen={{ isFullscreen: false, enter, exit: vi.fn() }}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByLabelText('进入全屏'));
      await userEvent.click(screen.getByLabelText('进入全屏'));
      expect(enter).toHaveBeenCalledTimes(1);
      await act(async () => resolveEnter?.());
    });

    it('reports host adapter failures', async () => {
      const error = new Error('host fullscreen failed');
      const onFullscreenError = vi.fn();
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          fullscreen={{ isFullscreen: false, enter: () => Promise.reject(error), exit: vi.fn() }}
          onFullscreenError={onFullscreenError}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByLabelText('进入全屏'));
      await waitFor(() => expect(onFullscreenError).toHaveBeenCalledWith(error));
    });

    it('uses the browser Fullscreen API and updates button state after fullscreenchange', async () => {
      const browser = installBrowserFullscreenMock({
        request(root, setActive) {
          setActive(root);
          fireEvent(document, new Event('fullscreenchange'));
        },
        exit(setActive) {
          setActive(null);
          fireEvent(document, new Event('fullscreenchange'));
        },
      });
      try {
        const ref = createRef<ImagePreviewRef>();
        render(<ImagePreview ref={ref} src={SINGLE_SRC} visible {...ZH} />);
        await userEvent.click(screen.getByLabelText('进入全屏'));
        expect(browser.requestFullscreen).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('退出全屏')).toBeInTheDocument();
        expect(ref.current?.isFullscreen()).toBe(true);
        await userEvent.click(screen.getByLabelText('退出全屏'));
        expect(browser.exitFullscreen).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('进入全屏')).toBeInTheDocument();
        expect(ref.current?.isFullscreen()).toBe(false);
      } finally {
        browser.restore();
      }
    });

    it('reports missing browser fullscreen capabilities without changing state', async () => {
      const onFullscreenError = vi.fn();
      const browser = installBrowserFullscreenMock();
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        configurable: true,
        value: undefined,
      });
      try {
        render(<ImagePreview src={SINGLE_SRC} visible onFullscreenError={onFullscreenError} {...ZH} />);
        await userEvent.click(screen.getByLabelText('进入全屏'));
        expect(onFullscreenError).toHaveBeenCalledWith(expect.any(Error));
        expect(screen.getByLabelText('进入全屏')).toBeInTheDocument();
      } finally {
        browser.restore();
      }
    });

    it('reports browser request rejection and an unconfirmed fullscreenchange', async () => {
      const rejected = new Error('denied');
      const rejectedBrowser = installBrowserFullscreenMock({
        request: () => Promise.reject(rejected),
      });
      const onRejected = vi.fn();
      try {
        const { unmount } = render(
          <ImagePreview src={SINGLE_SRC} visible onFullscreenError={onRejected} {...ZH} />,
        );
        await userEvent.click(screen.getByLabelText('进入全屏'));
        await waitFor(() => expect(onRejected).toHaveBeenCalledWith(rejected));
        unmount();
      } finally {
        rejectedBrowser.restore();
      }

      const unconfirmedBrowser = installBrowserFullscreenMock({
        request: () => {
          fireEvent(document, new Event('fullscreenchange'));
        },
      });
      const onUnconfirmed = vi.fn();
      try {
        render(<ImagePreview src={SINGLE_SRC} visible onFullscreenError={onUnconfirmed} {...ZH} />);
        await userEvent.click(screen.getByLabelText('进入全屏'));
        await waitFor(() => expect(onUnconfirmed).toHaveBeenCalledWith(expect.any(Error)));
        expect(screen.getByLabelText('进入全屏')).toBeInTheDocument();
      } finally {
        unconfirmedBrowser.restore();
      }
    });
  });

  describe('thumbnail strip', () => {
    it('does not render strip by default', () => {
      render(<ImagePreview images={IMAGES} visible {...ZH} />);
      expect(screen.queryByRole('navigation', { name: '缩略图导航' })).not.toBeInTheDocument();
    });

    it('renders strip when showThumbnails and multiple images', () => {
      render(<ImagePreview images={IMAGES} visible showThumbnails {...ZH} />);
      expect(screen.getByRole('navigation', { name: '缩略图导航' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /第 \d+ 张/ })).toHaveLength(3);
    });

    it('hides strip for single image even when showThumbnails', () => {
      render(<ImagePreview src={SINGLE_SRC} visible showThumbnails {...ZH} />);
      expect(screen.queryByRole('navigation', { name: '缩略图导航' })).not.toBeInTheDocument();
    });

    it('hides preload bars by default even with preloadRadius', () => {
      render(
        <ImagePreview
          images={IMAGES}
          visible
          showThumbnails
          preloadRadius={1}
          defaultIndex={1}
          {...ZH}
        />,
      );
      expect(document.querySelector('[data-preload-bar]')).toBeNull();
    });

    it('shows preload bars when showThumbnailPreloadStatus', async () => {
      render(
        <ImagePreview
          images={IMAGES}
          visible
          showThumbnails
          showThumbnailPreloadStatus
          preloadRadius={1}
          defaultIndex={1}
          {...ZH}
        />,
      );
      await waitFor(() => {
        expect(document.querySelector('[data-preload-bar]')).not.toBeNull();
      });
    });

    it('navigates when a strip tile is clicked', async () => {
      const onIndexChange = vi.fn();
      render(
        <ImagePreview
          images={IMAGES}
          visible
          showThumbnails
          onIndexChange={onIndexChange}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: '第 3 张，共 3 张' }));
      expect(onIndexChange).toHaveBeenCalledWith(2);
    });

    it('lists only the current group in groupedImages mode (default scope)', () => {
      render(
        <ImagePreview
          groupedImages={GROUPED_IMAGES}
          visible
          showThumbnails
          defaultGroupedSelection={{ defaultGroupIndex: 0, defaultIndexInGroup: 0 }}
          {...ZH}
        />,
      );
      expect(screen.getAllByRole('button', { name: /第 \d+ 张，共 3 张/ })).toHaveLength(3);
      expect(screen.queryByRole('button', { name: /共 4 张/ })).not.toBeInTheDocument();
    });

    it('swaps strip tiles when jumping to the next group', async () => {
      render(
        <ImagePreview
          groupedImages={GROUPED_IMAGES}
          visible
          showThumbnails
          defaultGroupedSelection={{ defaultGroupIndex: 0, defaultIndexInGroup: 0 }}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByLabelText('下一组'));
      expect(screen.getAllByRole('button', { name: /第 \d+ 张，共 4 张/ })).toHaveLength(4);
      expect(screen.queryByRole('button', { name: /共 3 张/ })).not.toBeInTheDocument();
    });
  });

  describe('EXIF panel', () => {
    it('hides the EXIF toggle by default', () => {
      render(<ImagePreview src={SINGLE_SRC} visible {...ZH} />);
      expect(screen.queryByLabelText('显示 EXIF 信息')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('隐藏 EXIF 信息')).not.toBeInTheDocument();
    });

    it('opens the panel with host-provided exif and filters empty fields', async () => {
      render(
        <ImagePreview
          images={[
            {
              src: 'https://example.com/a.jpg',
              name: 'a.jpg',
              exif: {
                make: 'FUJIFILM',
                model: 'X-T5',
                iso: 200,
                exposureTime: '',
                fileName: 'a.jpg',
              },
            },
          ]}
          visible
          showExif
          initialExifOpen
          {...ZH}
        />,
      );
      expect(screen.getByLabelText('隐藏 EXIF 信息')).toBeInTheDocument();
      expect(screen.getByRole('complementary', { name: '图片 EXIF 信息' })).toBeInTheDocument();
      expect(screen.getByText('FUJIFILM')).toBeInTheDocument();
      expect(screen.getByText('X-T5')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.queryByText('快门')).not.toBeInTheDocument();
    });

    it('toggles the panel from the toolbar button', async () => {
      render(
        <ImagePreview
          src={SINGLE_SRC}
          exif={{ make: 'Canon' }}
          visible
          showExif
          {...ZH}
        />,
      );
      expect(screen.queryByRole('complementary', { name: '图片 EXIF 信息' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('显示 EXIF 信息'));
      expect(screen.getByRole('complementary', { name: '图片 EXIF 信息' })).toBeInTheDocument();
      expect(screen.getByText('Canon')).toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('隐藏 EXIF 信息'));
      expect(screen.queryByRole('complementary', { name: '图片 EXIF 信息' })).not.toBeInTheDocument();
    });

    it('shows empty state when no exif is attached', () => {
      render(
        <ImagePreview src={SINGLE_SRC} visible showExif initialExifOpen {...ZH} />,
      );
      expect(screen.getByText('当前图片没有 EXIF 信息。')).toBeInTheDocument();
    });
  });

  describe('delete image', () => {
    it('hides the delete button by default', () => {
      render(<ImagePreview images={IMAGES} visible {...ZH} />);
      expect(screen.queryByLabelText('删除图片')).not.toBeInTheDocument();
    });

    it('calls onDeleteImage with index and item; host list update moves focus', async () => {
      const onDeleteImage = vi.fn();
      function Host() {
        const [list, setList] = useState([
          { id: 'a', src: 'https://example.com/a.jpg', name: 'a.jpg' },
          { id: 'b', src: 'https://example.com/b.jpg', name: 'b.jpg' },
          { id: 'c', src: 'https://example.com/c.jpg', name: 'c.jpg' },
        ]);
        return (
          <ImagePreview
            images={list}
            visible
            showDelete
            defaultIndex={1}
            onDeleteImage={(index, item) => {
              onDeleteImage(index, item);
              setList((prev) => prev.filter((img) => img.id !== item.id));
            }}
            {...ZH}
          />
        );
      }
      render(<Host />);
      expect(screen.getByRole('toolbar').textContent).toMatch(/2\s*\/\s*3/);
      await userEvent.click(screen.getByLabelText('删除图片'));
      expect(onDeleteImage).toHaveBeenCalledTimes(1);
      expect(onDeleteImage).toHaveBeenCalledWith(1, expect.objectContaining({ id: 'b', name: 'b.jpg' }));
      await waitFor(() => {
        expect(screen.getByRole('toolbar').textContent).toMatch(/2\s*\/\s*2/);
      });
      expect(screen.getByRole('dialog').textContent).toContain('c.jpg');
    });

    it('moves to the previous image when deleting the last one', async () => {
      function Host() {
        const [list, setList] = useState([
          { id: 'a', src: 'https://example.com/a.jpg', name: 'a.jpg' },
          { id: 'b', src: 'https://example.com/b.jpg', name: 'b.jpg' },
        ]);
        return (
          <ImagePreview
            images={list}
            visible
            showDelete
            defaultIndex={1}
            onDeleteImage={(_index, item) => {
              setList((prev) => prev.filter((img) => img.id !== item.id));
            }}
            {...ZH}
          />
        );
      }
      render(<Host />);
      await userEvent.click(screen.getByLabelText('删除图片'));
      await waitFor(() => {
        expect(screen.getByRole('dialog').textContent).toContain('a.jpg');
      });
      expect(screen.queryByRole('toolbar')!.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    });

    it('closes when the last remaining image is deleted', async () => {
      const onClose = vi.fn();
      const onDeleteImage = vi.fn();
      render(
        <ImagePreview
          images={[{ id: 'only', src: 'https://example.com/a.jpg', name: 'only.jpg' }]}
          visible
          showDelete
          onClose={onClose}
          onDeleteImage={onDeleteImage}
          {...ZH}
        />,
      );
      await userEvent.click(screen.getByLabelText('删除图片'));
      expect(onDeleteImage).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ id: 'only', name: 'only.jpg' }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
