import { useEffect, useRef } from 'react';
import type { ImageItem } from '../types';
import {
  THUMBNAIL_STRIP_ACTIVE_BORDER_PX,
  THUMBNAIL_STRIP_GAP_PX,
  THUMBNAIL_STRIP_HEIGHT_PX,
  THUMBNAIL_STRIP_INACTIVE_OPACITY,
  THUMBNAIL_STRIP_PADDING_X_PX,
  THUMBNAIL_STRIP_PADDING_Y_PX,
} from '../imagePreviewTuning';

export interface ThumbnailStripEntry {
  /** Flat index in the full preview list. */
  flatIndex: number;
  item: ImageItem;
}

export interface ThumbnailsStripProps {
  entries: ThumbnailStripEntry[];
  activeFlatIndex: number;
  controlsVisible?: boolean;
  ariaLabel: string;
  thumbAria: (index: number, total: number) => string;
  onSelect(flatIndex: number): void;
  onUserActivity?(): void;
}

function thumbSrc(item: ImageItem): string {
  return item.minimapSrc ?? item.src;
}

function itemKey(item: ImageItem, flatIndex: number): string {
  return item.id ?? `${flatIndex}-${item.src}`;
}

export function ThumbnailsStrip({
  entries,
  activeFlatIndex,
  controlsVisible = true,
  ariaLabel,
  thumbAria,
  onSelect,
  onUserActivity,
}: ThumbnailsStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = activeRef.current;
    if (!el || typeof el.scrollIntoView !== 'function') return;
    el.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  }, [activeFlatIndex]);

  if (entries.length <= 1) return null;

  const stripHeight =
    THUMBNAIL_STRIP_PADDING_Y_PX * 2 + THUMBNAIL_STRIP_HEIGHT_PX;

  return (
    <div
      role="navigation"
      aria-label={ariaLabel}
      onMouseMove={onUserActivity}
      onMouseDown={onUserActivity}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: stripHeight,
        zIndex: 9,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: `0 ${THUMBNAIL_STRIP_PADDING_X_PX}px`,
        background: 'rgba(6, 10, 20, 0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.35)',
        opacity: controlsVisible ? 1 : 0.1,
        transition: controlsVisible
          ? 'opacity 0.12s ease'
          : 'opacity 1.6s ease',
      }}
    >
      <div
        ref={scrollerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: THUMBNAIL_STRIP_GAP_PX,
          overflowX: 'auto',
          overflowY: 'hidden',
          maxWidth: '100%',
          padding: `${THUMBNAIL_STRIP_PADDING_Y_PX}px 0`,
          scrollbarWidth: 'thin',
        }}
      >
        {entries.map(({ flatIndex, item }, i) => {
          const active = flatIndex === activeFlatIndex;
          return (
            <button
              key={itemKey(item, flatIndex)}
              ref={active ? activeRef : undefined}
              type="button"
              aria-label={thumbAria(i + 1, entries.length)}
              aria-current={active ? 'true' : undefined}
              onClick={() => {
                onUserActivity?.();
                onSelect(flatIndex);
              }}
              style={{
                flexShrink: 0,
                width: THUMBNAIL_STRIP_HEIGHT_PX,
                height: THUMBNAIL_STRIP_HEIGHT_PX,
                padding: 0,
                border:
                  active
                    ? `${THUMBNAIL_STRIP_ACTIVE_BORDER_PX}px solid #cdd5e0`
                    : `${THUMBNAIL_STRIP_ACTIVE_BORDER_PX}px solid transparent`,
                borderRadius: 4,
                background: 'rgba(0, 0, 0, 0.35)',
                cursor: 'pointer',
                opacity: active ? 1 : THUMBNAIL_STRIP_INACTIVE_OPACITY,
                transition: 'opacity 0.15s ease, border-color 0.15s ease',
                overflow: 'hidden',
              }}
            >
              <img
                src={thumbSrc(item)}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
