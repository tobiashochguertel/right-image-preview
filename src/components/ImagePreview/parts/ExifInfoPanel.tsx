import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LocaleStrings } from '../locale';
import { buildExifDisplayGroups, type ExifDisplayGroup } from '../lib/exifDisplay';
import type { ExifGroupId, ImageExif } from '../types';

export type ExifPanelEdge = 'left' | 'right' | 'top' | 'bottom';

const PANEL_WIDTH = 300;
const PANEL_MAX_HEIGHT_VH = 0.62;
/** Flush to the snapped edge; only keep the panel fully on-screen. */
const EDGE_GAP = 0;

const PANEL_BG = '#f0f1f3';
const PANEL_BORDER = 'rgba(40,48,64,0.12)';
const TEXT = '#2a3140';
const TEXT_MUTED = '#6b7385';
const TAB_ACTIVE_BG = 'rgba(40,48,64,0.12)';
const TAB_HOVER_BG = 'rgba(40,48,64,0.07)';
const ROW_BORDER = 'rgba(40,48,64,0.08)';

interface EdgePlacement {
  edge: ExifPanelEdge;
  /** Offset along the edge from the safe start (px). */
  along: number;
}

export interface ExifInfoPanelProps {
  exif: ImageExif | undefined;
  strings: LocaleStrings;
  onUserActivity?: () => void;
}

function groupTitle(id: ExifGroupId, strings: LocaleStrings): string {
  switch (id) {
    case 'file':
      return strings.exifGroupFile;
    case 'camera':
      return strings.exifGroupCamera;
    case 'exposure':
      return strings.exifGroupExposure;
    case 'gps':
      return strings.exifGroupGps;
    default:
      return strings.exifGroupOther;
  }
}

function fieldLabel(row: ExifDisplayGroup['rows'][number], strings: LocaleStrings): string {
  if (row.labelKey) {
    const map: Record<string, string> = {
      fileName: strings.exifFieldFileName,
      fileSize: strings.exifFieldFileSize,
      mimeType: strings.exifFieldMimeType,
      width: strings.exifFieldWidth,
      height: strings.exifFieldHeight,
      colorSpace: strings.exifFieldColorSpace,
      orientation: strings.exifFieldOrientation,
      make: strings.exifFieldMake,
      model: strings.exifFieldModel,
      lens: strings.exifFieldLens,
      software: strings.exifFieldSoftware,
      dateTimeOriginal: strings.exifFieldDateTimeOriginal,
      dateTimeDigitized: strings.exifFieldDateTimeDigitized,
      createDate: strings.exifFieldCreateDate,
      exposureTime: strings.exifFieldExposureTime,
      fNumber: strings.exifFieldFNumber,
      iso: strings.exifFieldIso,
      focalLength: strings.exifFieldFocalLength,
      focalLength35mm: strings.exifFieldFocalLength35mm,
      exposureProgram: strings.exifFieldExposureProgram,
      meteringMode: strings.exifFieldMeteringMode,
      flash: strings.exifFieldFlash,
      whiteBalance: strings.exifFieldWhiteBalance,
      exposureBias: strings.exifFieldExposureBias,
      gpsLatitude: strings.exifFieldGpsLatitude,
      gpsLongitude: strings.exifFieldGpsLongitude,
      gpsAltitude: strings.exifFieldGpsAltitude,
    };
    return map[row.labelKey] ?? row.labelKey;
  }
  return row.labelFallback ?? row.key;
}

function clamp(n: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, n));
}

function measureMaxAlong(edge: ExifPanelEdge, panelW: number, panelH: number, vw: number, vh: number): number {
  if (edge === 'left' || edge === 'right') {
    return Math.max(0, vh - panelH);
  }
  return Math.max(0, vw - panelW);
}

function placementToStyle(
  placement: EdgePlacement,
  panelW: number,
  panelH: number,
  vw: number,
  vh: number,
): React.CSSProperties {
  const maxAlong = measureMaxAlong(placement.edge, panelW, panelH, vw, vh);
  const along = clamp(placement.along, 0, maxAlong);

  switch (placement.edge) {
    case 'right':
      return { top: along, right: EDGE_GAP, left: 'auto', bottom: 'auto' };
    case 'left':
      return { top: along, left: EDGE_GAP, right: 'auto', bottom: 'auto' };
    case 'top':
      return { top: EDGE_GAP, left: along, right: 'auto', bottom: 'auto' };
    case 'bottom':
      return { bottom: EDGE_GAP, left: along, right: 'auto', top: 'auto' };
  }
}

function nearestEdge(cx: number, cy: number, vw: number, vh: number): ExifPanelEdge {
  const dL = cx;
  const dR = vw - cx;
  const dT = cy;
  const dB = vh - cy;
  const min = Math.min(dL, dR, dT, dB);
  if (min === dL) return 'left';
  if (min === dR) return 'right';
  if (min === dT) return 'top';
  return 'bottom';
}

function alongFromCenter(
  edge: ExifPanelEdge,
  cx: number,
  cy: number,
  panelW: number,
  panelH: number,
): number {
  if (edge === 'left' || edge === 'right') {
    return cy - panelH / 2;
  }
  return cx - panelW / 2;
}

/**
 * Edge-snapped EXIF panel: drag via the top handle; release snaps to the nearest edge.
 * z-index stays below close / side arrows so those controls remain clickable.
 */
export function ExifInfoPanel({
  exif,
  strings,
  onUserActivity,
}: ExifInfoPanelProps) {
  const groups = useMemo(
    () => buildExifDisplayGroups(exif, strings.exifBoolYes, strings.exifBoolNo),
    [exif, strings.exifBoolYes, strings.exifBoolNo],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<ExifGroupId, HTMLElement | null>>>({});
  const [placement, setPlacement] = useState<EdgePlacement>({ edge: 'right', along: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const [panelSize, setPanelSize] = useState({ w: PANEL_WIDTH, h: 280 });
  const [selectedTab, setSelectedTab] = useState<ExifGroupId | null>(null);
  const activeTab =
    selectedTab != null && groups.some((g) => g.id === selectedTab)
      ? selectedTab
      : (groups[0]?.id ?? null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const update = () => {
      setPanelSize({ w: el.offsetWidth || PANEL_WIDTH, h: el.offsetHeight || 280 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [groups]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const edgeStyle = useMemo(() => {
    if (dragging && dragPos) {
      return { left: dragPos.left, top: dragPos.top, right: 'auto', bottom: 'auto' as const };
    }
    return placementToStyle(placement, panelSize.w, panelSize.h, vw, vh);
  }, [dragging, dragPos, placement, panelSize, vw, vh]);

  const scrollToGroup = useCallback(
    (id: ExifGroupId) => {
      setSelectedTab(id);
      const body = bodyRef.current;
      const section = sectionRefs.current[id];
      if (!body || !section) return;
      const target = section.offsetTop - 8;
      body.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      onUserActivity?.();
    },
    [onUserActivity],
  );

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onUserActivity?.();
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      setDragging(true);
      setDragPos({ left: rect.left, top: rect.top });

      const onMove = (ev: PointerEvent) => {
        const left = clamp(ev.clientX - offsetX, 0, window.innerWidth - rect.width);
        const top = clamp(ev.clientY - offsetY, 0, window.innerHeight - rect.height);
        setDragPos({ left, top });
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const left = clamp(ev.clientX - offsetX, 0, window.innerWidth - rect.width);
        const top = clamp(ev.clientY - offsetY, 0, window.innerHeight - rect.height);
        const cx = left + rect.width / 2;
        const cy = top + rect.height / 2;
        const edge = nearestEdge(cx, cy, window.innerWidth, window.innerHeight);
        const along = alongFromCenter(edge, cx, cy, rect.width, rect.height);
        setPlacement({ edge, along });
        setDragging(false);
        setDragPos(null);
        onUserActivity?.();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [onUserActivity],
  );

  const maxH = Math.round(vh * PANEL_MAX_HEIGHT_VH);

  return (
    <div
      ref={panelRef}
      role="complementary"
      aria-label={strings.exifPanel}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        width: PANEL_WIDTH,
        maxWidth: '100vw',
        maxHeight: maxH,
        display: 'flex',
        flexDirection: 'column',
        background: PANEL_BG,
        color: TEXT,
        borderRadius: 10,
        border: `1px solid ${PANEL_BORDER}`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        userSelect: dragging ? 'none' : 'auto',
        ...edgeStyle,
      }}
    >
      {/* Title row doubles as drag handle */}
      <div
        onPointerDown={onHandlePointerDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '8px 12px 6px',
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          borderBottom: `1px solid ${ROW_BORDER}`,
          flexShrink: 0,
        }}
        aria-label={strings.exifDragHandle}
        title={strings.exifDragHandle}
      >
        <span style={{ fontSize: 12, fontWeight: 650, color: TEXT, letterSpacing: '0.04em' }}>
          EXIF
        </span>
      </div>

      {groups.length === 0 ? (
        <div style={{ padding: '20px 16px', fontSize: 13, color: TEXT_MUTED, lineHeight: 1.5 }}>
          {strings.exifEmpty}
        </div>
      ) : (
        <>
          {groups.length > 1 && (
            <div
              role="tablist"
              aria-label={strings.exifPanel}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                padding: '8px 8px 6px',
                borderBottom: `1px solid ${ROW_BORDER}`,
                flexShrink: 0,
              }}
            >
              {groups.map((g) => {
                const active = activeTab === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => scrollToGroup(g.id)}
                    style={{
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: active ? 650 : 500,
                      cursor: 'pointer',
                      background: active ? TAB_ACTIVE_BG : 'transparent',
                      color: active ? TEXT : TEXT_MUTED,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = TAB_HOVER_BG;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = active ? TAB_ACTIVE_BG : 'transparent';
                    }}
                  >
                    {groupTitle(g.id, strings)}
                  </button>
                );
              })}
            </div>
          )}

          <div
            ref={bodyRef}
            style={{
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: '1 1 auto',
              minHeight: 0,
              padding: '4px 0 10px',
              scrollBehavior: 'smooth',
            }}
          >
            {groups.map((g) => (
              <section
                key={g.id}
                ref={(node) => {
                  sectionRefs.current[g.id] = node;
                }}
                aria-label={groupTitle(g.id, strings)}
                style={{ padding: '8px 12px 4px' }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: TEXT_MUTED,
                    marginBottom: 6,
                  }}
                >
                  {groupTitle(g.id, strings)}
                </div>
                {g.rows.map((row) => (
                  <div
                    key={row.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.15fr',
                      gap: 8,
                      padding: '5px 0',
                      borderBottom: `1px solid ${ROW_BORDER}`,
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: TEXT_MUTED, wordBreak: 'break-word' }}>
                      {fieldLabel(row, strings)}
                    </span>
                    <span style={{ color: TEXT, fontWeight: 500, wordBreak: 'break-word' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
