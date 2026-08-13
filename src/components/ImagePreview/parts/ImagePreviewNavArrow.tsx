import { useState } from 'react';
import { DelayedTooltip } from '../DelayedTooltip';
import {
  NAV_ARROW_POLY_NEXT_GROUP_INNER,
  NAV_ARROW_POLY_NEXT_GROUP_OUTER,
  NAV_ARROW_POLY_NEXT_SINGLE,
  NAV_ARROW_POLY_PREV_GROUP_INNER,
  NAV_ARROW_POLY_PREV_GROUP_OUTER,
  NAV_ARROW_POLY_PREV_SINGLE,
} from './navArrowPolylines';

export interface ImagePreviewNavArrowProps {
  direction: 'left' | 'right';
  /** When true the icon becomes a double-chevron (group jump). */
  isGroupJump?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  label: string;
  tip: string;
  visible: boolean;
  /** Opacity when `visible` is false. */
  idleOpacity?: number;
}

export function ImagePreviewNavArrow({
  direction,
  isGroupJump = false,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  label,
  tip,
  visible,
  idleOpacity = 0.1,
}: ImagePreviewNavArrowProps) {
  const [hover, setHover] = useState(false);

  return (
    <DelayedTooltip content={tip}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(e) => {
          // Release hold if pointer slides off while pressed.
          if (e.buttons !== 0) onPointerUp?.(e);
          setHover(false);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'absolute',
          top: '50%',
          [direction]: 16,
          transform: 'translateY(-50%)',
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.28)',
          background: hover ? 'rgba(8,14,26,0.80)' : 'rgba(8,14,26,0.52)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.55)',
          color: 'rgba(235,242,255,0.92)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          opacity: visible ? 1 : idleOpacity,
          pointerEvents: visible || idleOpacity > 0 ? 'auto' : 'none',
          transition: visible
            ? 'opacity 0.12s ease, background 0.15s, box-shadow 0.15s'
            : 'opacity 1.6s ease, background 0.15s, box-shadow 0.15s',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.5} width={22} height={22} aria-hidden="true">
          {direction === 'left' ? (
            isGroupJump ? (
              <>
                <polyline points={NAV_ARROW_POLY_PREV_GROUP_OUTER} />
                <polyline points={NAV_ARROW_POLY_PREV_GROUP_INNER} />
              </>
            ) : (
              <polyline points={NAV_ARROW_POLY_PREV_SINGLE} />
            )
          ) : isGroupJump ? (
            <>
              <polyline points={NAV_ARROW_POLY_NEXT_GROUP_OUTER} />
              <polyline points={NAV_ARROW_POLY_NEXT_GROUP_INNER} />
            </>
          ) : (
            <polyline points={NAV_ARROW_POLY_NEXT_SINGLE} />
          )}
        </svg>
      </button>
    </DelayedTooltip>
  );
}
