import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DelayedTooltip } from '../src/components/ImagePreview/DelayedTooltip';

describe('DelayedTooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps child hover handlers and shows content after the delay', () => {
    vi.useFakeTimers();
    const onMouseEnter = vi.fn();

    render(
      <DelayedTooltip content="Zoom in" delayMs={100}>
        <button type="button" onMouseEnter={onMouseEnter}>
          Anchor
        </button>
      </DelayedTooltip>,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Anchor' }));
    expect(onMouseEnter).toHaveBeenCalledOnce();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Zoom in');

    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Anchor' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
