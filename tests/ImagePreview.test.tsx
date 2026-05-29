import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ImagePreview } from '../src/components/ImagePreview';
import type { ImagePreviewRef } from '../src/components/ImagePreview/types';

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

/** Tests assert Chinese copy; `resolveStrings(undefined)` is English. */
const ZH = { language: 'zh' as const } satisfies Pick<ComponentProps<typeof ImagePreview>, 'language'>;

describe('ImagePreview component', () => {
  beforeEach(() => {
    // Give jsdom images predictable natural dimensions for transform calculations.
    mockImageLoad();
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
      const img = screen.getByRole('dialog').querySelector('img')!;
      fireEvent.load(img);
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
      const img = screen.getByRole('dialog').querySelector('img')!;
      fireEvent.error(img);
      expect(onImageError).toHaveBeenCalledWith(0, SINGLE_SRC);
    });

    it('renders errorFallback when the image fails to load', async () => {
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          errorFallback={(_index, _src) => <div data-testid="err-fallback">Failed</div>}
          {...ZH}
        />,
      );
      const img = screen.getByRole('dialog').querySelector('img')!;
      fireEvent.error(img);
      expect(screen.getByTestId('err-fallback')).toBeInTheDocument();
    });

    it('does not render errorFallback before an error', () => {
      render(
        <ImagePreview
          src={SINGLE_SRC}
          visible
          errorFallback={(_index, _src) => <div data-testid="err-fallback">Failed</div>}
          {...ZH}
        />,
      );
      expect(screen.queryByTestId('err-fallback')).not.toBeInTheDocument();
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
          language="zh"
          strings={{ zoomIn: 'Custom Zoom In' }}
          {...ZH}
        />,
      );
      expect(screen.getByLabelText('Custom Zoom In')).toBeInTheDocument();
    });
  });
});
