import { useEffect } from 'react';

import type { MediaPresentationPhase } from '../../core/media-contract';

export interface UnknownMediaViewerProps {
  label: string;
  pending?: boolean;
  onPhaseChange(phase: MediaPresentationPhase): void;
  onError(error: Error): void;
}

export function UnknownMediaViewer({
  label,
  pending = false,
  onPhaseChange,
  onError,
}: UnknownMediaViewerProps) {
  useEffect(() => {
    if (pending) {
      onPhaseChange('loading');
      return;
    }
    onPhaseChange('unsupported');
    onError(new Error('Unsupported or unreadable media source'));
  }, [onError, onPhaseChange, pending]);

  if (pending) {
    return <div data-rip-unknown-viewer="" aria-hidden="true" />;
  }

  return (
    <div
      data-rip-unknown-viewer=""
      role="status"
      style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}
    >
      Unsupported media: {label}
    </div>
  );
}
