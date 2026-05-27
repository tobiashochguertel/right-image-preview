import { useState } from 'react';
import { DelayedTooltip } from '../DelayedTooltip';

export function ImagePreviewCloseButton({
  onClick,
  visible,
  label,
  tip,
}: {
  onClick(): void;
  visible: boolean;
  label: string;
  tip: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <DelayedTooltip content={tip}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'absolute',
          top: 14,
          right: 16,
          zIndex: 20,
          width: 46,
          height: 46,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.22)',
          background: hover ? 'rgba(8,14,26,0.78)' : 'rgba(8,14,26,0.50)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
          color: 'rgba(235,242,255,0.92)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: visible ? 1 : 0.1,
          transition: visible
            ? 'opacity 0.12s ease, background 0.15s'
            : 'opacity 1.6s ease, background 0.15s',
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          width={18} height={18} aria-hidden="true">
          <line x1="18" y1="6" x2="6"  y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </DelayedTooltip>
  );
}
