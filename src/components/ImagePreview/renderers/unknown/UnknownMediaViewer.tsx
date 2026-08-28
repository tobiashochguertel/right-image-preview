import { useEffect } from 'react';

import type { MediaPresentationPhase } from '../../core/media-contract';

export interface UnknownMediaViewerProps {
  label: string;
  onPhaseChange(phase: MediaPresentationPhase): void;
  onError(error: Error): void;
}

export function UnknownMediaViewer({ label, onPhaseChange, onError }: UnknownMediaViewerProps) {
  useEffect(() => {
    onPhaseChange('unsupported');
    onError(new Error('Unsupported or unreadable media source'));
  }, [onError, onPhaseChange]);
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
