import { Children, forwardRef, isValidElement } from 'react';
import { normaliseImages } from '../lib/imagePreviewData';
import type { ImagePreviewProps, ImagePreviewRef } from '../types';
import { ImagePreviewInner } from './ImagePreviewInner';
import { ImagePreviewTriggerShell } from './ImagePreviewTriggerShell';

// ── Outer shell: only mounts the dialog when visible (no trigger children) ─
export const ImagePreview = forwardRef<ImagePreviewRef, ImagePreviewProps>(
  function ImagePreview(props, ref) {
    const images = normaliseImages(props);
    const asChildList = Children.toArray(props.children);
    if (asChildList.length > 0) {
      if (asChildList.length !== 1 || !isValidElement(asChildList[0])) {
        if (import.meta.env.DEV) {
          console.error(
            'ImagePreview: `children` (trigger) must be exactly one React element (e.g. one <img> or <button>).',
          );
        }
        return <>{props.children}</>;
      }
      if (images.length === 0) {
        if (import.meta.env.DEV) {
          console.warn(
            'ImagePreview: `children` (trigger) is set but no image data (`src`, `images`, or `groupedImages`).',
          );
        }
        return <>{props.children}</>;
      }
      return <ImagePreviewTriggerShell {...props} ref={ref} children={asChildList[0]} />;
    }
    if (!props.visible || images.length === 0) return null;
    return <ImagePreviewInner {...props} ref={ref} />;
  },
);
