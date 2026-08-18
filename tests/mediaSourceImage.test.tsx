import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaSourceImage } from '../src/components/ImagePreview/core/MediaSourceImage';

describe('MediaSourceImage', () => {
  it('uses URL inputs directly without taking ownership', () => {
    const { container } = render(
      <MediaSourceImage source={{ type: 'url', href: '/thumb.jpg' }} alt="" />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', '/thumb.jpg');
  });

  it('releases owned object URLs when Blob input changes and unmounts', () => {
    const createObjectURL = vi.fn()
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second');
    const revokeObjectURL = vi.fn();
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    try {
      const first = new Blob(['first'], { type: 'image/jpeg' });
      const second = new Blob(['second'], { type: 'image/jpeg' });
      const view = render(<MediaSourceImage source={{ type: 'blob', blob: first }} alt="" />);
      expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:first');

      view.rerender(<MediaSourceImage source={{ type: 'blob', blob: second }} alt="" />);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
      expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:second');
      view.unmount();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:second');
    } finally {
      restoreDescriptor(URL, 'createObjectURL', createDescriptor);
      restoreDescriptor(URL, 'revokeObjectURL', revokeDescriptor);
    }
  });
});

function restoreDescriptor(
  target: typeof URL,
  key: 'createObjectURL' | 'revokeObjectURL',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}
