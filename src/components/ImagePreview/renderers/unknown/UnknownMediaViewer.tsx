import { useEffect } from 'react';

import type { MediaPresentationPhase } from '../../core/media-contract';

export interface UnknownMediaViewerProps {
  label: string;
  onPhaseChange(phase: MediaPresentationPhase): void;
}

export function UnknownMediaViewer({ label, onPhaseChange }: UnknownMediaViewerProps) {
  useEffect(() => {
    onPhaseChange('unsupported');
  }, [onPhaseChange]);
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
