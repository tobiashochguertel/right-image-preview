import type { CSSProperties } from 'react';

export function OriginalTooLargeNotice({ message }: { message: string }) {
  return (
    <div
      data-rip-original-too-large-notice=""
      role="status"
      aria-live="polite"
      style={bannerStyle}
    >
      {message}
    </div>
  );
}

const bannerStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 19,
  maxWidth: 'min(560px, calc(100% - 120px))',
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(251, 191, 36, 0.55)',
  background: 'rgba(28, 18, 4, 0.88)',
  boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
  color: '#fde68a',
  fontSize: 14,
  fontWeight: 650,
  letterSpacing: '0.01em',
  lineHeight: 1.45,
  textAlign: 'center',
  pointerEvents: 'none',
};
