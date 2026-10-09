import { default as React } from 'react';
import { LocaleStrings } from './locale.js';
import { NativePercent, ZoomMode } from './types.js';
import { MediaCapabilities } from './core/media-contract.js';
interface ToolbarProps {
    capabilities?: MediaCapabilities;
    mode: ZoomMode;
    nativePercent: NativePercent;
    fitEquivalentNativePercent?: number;
    stops: NativePercent[];
    atMinStop: boolean;
    atMaxStop: boolean;
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
    imageName?: string;
    groupName?: string;
    /** 1-based index among non-empty groups (e.g. 1 of 3); shown before {@link groupName}. */
    groupOrdinal?: number;
    /** Total non-empty groups; paired with {@link groupOrdinal}. */
    groupCount?: number;
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
export declare function Toolbar({ capabilities, mode, nativePercent, fitEquivalentNativePercent, atMinStop, totalImages, currentIndex, groupCurrentIndex, groupTotal, hasPrevGroup, hasNextGroup, onPrevGroup, onNextGroup, showToolbarArrows, imageName, groupName, groupOrdinal, groupCount, showFlip, showExif, exifOpen, showDelete, showFullscreen, isFullscreen, toolbarExtra, zoomLocked, controlsVisible, idleOpacity, bottomPx, stops, onZoomIn, onZoomOut, onFit, onOneToOne, onSetNative, onRotateCW, onRotateCCW, onFlipH, onFlipV, onPrev, onNext, onToggleLock, onToggleExif, onDeleteImage, onToggleFullscreen, strings, zoomLabelSlotPx, zoomDropdownWidthPx, }: ToolbarProps): import("react/jsx-runtime").JSX.Element;
export {};
