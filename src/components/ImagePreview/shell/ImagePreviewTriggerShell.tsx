import {
  Children,
  cloneElement,
  forwardRef,
  useCallback,
  useState,
} from 'react';
import type { MouseEvent, ReactElement, SyntheticEvent } from 'react';
import { ImagePreviewInner } from './ImagePreviewInner';
import type { ImagePreviewProps, ImagePreviewRef } from '../types';

let didWarnControlTriggerWithoutOnOpenChange = false;

/** Merges an open handler; parent props (`src` / `images`) are the only source for preview data. */
function mergeOpenTrigger(
  child: ReactElement,
  onRequestOpen: (e: SyntheticEvent) => void,
): ReactElement {
  const prev = (child.props as { onClick?: (e: MouseEvent) => void }).onClick;
  return cloneElement(child, {
    onClick: (e: MouseEvent) => {
      prev?.(e);
      if (e.defaultPrevented) return;
      if (child.type === 'a') e.preventDefault();
      onRequestOpen(e);
    },
  } as never);
}

// ── Trigger shell: one child + optional uncontrolled open state ─────────────
export const ImagePreviewTriggerShell = forwardRef<
  ImagePreviewRef,
  ImagePreviewProps
>(function ImagePreviewTriggerShell(props, ref) {
  const { children, visible: visibleProp, onClose, onOpenChange, ...rest } = props;
  const isControlled = visibleProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? visibleProp! : uncontrolledOpen;

  const requestOpen = useCallback(() => {
    if (
      import.meta.env.DEV &&
      isControlled &&
      onOpenChange == null &&
      !didWarnControlTriggerWithoutOnOpenChange
    ) {
      didWarnControlTriggerWithoutOnOpenChange = true;
      console.warn(
        'ImagePreview: with `children` and controlled `visible`, provide `onOpenChange` so the trigger can set `visible` to `true` (or use uncontrolled mode by omitting `visible`).',
      );
    }
    if (!isControlled) setUncontrolledOpen(true);
    onOpenChange?.(true);
  }, [isControlled, onOpenChange]);

  const requestClose = useCallback(() => {
    if (!isControlled) setUncontrolledOpen(false);
    onOpenChange?.(false);
    onClose?.();
  }, [isControlled, onClose, onOpenChange]);

  const child = Children.only(children) as ReactElement;

  const trigger = mergeOpenTrigger(child, () => {
    requestOpen();
  });

  const innerProps = { ...rest, onClose: requestClose } as ImagePreviewProps;

  return (
    <>
      {trigger}
      {open ? <ImagePreviewInner {...innerProps} ref={ref} /> : null}
    </>
  );
});
