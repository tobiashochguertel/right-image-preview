import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ImageItem } from '../types';
import { MediaSourceImage } from '../core/MediaSourceImage';
import { resolveMinimapMediaSource } from '../lib/imagePreviewData';
import {
  THUMBNAIL_STRIP_ACTIVE_BORDER_PX,
  THUMBNAIL_STRIP_BOTTOM_INSET_PX,
  THUMBNAIL_STRIP_GAP_PX,
  THUMBNAIL_STRIP_HEIGHT_PX,
  THUMBNAIL_STRIP_PADDING_X_PX,
  THUMBNAIL_STRIP_PADDING_Y_PX,
  THUMBNAIL_STRIP_RADIUS_PX,
  THUMBNAIL_STRIP_VIRTUAL_OVERSCAN,
  shouldVirtualizeThumbnailStrip,
  thumbnailStripTileStridePx,
} from '../imagePreviewTuning';
import { injectGlobalStyle } from '../injectGlobalStyle';
import type { NeighborPreloadStatusMap } from '../types';

injectGlobalStyle(
  'rip-thumbnail-preload-indeterminate',
  '@keyframes _rip_thumbnail_preload{0%{transform:translateX(-110%)}100%{transform:translateX(310%)}}',
);

export interface ThumbnailStripEntry {
  /** Flat index in the full preview list. */
  flatIndex: number;
  item: ImageItem;
}

export interface ThumbnailsStripProps {
  entries: ThumbnailStripEntry[];
  activeFlatIndex: number;
  controlsVisible?: boolean;
  /** Idle opacity when controls are hidden (0 for minimal chrome, ~0.1 default). */
  idleOpacity?: number;
  /** Neighbor preload status keyed by flat index (progress line under tiles). */
  preloadStatus?: NeighborPreloadStatusMap;
  ariaLabel: string;
  thumbAria: (index: number, total: number) => string;
  onSelect(flatIndex: number): void;
  onUserActivity?(): void;
}

/**
 * The real scroller width is only available after the first commit.  Starting
 * from zero would temporarily mount every tile, which is especially expensive
 * for desktop folders containing hundreds or thousands of images.  A bounded
 * bootstrap width lets large strips virtualize on their very first render;
 * ResizeObserver replaces it with the exact contained viewport immediately.
 */
function bootstrapViewportWidth(): number {
  if (typeof window === 'undefined') return 1024;
  return Math.max(320, Math.min(window.innerWidth || 1024, 1024));
}

function activeScrollLeft(
  entries: readonly ThumbnailStripEntry[],
  activeFlatIndex: number,
  stride: number,
  tileOuter: number,
  viewportWidth: number,
): number {
  const activePos = entries.findIndex((entry) => entry.flatIndex === activeFlatIndex);
  if (activePos < 0) return 0;
  return Math.max(0, activePos * stride - viewportWidth / 2 + tileOuter / 2);
}

function itemKey(item: ImageItem, flatIndex: number): string {
  return item.id ?? `${flatIndex}-${item.src}`;
}

/**
 * Display-ready (decode settled — can switch over immediately).
 * Blue is **not** “neighbor window”; only neighbors that finished decode get this color.
 */
const PRELOAD_BAR_DISPLAY_READY = '#60a5fa';
const PRELOAD_BAR_BROWSE_READY = '#c084fc';
const PRELOAD_BAR_GRAY = 'rgba(226, 232, 240, 0.32)';
/** Byte-level ready / in-progress fill (cache likely — not instant-switch). */
const PRELOAD_BAR_DARK_GREEN = '#34d399';
const GLASS_BG = 'rgba(6, 10, 20, 0.55)';
/** Match tile `borderRadius` so the bar sits on the straight bottom edge. */
const PRELOAD_BAR_INSET_X = 4;
const PRELOAD_BAR_HEIGHT = 3;

function preloadFillRatio(
  entry: NeighborPreloadStatusMap[number] | undefined,
): number | 'indeterminate' | null {
  if (!entry) return null;
  if (
    entry.phase === 'ready' ||
    entry.phase === 'warm' ||
    entry.phase === 'browse-ready' ||
    entry.phase === 'display-ready'
  ) {
    return 1;
  }
  if (entry.phase === 'error') return null; // no bar — failed active preload
  if (typeof entry.progress === 'number' && Number.isFinite(entry.progress)) {
    return Math.max(0, Math.min(1, entry.progress));
  }
  return 'indeterminate';
}

export function ThumbnailsStrip({
  entries,
  activeFlatIndex,
  controlsVisible = true,
  idleOpacity = 0.1,
  preloadStatus,
  ariaLabel,
  thumbAria,
  onSelect,
  onUserActivity,
}: ThumbnailsStripProps) {
  const glassRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const stride = thumbnailStripTileStridePx();
  const tileOuter = THUMBNAIL_STRIP_HEIGHT_PX + THUMBNAIL_STRIP_ACTIVE_BORDER_PX * 2;
  const bootstrapWidth = bootstrapViewportWidth();
  /** True when thumbs overflow the viewport — use a full-width bottom bar. */
  const [expanded, setExpanded] = useState(false);
  const [viewportW, setViewportW] = useState(bootstrapWidth);
  const [scrollLeft, setScrollLeft] = useState(() =>
    activeScrollLeft(entries, activeFlatIndex, stride, tileOuter, bootstrapWidth));

  const totalWidth = entries.length * stride - (entries.length > 0 ? THUMBNAIL_STRIP_GAP_PX : 0);
  const useVirtual = shouldVirtualizeThumbnailStrip(entries.length, viewportW);

  const virtualRange = useMemo(() => {
    if (!useVirtual) return { start: 0, end: entries.length };
    const start = Math.max(0, Math.floor(scrollLeft / stride) - THUMBNAIL_STRIP_VIRTUAL_OVERSCAN);
    const visibleCapacity = Math.max(1, Math.floor((viewportW || 1) / stride));
    const end = Math.min(
      entries.length,
      start + visibleCapacity + THUMBNAIL_STRIP_VIRTUAL_OVERSCAN * 2,
    );
    return { start, end };
  }, [useVirtual, scrollLeft, stride, viewportW, entries.length]);

  useLayoutEffect(() => {
    const el = activeRef.current;
    const scroller = scrollerRef.current;
    if (!scroller || entries.length === 0) return;

    if (useVirtual) {
      const target = activeScrollLeft(
        entries,
        activeFlatIndex,
        stride,
        tileOuter,
        scroller.clientWidth || viewportW,
      );
      // Instant scroll so the active border and strip position update with navigation
      // (same beat as currentIndex), not after a smooth pan that lags the main stage.
      // This is a layout effect so the first browser paint already contains the
      // active virtual window instead of an empty strip.
      if (typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ left: target, behavior: 'auto' });
      } else {
        scroller.scrollLeft = target;
      }
      setScrollLeft((previous) => previous === target ? previous : target);
      return;
    }

    if (!el || typeof el.scrollIntoView !== 'function') return;
    el.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'auto',
    });
  }, [activeFlatIndex, useVirtual, entries, stride, tileOuter, viewportW]);

  useLayoutEffect(() => {
    const glass = glassRef.current;
    const scroller = scrollerRef.current;
    if (!glass || !scroller) return;

    const update = () => {
      const w = scroller.clientWidth;
      setExpanded(scroller.scrollWidth > glass.clientWidth + 1 || useVirtual);
      if (w > 0) setViewportW((previous) => previous === w ? previous : w);
      setScrollLeft((previous) => previous === scroller.scrollLeft ? previous : scroller.scrollLeft);
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(glass);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [entries, useVirtual]);

  if (entries.length <= 1) return null;

  const renderTile = (entry: ThumbnailStripEntry, listIndex: number) => {
    const { flatIndex, item } = entry;
    const active = flatIndex === activeFlatIndex;
    // Active tile: selection border only — never a preload color bar.
    const fill = active ? null : preloadFillRatio(preloadStatus?.[flatIndex]);
    const phase = active ? undefined : preloadStatus?.[flatIndex]?.phase;
    const isWarm = phase === 'warm';
    const isBrowseReady = phase === 'browse-ready';
    const isDisplayReady = phase === 'display-ready';
    const isBrowseLoading = phase === 'loading' && preloadStatus?.[flatIndex]?.targetLod === 'browse';
    const isScreenLoading = phase === 'loading' && preloadStatus?.[flatIndex]?.targetLod === 'screen';
    const isIndeterminate = fill === 'indeterminate';
    const barFillColor = isDisplayReady
      ? PRELOAD_BAR_DISPLAY_READY
      : isBrowseReady
        ? PRELOAD_BAR_BROWSE_READY
        : isScreenLoading
          ? PRELOAD_BAR_DISPLAY_READY
          : isBrowseLoading
            ? PRELOAD_BAR_BROWSE_READY
        : PRELOAD_BAR_DARK_GREEN;
    return (
      <button
        key={itemKey(item, flatIndex)}
        ref={active ? activeRef : undefined}
        type="button"
        aria-label={thumbAria(listIndex + 1, entries.length)}
        aria-current={active ? 'true' : undefined}
        onClick={() => {
          onUserActivity?.();
          onSelect(flatIndex);
        }}
        style={{
          position: 'relative',
          flexShrink: 0,
          width: THUMBNAIL_STRIP_HEIGHT_PX,
          height: THUMBNAIL_STRIP_HEIGHT_PX,
          padding: 0,
          border:
            active
              ? `${THUMBNAIL_STRIP_ACTIVE_BORDER_PX}px solid rgba(239, 246, 255, 0.96)`
              : `${THUMBNAIL_STRIP_ACTIVE_BORDER_PX}px solid transparent`,
          borderRadius: 4,
          background: 'rgba(0, 0, 0, 0.35)',
          cursor: 'pointer',
          opacity: 1,
          boxShadow: active
            ? '0 0 0 1px rgba(96, 165, 250, 0.55), 0 0 10px rgba(96, 165, 250, 0.24)'
            : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          overflow: 'hidden',
        }}
      >
        <MediaSourceImage
          source={resolveMinimapMediaSource(item)}
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
        {fill != null && (
          <span
            aria-hidden
            data-preload-bar={phase ?? 'loading'}
            title={
              isDisplayReady
                ? 'GPU-ready (blue): instant switch'
                : isBrowseReady
                  ? 'GPU Browse-ready (violet): instant medium-detail switch'
                  : isScreenLoading
                    ? `Preparing Screen LOD: ${Math.round((preloadStatus?.[flatIndex]?.progress ?? 0) * 100)}%`
                    : isBrowseLoading
                      ? `Preparing Browse LOD: ${Math.round((preloadStatus?.[flatIndex]?.progress ?? 0) * 100)}%`
                : isWarm
                  ? 'Original cached (green)'
                  : phase === 'ready'
                    ? 'Original cached (green)'
                    : preloadStatus?.[flatIndex]?.totalBytes
                      ? `Downloading: ${Math.round((preloadStatus[flatIndex]!.progress ?? 0) * 100)}%`
                      : 'Downloading: unknown total'
            }
            style={{
              position: 'absolute',
              left: PRELOAD_BAR_INSET_X,
              right: PRELOAD_BAR_INSET_X,
              bottom: 0,
              height: PRELOAD_BAR_HEIGHT,
              background: PRELOAD_BAR_GRAY,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: isIndeterminate ? '32%' : `${Number(fill) * 100}%`,
                background: barFillColor,
                transition: isIndeterminate ? undefined : 'width 0.2s ease',
                animation: isIndeterminate
                  ? '_rip_thumbnail_preload 1.1s ease-in-out infinite'
                  : undefined,
              }}
            />
          </span>
        )}
      </button>
    );
  };

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
        zIndex: 9,
        display: 'flex',
        justifyContent: 'center',
        padding: expanded
          ? 0
          : `0 ${THUMBNAIL_STRIP_PADDING_X_PX}px ${THUMBNAIL_STRIP_BOTTOM_INSET_PX}px`,
        pointerEvents: 'none',
        opacity: controlsVisible ? 1 : idleOpacity,
        transition: controlsVisible
          ? 'opacity 0.12s ease'
          : 'opacity 1.6s ease',
      }}
    >
      <div
        ref={glassRef}
        style={{
          pointerEvents: 'auto',
          width: expanded ? '100%' : 'fit-content',
          maxWidth: '100%',
          background: GLASS_BG,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: expanded
            ? `${THUMBNAIL_STRIP_RADIUS_PX}px ${THUMBNAIL_STRIP_RADIUS_PX}px 0 0`
            : THUMBNAIL_STRIP_RADIUS_PX,
          boxShadow: expanded
            ? '0 -4px 24px rgba(0, 0, 0, 0.35)'
            : '0 4px 20px rgba(0, 0, 0, 0.35)',
          padding: `${THUMBNAIL_STRIP_PADDING_Y_PX}px ${THUMBNAIL_STRIP_PADDING_X_PX}px`,
        }}
      >
        <div
          ref={scrollerRef}
          onScroll={() => {
            const s = scrollerRef.current;
            if (s) setScrollLeft(s.scrollLeft);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: useVirtual ? 0 : THUMBNAIL_STRIP_GAP_PX,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'thin',
          }}
        >
          {useVirtual ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                width: totalWidth,
                position: 'relative',
                flexShrink: 0,
                height: tileOuter,
              }}
            >
              {entries.slice(virtualRange.start, virtualRange.end).map((entry, i) => {
                const listIndex = virtualRange.start + i;
                return (
                  <div
                    key={itemKey(entry.item, entry.flatIndex)}
                    style={{
                      position: 'absolute',
                      left: listIndex * stride,
                      top: 0,
                    }}
                  >
                    {renderTile(entry, listIndex)}
                  </div>
                );
              })}
            </div>
          ) : (
            entries.map((entry, i) => renderTile(entry, i))
          )}
        </div>
      </div>
    </div>
  );
}
