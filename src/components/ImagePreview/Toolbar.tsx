import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DelayedTooltip } from './DelayedTooltip';
import type { LocaleStrings } from './locale';
import {
  TOOLBAR_NAV_COUNTER_MIN_WIDTH_PX,
  ZOOM_DROPDOWN_MAX_WIDTH_PX,
} from './imagePreviewTuning';
import type { NativePercent, ZoomMode } from './types';
import type { MediaCapabilities } from './core/media-contract';

// ── Design tokens ──────────────────────────────────────────────────────────
// Soft blue-grey palette — readable on dark bg without harsh white contrast.
const C = {
  text:        '#cdd5e0',       // primary icon/text
  textMuted:   'rgba(175,190,210,0.65)', // secondary / counter
  textDisabled:'rgba(130,148,168,0.35)',
  active:      '#cdd5e0',       // same as text when active bg is set
  activeBg:    'rgba(255,255,255,0.16)',
  hoverBg:     'rgba(255,255,255,0.09)',
  divider:     'rgba(140,162,188,0.22)',
  lockActive:  '#7daaff',       // locked state accent colour
} as const;

interface ToolbarProps {
  capabilities?: MediaCapabilities;
  mode: ZoomMode;
  nativePercent: NativePercent;
  fitEquivalentNativePercent?: number;
  stops: NativePercent[];
  atMinStop: boolean;
  atMaxStop: boolean;

  // ── Navigation ────────────────────────────────────────────────────────────
  totalImages: number;
  currentIndex: number;
  /** When provided with groupTotal, shows within-group counter (e.g. `2/3`). */
  groupCurrentIndex?: number;
  groupTotal?: number;
  hasPrevGroup?: boolean;
  hasNextGroup?: boolean;
  onPrevGroup?(): void;
  onNextGroup?(): void;
  /** Toolbar prev/next; parent sets false only for flat lists with `arrows` `'side'` / `'none'`. Always true when `groupedImages` is used. */
  showToolbarArrows?: boolean;

  // ── Image info ────────────────────────────────────────────────────────────
  imageName?: string;
  groupName?: string;
  /** 1-based index among non-empty groups (e.g. 1 of 3); shown before {@link groupName}. */
  groupOrdinal?: number;
  /** Total non-empty groups; paired with {@link groupOrdinal}. */
  groupCount?: number;

  // ── Feature flags ─────────────────────────────────────────────────────────
  showFlip?: boolean;
  /** When true, show the EXIF toggle button. */
  showExif?: boolean;
  /** Whether the EXIF panel is currently open (controls active state). */
  exifOpen?: boolean;
  /** When true, show the delete button. */
  showDelete?: boolean;
  /** When true, show enter/exit fullscreen toggle. */
  showFullscreen?: boolean;
  /** Whether the preview root is currently fullscreen. */
  isFullscreen?: boolean;
  /** Extra host content at the end of the toolbar. */
  toolbarExtra?: React.ReactNode;
  zoomLocked: boolean;
  /** When false the toolbar fades to ghost opacity (driven by CSS transition). */
  controlsVisible?: boolean;
  /** Idle opacity when controls are hidden (0 for minimal chrome). */
  idleOpacity?: number;
  /** Distance from the overlay bottom edge (px). Raised when a thumbnail strip is shown. */
  bottomPx?: number;

  // ── Actions ───────────────────────────────────────────────────────────────
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  onOneToOne(): void;
  onSetNative(percent: NativePercent): void;
  onRotateCW(): void;
  onRotateCCW(): void;
  onFlipH(): void;
  onFlipV(): void;
  onPrev(): void;
  onNext(): void;
  onToggleLock(): void;
  onToggleExif?(): void;
  onDeleteImage?(): void;
  onToggleFullscreen?(): void;
  /** Resolved locale strings — pass the result of `resolveStrings(language)`. */
  strings: LocaleStrings;
  /** Fixed width of the zoom % control between [−] and [+] — use `toolbarZoomLabelSlotPx(language)`. */
  zoomLabelSlotPx: number;
  /** Fixed width of the preset dropdown panel — use `toolbarZoomDropdownWidthPx(language)`. */
  zoomDropdownWidthPx: number;
}

// ── SVG icon helpers ───────────────────────────────────────────────────────

const Icon = ({ children, size = 18, strokeWidth = 2 }: {
  children: React.ReactNode; size?: number; strokeWidth?: number;
}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    width={size} height={size} aria-hidden="true">
    {children}
  </svg>
);

const IconZoomIn    = () => <Icon><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></Icon>;
const IconZoomOut   = () => <Icon><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></Icon>;
const IconLeft      = () => <Icon strokeWidth={2.5}><polyline points="15,18 9,12 15,6"/></Icon>;
const IconRight     = () => <Icon strokeWidth={2.5}><polyline points="9,18 15,12 9,6"/></Icon>;
const IconPrevGroup = () => <Icon strokeWidth={2.5}><polyline points="19,18 13,12 19,6"/><polyline points="11,18 5,12 11,6"/></Icon>;
const IconNextGroup = () => <Icon strokeWidth={2.5}><polyline points="5,18 11,12 5,6"/><polyline points="13,18 19,12 13,6"/></Icon>;
const IconRotateCW  = () => <Icon><path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/></Icon>;
const IconRotateCCW = () => <Icon><path d="M3 2v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/></Icon>;
const IconFlipH     = () => <Icon><path d="M12 3v18" strokeDasharray="2 2"/><path d="M5 8l-3 4 3 4"/><path d="M19 8l3 4-3 4"/></Icon>;
const IconFlipV     = () => <Icon><path d="M3 12h18" strokeDasharray="2 2"/><path d="M8 5l4-3 4 3"/><path d="M8 19l4 3 4-3"/></Icon>;

// 4 outward L-shaped corner brackets
const IconFit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" width={18} height={18} aria-hidden="true">
    <path d="M3 9V3h6 M21 9V3h-6 M3 15v6h6 M21 15v6h-6"/>
  </svg>
);

// "1:1" text-style SVG — two seriffed "1"s with a colon, clearly communicates
// the native 1-to-1 pixel ratio without ambiguity.
const IconOneToOne = () => (
  <svg viewBox="0 0 28 18" width={28} height={18} fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    {/* left "1" */}
    <line x1="7"  y1="3"  x2="7"  y2="15"/>
    <line x1="4"  y1="6"  x2="7"  y2="3"/>
    {/* colon */}
    <circle cx="14" cy="7"  r={1.1} fill="currentColor" stroke="none"/>
    <circle cx="14" cy="11" r={1.1} fill="currentColor" stroke="none"/>
    {/* right "1" */}
    <line x1="21" y1="3"  x2="21" y2="15"/>
    <line x1="18" y1="6"  x2="21" y2="3"/>
  </svg>
);

// Open padlock — zoom unlocked (changes on image switch)
const IconLockOpen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);

// Closed padlock — zoom locked (preserved on image switch)
const IconLockClosed = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// Info / metadata — EXIF panel toggle
const IconExif = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" width={17} height={17} aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <line x1="12" y1="10" x2="12" y2="16"/>
    <circle cx="12" cy="7" r="0.9" fill="currentColor" stroke="none"/>
  </svg>
);

const IconDelete = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" width={17} height={17} aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconEnterFullscreen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" width={17} height={17} aria-hidden="true">
    <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
    <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
    <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
    <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
  </svg>
);

const IconExitFullscreen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" width={17} height={17} aria-hidden="true">
    <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
    <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
    <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
    <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
  </svg>
);

// ── Toolbar button ─────────────────────────────────────────────────────────

interface TBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tip: string;
  active?: boolean;
  accent?: string; // override active/text colour
}

function TBtn({ label, tip, active, accent, children, ...rest }: TBtnProps) {
  const textColor = rest.disabled
    ? C.textDisabled
    : accent
      ? accent
      : C.text;
  const bgColor = active ? C.activeBg : 'transparent';

  return (
    <DelayedTooltip content={tip}>
      <button
        type="button"
        aria-label={label}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 6, border: 'none',
          cursor: rest.disabled ? 'not-allowed' : 'pointer',
          background: bgColor,
          color: textColor,
          transition: 'background 0.15s, color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!rest.disabled) (e.currentTarget as HTMLButtonElement).style.background = active ? C.activeBg : C.hoverBg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = bgColor;
        }}
        {...rest}
      >
        {children}
      </button>
    </DelayedTooltip>
  );
}

const Divider = () => (
  <div style={{ width: 1, height: 18, background: C.divider, margin: '0 3px', flexShrink: 0 }} />
);

// ── MiddleEllipsisName ─────────────────────────────────────────────────────
// Renders a filename with the ellipsis in the *middle*, so the file extension
// and the last few characters of the stem are always visible.
// e.g. "Joel Tonyan – The Orion Nebula and the Running Man.jpg"
//   →  "Joel Tonyan – The Orion Neb…ng Man.jpg"

interface MiddleEllipsisNameProps {
  name: string;
  style?: React.CSSProperties;
}

function MiddleEllipsisName({ name, style }: MiddleEllipsisNameProps) {
  const dotIdx = name.lastIndexOf('.');
  // No extension or hidden-file style (.bashrc): plain end-truncation
  if (dotIdx <= 0) {
    return (
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...style }}>
        {name}
      </span>
    );
  }

  const stem = name.slice(0, dotIdx);
  const ext  = name.slice(dotIdx);  // includes the dot

  // Keep last TAIL chars of stem + extension always visible at the end.
  const TAIL = 8;

  if (stem.length <= TAIL + 3) {
    // Stem is short — just show stem (possibly truncated) + ext side-by-side.
    return (
      <span style={{ display: 'flex', minWidth: 0, overflow: 'hidden', ...style }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: '2ch' }}>
          {stem}
        </span>
        <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{ext}</span>
      </span>
    );
  }

  // Long stem: split so ellipsis lands in the middle.
  const startPart = stem.slice(0, stem.length - TAIL);
  const tailPart  = stem.slice(-TAIL) + ext;

  return (
    <span style={{ display: 'flex', minWidth: 0, overflow: 'hidden', ...style }}>
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flexShrink: 1, minWidth: '2ch',
      }}>
        {startPart}
      </span>
      <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{tailPart}</span>
    </span>
  );
}

// ── ZoomInput ──────────────────────────────────────────────────────────────

interface ZoomInputProps {
  disabled?: boolean;
  mode: ZoomMode;
  nativePercent: NativePercent;
  fitEquivalentNativePercent?: number;
  stops: NativePercent[];
  onFit(): void;
  onSetNative(percent: NativePercent): void;
  strings: LocaleStrings;
  zoomLabelSlotPx: number;
  zoomDropdownWidthPx: number;
}

function ZoomInput({
  disabled = false,
  mode,
  nativePercent,
  fitEquivalentNativePercent,
  stops,
  onFit,
  onSetNative,
  strings,
  zoomLabelSlotPx,
  zoomDropdownWidthPx,
}: ZoomInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayLabel = mode === 'fit'
    ? (fitEquivalentNativePercent !== undefined
        ? `${Math.round(fitEquivalentNativePercent)}%`
        : '—')
    : `${Math.round(nativePercent)}%`;
  const currentStopMatch = mode === 'native' ? Math.round(nativePercent) : null;

  const open = useCallback(() => {
    if (disabled) return;
    setInputValue(
      mode === 'fit'
        ? (fitEquivalentNativePercent !== undefined
            ? String(Math.round(fitEquivalentNativePercent))
            : '')
        : String(Math.round(nativePercent)),
    );
    setIsOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [disabled, mode, nativePercent, fitEquivalentNativePercent]);

  const maxStop = useMemo(() => Math.max(...stops), [stops]);

  const commit = useCallback((raw: string) => {
    const trimmed = raw.trim().replace('%', '');
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num > 0) onSetNative(Math.min(num, maxStop));
    setIsOpen(false);
  }, [maxStop, onSetNative]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const sortedDesc = [...stops].sort((a, b) => b - a);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        flexShrink: 0,
        width: zoomLabelSlotPx,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {isOpen ? (
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(inputValue);
            if (e.key === 'Escape') setIsOpen(false);
            e.stopPropagation();
          }}
          style={{
            width: '100%',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(180,200,225,0.3)',
            borderRadius: 5, color: C.text, fontSize: 13,
            padding: '3px 4px', outline: 'none', boxSizing: 'border-box',
          }}
        />
      ) : (
        <DelayedTooltip content={strings.tipZoomLevel}>
          <span
            onClick={open}
            role="button"
            aria-disabled={disabled}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(); }}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              textAlign: 'center',
              fontSize: 13, color: disabled ? C.textDisabled : C.text,
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: '3px 5px', borderRadius: 5,
              border: '1px solid transparent',
              fontVariantNumeric: 'tabular-nums',
              transition: 'border-color 0.15s',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.borderColor = 'rgba(180,200,225,0.28)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.borderColor = 'transparent'; }}
          >
            {displayLabel}
          </span>
        </DelayedTooltip>
      )}

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            /* Wider than the narrow % trigger so “Fit (n%)” / preset rows fit; clamp on small viewports. */
            width: zoomDropdownWidthPx,
            minWidth: 0,
            maxWidth: `min(92vw, ${ZOOM_DROPDOWN_MAX_WIDTH_PX}px)`,
            background: 'rgba(12,16,26,0.97)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(140,162,188,0.18)',
            borderRadius: 9,
            padding: '4px 0',
            boxShadow: '0 -6px 24px rgba(0,0,0,0.55)',
            zIndex: 200,
            boxSizing: 'border-box',
          }}
        >
          {sortedDesc.map((stop) => (
            <DropdownRow
              key={stop}
              label={`${stop}%`}
              tip={strings.tipZoomRowPercent(stop)}
              active={currentStopMatch === stop}
              onMouseDown={() => { onSetNative(stop); setIsOpen(false); }}
            />
          ))}
          <div style={{ height: 1, background: C.divider, margin: '3px 0' }} />
          <DropdownRow
            label={
              fitEquivalentNativePercent !== undefined
                ? strings.fitApprox(Math.round(fitEquivalentNativePercent))
                : strings.fit
            }
            tip={
              fitEquivalentNativePercent !== undefined
                ? strings.tipZoomRowFitApprox(Math.round(fitEquivalentNativePercent))
                : strings.tipZoomRowFit
            }
            active={mode === 'fit'}
            onMouseDown={() => { onFit(); setIsOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

interface DropdownRowProps {
  label: string;
  tip: string;
  active: boolean;
  onMouseDown(): void;
}

function DropdownRow({ label, tip, active, onMouseDown }: DropdownRowProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <DelayedTooltip content={tip}>
      <div
        onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          columnGap: 8,
          padding: '5px 8px',
          cursor: 'pointer',
          background: active ? 'rgba(88,101,242,0.18)' : hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
          transition: 'background 0.1s',
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
        }}
      >
      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          fontSize: 13,
          color: active ? '#8fa8ff' : C.text,
          fontWeight: active ? 600 : 400,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      <span
        style={{
          width: 14,
          flex: '0 0 14px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {active && (
          <svg viewBox="0 0 16 16" fill="currentColor" width={12} height={12}
            style={{ color: '#8fa8ff' }} aria-hidden="true">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
          </svg>
        )}
      </span>
    </div>
    </DelayedTooltip>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────────────

export function Toolbar({
  capabilities = {
    zoom: true, nativeZoom: true, pan: true, rotate: true, flip: true, minimap: true,
  },
  mode, nativePercent, fitEquivalentNativePercent,
  atMinStop, atMaxStop,
  totalImages, currentIndex,
  groupCurrentIndex, groupTotal,
  hasPrevGroup, hasNextGroup,
  onPrevGroup, onNextGroup,
  showToolbarArrows = true,
  imageName, groupName, groupOrdinal, groupCount,
  showFlip = false,
  showExif = false,
  exifOpen = false,
  showDelete = false,
  showFullscreen = false,
  isFullscreen = false,
  toolbarExtra,
  zoomLocked,
  controlsVisible = true,
  idleOpacity = 0.1,
  bottomPx = 20,
  stops,
  onZoomIn, onZoomOut, onFit, onOneToOne, onSetNative,
  onRotateCW, onRotateCCW, onFlipH, onFlipV,
  onPrev, onNext, onToggleLock, onToggleExif, onDeleteImage, onToggleFullscreen,
  strings,
  zoomLabelSlotPx,
  zoomDropdownWidthPx,
}: ToolbarProps) {
  const canZoomOut = capabilities.zoom && mode === 'native' && !atMinStop;
  const canZoomIn  = capabilities.zoom && !(mode === 'native' && atMaxStop);
  const isGroupMode = groupTotal !== undefined && groupCurrentIndex !== undefined;
  const showNav = isGroupMode || totalImages > 1;

  // Measure the toolbar action row so the info badge never exceeds its width.
  const toolbarRowRef = useRef<HTMLDivElement>(null);
  const [badgeMaxWidth, setBadgeMaxWidth] = useState<number>(560);
  useLayoutEffect(() => {
    const el = toolbarRowRef.current;
    if (!el) return;
    const update = () => setBadgeMaxWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    // Outer wrapper: transparent column — badge sits above action row.
    // opacity transitions: fast restore (0.12 s) / slow fade (1.6 s).
    <div
      style={{
        position: 'absolute',
        bottom: bottomPx,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        userSelect: 'none',
        zIndex: 10,
        opacity: controlsVisible ? 1 : idleOpacity,
        transition: controlsVisible
          ? 'opacity 0.12s ease'
          : 'opacity 1.6s ease',
        pointerEvents: controlsVisible || idleOpacity > 0 ? 'auto' : 'none',
      }}
    >
      {/* ── Info badge — adapts to content width, capped at toolbar width ── */}
      {imageName && (
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            background: 'rgba(6,10,20,0.58)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: 7,
            padding: '5px 14px',
            // Grow to show full name; never wider than the toolbar row below.
            maxWidth: badgeMaxWidth,
            // Allow the badge to shrink its content area.
            minWidth: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {/* Filename only — index lives in the toolbar between prev/next */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, width: '100%', minWidth: 0 }}>
            <MiddleEllipsisName
              name={imageName}
              style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: '1 1 0' }}
            />
          </div>
          {/* Group/folder subtitle: (i/n) uses same tone as the in-group counter; name may differ */}
          {(groupName != null && groupName !== '') || (groupOrdinal != null && groupCount != null) ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                minWidth: 0,
                width: '100%',
                maxWidth: '100%',
              }}
            >
              {groupOrdinal != null && groupCount != null ? (
                <span
                  style={{
                    fontSize: 12,
                    color: C.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  ({groupOrdinal}/{groupCount})
                </span>
              ) : null}
              {groupName != null && groupName !== '' ? (
                <span
                  style={{
                    fontSize: 11,
                    color: '#c8d0e0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: '1 1 0',
                  }}
                >
                  {groupName}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Action row — own background ── */}
      <div
        ref={toolbarRowRef}
        role="toolbar"
        aria-label={strings.toolbar}
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 1,
          padding: '3px 8px',
          borderRadius: 10,
          background: 'rgba(6,10,20,0.68)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          maxWidth: 'calc(100vw - 40px)',
        }}
      >
        {/* ── Navigation ── */}
        {showNav && (
          <>
            {isGroupMode && (
              <TBtn
                label={strings.prevGroup}
                tip={strings.tipPrevGroup}
                onClick={onPrevGroup}
                disabled={!hasPrevGroup}
              >
                <IconPrevGroup />
              </TBtn>
            )}

            {showToolbarArrows && (
              <TBtn
                label={strings.prev}
                tip={strings.tipPrev}
                onClick={onPrev}
                disabled={currentIndex === 0}
              >
                <IconLeft />
              </TBtn>
            )}

            <span
              style={{
                fontSize: 12,
                color: C.textMuted,
                minWidth: TOOLBAR_NAV_COUNTER_MIN_WIDTH_PX,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                padding: '0 4px',
                flexShrink: 0,
              }}
            >
              {isGroupMode
                ? `${groupCurrentIndex} / ${groupTotal}`
                : `${currentIndex + 1} / ${totalImages}`}
            </span>

            {showToolbarArrows && (
              <TBtn
                label={strings.next}
                tip={strings.tipNext}
                onClick={onNext}
                disabled={currentIndex === totalImages - 1}
              >
                <IconRight />
              </TBtn>
            )}

            {isGroupMode && (
              <TBtn
                label={strings.nextGroup}
                tip={strings.tipNextGroup}
                onClick={onNextGroup}
                disabled={!hasNextGroup}
              >
                <IconNextGroup />
              </TBtn>
            )}

            <Divider />
          </>
        )}

        {/* ── Flip (optional) ── */}
        {showFlip && (
          <>
        <TBtn label={strings.flipH} tip={strings.tipFlipH} onClick={onFlipH} disabled={!capabilities.flip}><IconFlipH /></TBtn>
        <TBtn label={strings.flipV} tip={strings.tipFlipV} onClick={onFlipV} disabled={!capabilities.flip}><IconFlipV /></TBtn>
            <Divider />
          </>
        )}

        {/* ── Rotate ── */}
        <TBtn label={strings.rotateCCW} tip={strings.tipRotateCCW} onClick={onRotateCCW} disabled={!capabilities.rotate}><IconRotateCCW /></TBtn>
        <TBtn label={strings.rotateCW} tip={strings.tipRotateCW} onClick={onRotateCW} disabled={!capabilities.rotate}><IconRotateCW /></TBtn>

        <Divider />

        {/* ── Jump-to-zoom presets ── */}
        <TBtn label={strings.fitToViewport} tip={strings.tipFitToViewport} onClick={onFit} disabled={!capabilities.zoom} active={mode === 'fit'}><IconFit /></TBtn>
        <TBtn label={strings.actualSize} tip={strings.tipActualSize} onClick={onOneToOne} disabled={!capabilities.nativeZoom} active={mode === 'native' && nativePercent === 100}><IconOneToOne /></TBtn>

        <Divider />

        {/* ── Precise zoom control: [-] [value] [+] [lock] ── */}
        <TBtn label={strings.zoomOut} tip={strings.tipZoomOut} onClick={onZoomOut} disabled={!canZoomOut}><IconZoomOut /></TBtn>

        <ZoomInput
          disabled={!capabilities.zoom}
          mode={mode}
          nativePercent={nativePercent}
          fitEquivalentNativePercent={fitEquivalentNativePercent}
          stops={stops}
          onFit={onFit}
          onSetNative={onSetNative}
          strings={strings}
          zoomLabelSlotPx={zoomLabelSlotPx}
          zoomDropdownWidthPx={zoomDropdownWidthPx}
        />

        <TBtn label={strings.zoomIn} tip={strings.tipZoomIn} onClick={onZoomIn} disabled={!canZoomIn}><IconZoomIn /></TBtn>

        {/* Lock: sits at the end of the zoom cluster — toggles whether zoom is
            preserved when switching images */}
        <TBtn
          label={zoomLocked ? strings.unlockZoom : strings.lockZoom}
          tip={zoomLocked ? strings.tipUnlockZoom : strings.tipLockZoom}
          active={zoomLocked}
          accent={zoomLocked ? C.lockActive : undefined}
          onClick={onToggleLock}
          disabled={!capabilities.zoom}
        >
          {zoomLocked ? <IconLockClosed /> : <IconLockOpen />}
        </TBtn>

        {showExif && (
          <>
            <Divider />
            <TBtn
              label={exifOpen ? strings.hideExif : strings.showExif}
              tip={exifOpen ? strings.tipHideExif : strings.tipShowExif}
              active={exifOpen}
              onClick={onToggleExif}
            >
              <IconExif />
            </TBtn>
          </>
        )}

        {showDelete && (
          <>
            <Divider />
            <TBtn
              label={strings.deleteImage}
              tip={strings.tipDeleteImage}
              onClick={onDeleteImage}
            >
              <IconDelete />
            </TBtn>
          </>
        )}

        {showFullscreen && (
          <>
            <Divider />
            <TBtn
              label={isFullscreen ? strings.exitFullscreen : strings.enterFullscreen}
              tip={isFullscreen ? strings.tipExitFullscreen : strings.tipEnterFullscreen}
              active={isFullscreen}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <IconExitFullscreen /> : <IconEnterFullscreen />}
            </TBtn>
          </>
        )}

        {toolbarExtra != null && (
          <>
            <Divider />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {toolbarExtra}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
