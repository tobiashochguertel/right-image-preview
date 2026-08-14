import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Minimap, MINIMAP_BOTTOM } from '../Minimap';
import { ImagePreviewCloseButton } from '../parts/ImagePreviewCloseButton';
import { ExifInfoPanel } from '../parts/ExifInfoPanel';
import { DisplayStageLayers } from '../parts/DisplayStageLayers';
import type { DisplayLayerEntry, LayerPresentation } from '../parts/DisplayStageLayers';
import { ThumbnailsStrip } from '../parts/ThumbnailsStrip';
import { ImagePreviewNavArrow } from '../parts/ImagePreviewNavArrow';
import { Toolbar } from '../Toolbar';
import {
  IMAGE_DECODE_TIMEOUT_MS,
  KEYBOARD_PAN_STEP_VIEWPORT_FRACTION,
  MIN_PROGRESSIVE_THUMB_VISIBLE_MS,
  NAV_HOLD_MIN_VISIBLE_MS,
  PROGRESSIVE_MAIN_DEFAULT_FADE_MS,
  THUMBNAIL_STRIP_TOOLBAR_GAP_PX,
  thumbnailStripTotalHeightPx,
  toolbarZoomDropdownWidthPx,
  toolbarZoomLabelSlotPx,
} from '../imagePreviewTuning';
import { injectGlobalStyle } from '../injectGlobalStyle';
import { findGroup } from '../lib/imagePreviewFindGroup';
import { scheduleRevealAfterDecode } from '../lib/imagePreviewDecode';
import {
  isLocalPackBuild,
  LOCAL_PACK_BUILD_AT,
  PACKAGE_VERSION,
} from '../lib/localPackBuildInfo';
import { mergeByteAndDisplayStatus, PRELOAD_DISPLAY_SETTLE_MS } from '../lib/neighborDisplayPreload';
import {
  resolveDefaultGroupedFlatIndex,
  resolvePreviewImages,
} from '../flattenGroupedImages';
import { mergeStrings, resolveStrings } from '../locale';
import type {
  ImagePreviewProps,
  ImagePreviewRef,
  NativePercent,
  NeighborPreloadStatusMap,
} from '../types';
import { useImagePreviewKeyboard } from '../useImagePreviewKeyboard';
import { useHoldStagePresented } from '../useHoldStagePresented';
import { useThumbPacedNavigation } from '../useThumbPacedNavigation';
import { useImageTransform } from '../useImageTransform';
import type { ImageDimensions } from '../useImageTransform';
import { useNeighborDisplayPreload } from '../useNeighborDisplayPreload';
import { useNeighborPreload } from '../useNeighborPreload';
import { useProgressiveMainImage } from '../useProgressiveMainImage';
import { usePinchZoom } from '../usePinchZoom';
import { useWheelZoom } from '../useWheelZoom';
import { useZoomState } from '../useZoomState';

const DEFAULT_STOPS: NativePercent[] = [10, 25, 50, 75, 100, 125, 150, 175, 200];

injectGlobalStyle('rip-spin', '@keyframes _rip_spin{to{transform:rotate(360deg)}}');

// ── Inner dialog ───────────────────────────────────────────────────────────
export const ImagePreviewInner = forwardRef<ImagePreviewRef, ImagePreviewProps>(
  function ImagePreviewInner(props, ref) {
    const {
      stops = DEFAULT_STOPS,
      initialMode = 'fit',
      initialNativePercent,
      firstZoomInStrategy = 'above-fit',
      zoomOutBelowMinBehaviour = 'noop',
      zoomInAtMaxBehaviour = 'noop',
      wheelEnabled = true,
      doubleClickEnabled = true,
      pinchEnabled = true,
      switchImageResetZoom = true,
      switchImageResetTransform = true,
      fitResetPan = true,
      defaultIndex = 0,
      showFlip = false,
      showExif = false,
      initialExifOpen = false,
      showDelete = false,
      arrows = 'both',
      initialZoomLocked = false,
      showMinimap = true,
      showThumbnails = false,
      thumbnailsScope = 'group',
      presentation = 'overlay',
      preloadRadius = 1,
      preloadDisplaySlots = 0,
      preloadDisplaySettleMs = PRELOAD_DISPLAY_SETTLE_MS,
      holdMinVisibleMs = NAV_HOLD_MIN_VISIBLE_MS,
      preloadMemoryBudgetBytes,
      estimateDecodedBytes,
      preloadDisplayMode = 'slot',
      onPreloadIndexesChange,
      onPreloadStatusChange,
      showThumbnailPreloadStatus = false,
      showSwitchLoader = true,
      chrome = 'default',
      progressiveMain = true,
      progressivePlaceholderMinMs = MIN_PROGRESSIVE_THUMB_VISIBLE_MS,
      progressiveFadeMs = PROGRESSIVE_MAIN_DEFAULT_FADE_MS,
      onMainImageLoadStageChange,
      closeOnMaskClick = false,
      overlayClassName,
      overlayStyle,
      language,
      strings: stringOverrides,
      index: controlledIndex,
      toolbarExtra,
      onClose,
      onZoomChange,
      onIndexChange,
      onMaxStopReached,
      onImageError,
      errorFallback,
      onDeleteImage,
    } = props;

    const isContained = presentation === 'contained';
    const isIndexControlled = controlledIndex !== undefined;
    const idleOpacity = chrome === 'minimal' ? 0 : 0.1;
    const minimapIdleOpacity = chrome === 'minimal' ? 0 : 0.12;

    // Resolve locale strings once; re-resolves when `language` or overrides change.
    const t = useMemo(
      () => mergeStrings(resolveStrings(language), stringOverrides),
      [language, stringOverrides],
    );
    const zoomLabelSlotPx = useMemo(() => toolbarZoomLabelSlotPx(language), [language]);
    const zoomDropdownWidthPx = useMemo(() => toolbarZoomDropdownWidthPx(language), [language]);

    const { images, groupSlices } = useMemo(
      () => resolvePreviewImages(props),
      // Intentionally omit other props — only data fields affect the resolved list.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- groupedImages, images, src, alt, minimap*, exif
      [props.groupedImages, props.images, props.src, props.alt, props.minimapSrc, props.minimap, props.exif],
    );

    const hasGroups = Array.isArray(groupSlices) && groupSlices.length > 0;
    // `arrows` only gates the side-of-image buttons. Toolbar prev/next are always on when `groupedImages` is used.
    const showSideArrows    = arrows === 'both' || arrows === 'side';
    const showToolbarArrows = hasGroups || arrows === 'both' || arrows === 'toolbar';
    const sortedStops = useMemo(() => [...stops].sort((a, b) => a - b), [stops]);

    const [currentIndex, setCurrentIndex] = useState(() => {
      if (hasGroups && props.defaultGroupedSelection && props.groupedImages?.length) {
        return resolveDefaultGroupedFlatIndex(props.groupedImages, props.defaultGroupedSelection);
      }
      if (controlledIndex !== undefined) return controlledIndex;
      return defaultIndex;
    });

    // Controlled flat index: host is the source of truth.
    useEffect(() => {
      if (controlledIndex === undefined) return;
      setCurrentIndex(controlledIndex);
    }, [controlledIndex]);

    const [zoomLocked, setZoomLocked] = useState(initialZoomLocked);
    const [exifOpen, setExifOpen] = useState(initialExifOpen && showExif);
    const [minimapDragging, setMinimapDragging] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // ── Zoom state machine ──────────────────────────────────────────────────
    const zoomState = useZoomState({
      stops: sortedStops,
      initialMode,
      initialNativePercent,
      firstZoomInStrategy,
      zoomOutBelowMinBehaviour,
      zoomInAtMaxBehaviour,
      onZoomChange,
      onMaxStopReached,
    });
    const { mode, nativePercent, zoomIn, zoomOut, fit, setNative, reset, peekZoomIn, peekZoomOut } = zoomState;

    // ── Image transform ─────────────────────────────────────────────────────
    const {
      transform,
      isPanning,
      fitEquivalentNativePercent,
      setContainerEl,
      onImageLoad,
      resetImageDims,
      onPanStart,
      onPanMove,
      onPanEnd,
      resetPan,
      rotateCW,
      rotateCCW,
      flipHorizontal,
      flipVertical,
      resetOrientation,
      imageDims,
      containerSize,
      zoomAnchorTranslate,
      panByDelta,
      panJumpToNatural,
    } = useImageTransform({ mode, nativePercent, fitResetPan });

    // ── Current image ───────────────────────────────────────────────────────
    const currentImage = images[currentIndex] ?? images[0];

    const {
      displayReadyIndexes,
      isSrcDisplayReady,
      getMeta,
      markSrcDisplayReady,
      slotRenderEntries,
      onSlotImgLoad,
    } = useNeighborDisplayPreload({
      images,
      currentIndex,
      radius: preloadRadius,
      displaySlots: preloadDisplaySlots,
      memoryBudgetBytes: preloadMemoryBudgetBytes,
      estimateDecodedBytes,
      mode: preloadDisplayMode,
      interactionBusy: isPanning || minimapDragging,
      settleMs: preloadDisplaySettleMs,
    });

    const layerElBySrcRef = useRef(new Map<string, HTMLImageElement>());
    const prevSrcRef = useRef(currentImage.src);
    const prevIndexRef = useRef(currentIndex);

    /**
     * Keep progressive underlay whenever we have `minimapSrc` — never blank the stage.
     * Display-ready only skips artificial dwell.
     */
    const preferFastReveal = progressiveMain && isSrcDisplayReady(currentImage.src);
    const knownDisplayMeta = preferFastReveal ? getMeta(currentImage.src) ?? null : null;

    /** Previous frame held full-size until the incoming image is paintable (anti-black). */
    const [outgoingSrc, setOutgoingSrc] = useState<string | null>(null);
    const [outgoingIndex, setOutgoingIndex] = useState(-1);
    const [outgoingDims, setOutgoingDims] = useState<ImageDimensions | null>(null);
    const outgoingSrcRef = useRef<string | null>(null);
    const outgoingDimsRef = useRef<ImageDimensions | null>(null);
    const outgoingIndexRef = useRef(-1);
    /** rAF ids — reserved for reveal suppress cleanup only. */
    const revealSuppressRafRef = useRef<number | null>(null);
    /**
     * Last full-size pose of the image currently on stage (dims + zoom/pan CSS).
     * Captured while that src is stable; locked in `goTo` *before* resetPan/reset so
     * outgoing hold keeps the real view instead of the post-reset fit pose.
     */
    const lastPresentationRef = useRef<LayerPresentation & { src: string } | null>(null);
    /** After goTo snapshots outgoing, skip overwriting lastPresentation with reset transform. */
    const presentationCaptureLockRef = useRef(false);
    /** Per-src frozen box + transform — never reuse the live transform for a leaving frame. */
    const frozenBySrcRef = useRef(new Map<string, LayerPresentation>());
    const [frozenEpoch, setFrozenEpoch] = useState(0);

    const freezePresentation = useCallback(
      (src: string, dims: ImageDimensions, cssTransform: string) => {
        if (!src || dims.naturalWidth <= 0 || dims.naturalHeight <= 0) return;
        frozenBySrcRef.current.set(src, {
          dims: { naturalWidth: dims.naturalWidth, naturalHeight: dims.naturalHeight },
          cssTransform,
        });
        // Cap retained freezes (current + neighbors + a little headroom).
        const keep = new Set<string>([src, currentImage.src]);
        for (const e of slotRenderEntries) keep.add(e.src);
        if (outgoingSrcRef.current) keep.add(outgoingSrcRef.current);
        if (frozenBySrcRef.current.size > 24) {
          for (const key of frozenBySrcRef.current.keys()) {
            if (frozenBySrcRef.current.size <= 16) break;
            if (!keep.has(key)) frozenBySrcRef.current.delete(key);
          }
        }
        setFrozenEpoch((n) => n + 1);
      },
      [currentImage.src, slotRenderEntries],
    );

    // Track the live full pose while parked on one src (for outgoing hold).
    // Only while src is stable — never on the navigate frame (would clobber the leaving snap).
    if (
      !presentationCaptureLockRef.current &&
      prevSrcRef.current === currentImage.src &&
      imageDims &&
      imageDims.naturalWidth > 0 &&
      imageDims.naturalHeight > 0
    ) {
      lastPresentationRef.current = {
        src: currentImage.src,
        dims: {
          naturalWidth: imageDims.naturalWidth,
          naturalHeight: imageDims.naturalHeight,
        },
        cssTransform: transform.cssTransform,
      };
    }

    /**
     * Same-frame outgoing capture: the first render after `src` changes must already mark the
     * previous image as outgoing, with its transform frozen — the live transform parent must
     * never move that frame.
     */
    let holdSrc = outgoingSrc;
    let holdDims = outgoingDims;
    let holdIndex = outgoingIndex;
    if (prevSrcRef.current !== currentImage.src) {
      const prevSrc = prevSrcRef.current;
      const prevEl = layerElBySrcRef.current.get(prevSrc);
      const prevFrozen = frozenBySrcRef.current.get(prevSrc);
      const snap = lastPresentationRef.current;
      const snapForPrev = snap && snap.src === prevSrc ? snap : null;
      const prevFromEl = !!(prevEl && prevEl.complete && prevEl.naturalWidth > 0);
      // Prefer last live pose (zoom/pan); then frozen; then <img> natural size.
      if (prevSrc && (snapForPrev || prevFrozen?.dims || prevFromEl)) {
        holdSrc = prevSrc;
        holdIndex = prevIndexRef.current;
        holdDims = snapForPrev
          ? { ...snapForPrev.dims }
          : prevFrozen?.dims
            ? { ...prevFrozen.dims }
            : {
                naturalWidth: prevEl!.naturalWidth,
                naturalHeight: prevEl!.naturalHeight,
              };
        const cssTransform =
          snapForPrev?.cssTransform ??
          prevFrozen?.cssTransform ??
          transform.cssTransform;
        outgoingSrcRef.current = holdSrc;
        outgoingDimsRef.current = holdDims;
        outgoingIndexRef.current = holdIndex;
        if (holdDims) {
          // Always overwrite — neighbor-era freeze must not keep a stale fit pose.
          frozenBySrcRef.current.set(prevSrc, {
            dims: { ...holdDims },
            cssTransform,
          });
        }
      } else if (outgoingSrcRef.current && outgoingSrcRef.current !== currentImage.src) {
        holdSrc = outgoingSrcRef.current;
        holdDims = outgoingDimsRef.current;
        holdIndex = outgoingIndexRef.current;
      }
    } else {
      outgoingSrcRef.current = outgoingSrc;
      outgoingDimsRef.current = outgoingDims;
      outgoingIndexRef.current = outgoingIndex;
      holdSrc = outgoingSrc;
      holdDims = outgoingDims;
      holdIndex = outgoingIndex;
    }

    const frozenBySrc = useMemo(
      () => new Map(frozenBySrcRef.current),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- epoch bumps when map mutates
      [frozenEpoch, holdSrc, currentImage.src],
    );

    const displayLayers: DisplayLayerEntry[] = useMemo(() => {
      const bySrc = new Map<string, number>();
      for (const e of slotRenderEntries) bySrc.set(e.src, e.index);
      bySrc.set(currentImage.src, currentIndex);
      if (holdSrc && holdSrc !== currentImage.src) {
        bySrc.set(holdSrc, holdIndex >= 0 ? holdIndex : currentIndex);
      }
      return [...bySrc.entries()].map(([src, index]) => ({
        src,
        index,
        isCurrent: src === currentImage.src,
        isOutgoing: src === holdSrc && src !== currentImage.src,
      }));
    }, [slotRenderEntries, currentImage.src, currentIndex, holdSrc, holdIndex]);

    /** Suppress CSS transform easing across image switches (avoids ~0.3s zoom pop). */
    const [suppressTransformForSrcSwitch, setSuppressTransformForSrcSwitch] = useState(false);
    const [imageShowReady, setImageShowReady] = useState(false);
    /**
     * Hold-pace paint gates: layout dims / progressive stage alone are NOT enough —
     * known size can make the stage "ready" while still black + Loading.
     */
    const [paceVisitSrc, setPaceVisitSrc] = useState(currentImage.src);
    const [paceUnderlayPainted, setPaceUnderlayPainted] = useState(false);
    const [paceMainPainted, setPaceMainPainted] = useState(false);
    if (paceVisitSrc !== currentImage.src) {
      setPaceVisitSrc(currentImage.src);
      setPaceUnderlayPainted(false);
      setPaceMainPainted(false);
    }
    const underlayElRef = useRef<HTMLImageElement | null>(null);

    // Cold open from gallery: seed layout from host EXIF before decode so the stage box
    // has a real aspect (avoids underlay-in-collapsed-box → tall thin strip).
    useLayoutEffect(() => {
      const w = Number(currentImage.exif?.width);
      const h = Number(currentImage.exif?.height);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 1 && h > 1) {
        onImageLoad({ naturalWidth: w, naturalHeight: h });
      }
    }, [currentImage.src, currentImage.exif?.width, currentImage.exif?.height, onImageLoad]);

    useLayoutEffect(() => {
      if (prevSrcRef.current === currentImage.src) return;

      const prevSrc = prevSrcRef.current;
      const prevIndex = prevIndexRef.current;
      const prevEl = layerElBySrcRef.current.get(prevSrc);
      const prevFrozen = frozenBySrcRef.current.get(prevSrc);
      const snap = lastPresentationRef.current;
      const snapForPrev = snap && snap.src === prevSrc ? snap : null;
      const prevFromEl = !!(prevEl && prevEl.complete && prevEl.naturalWidth > 0);

      // Outgoing hold: full-size + frozen zoom/pan until incoming is laid out full-size.
      if (prevSrc && (snapForPrev || prevFrozen?.dims || prevFromEl)) {
        const dims = snapForPrev
          ? { ...snapForPrev.dims }
          : prevFrozen?.dims
            ? { ...prevFrozen.dims }
            : {
                naturalWidth: prevEl!.naturalWidth,
                naturalHeight: prevEl!.naturalHeight,
              };
        const cssTransform =
          snapForPrev?.cssTransform ??
          prevFrozen?.cssTransform ??
          transform.cssTransform;
        outgoingSrcRef.current = prevSrc;
        outgoingDimsRef.current = dims;
        outgoingIndexRef.current = prevIndex;
        setOutgoingSrc(prevSrc);
        setOutgoingIndex(prevIndex);
        setOutgoingDims(dims);
        freezePresentation(prevSrc, dims, cssTransform);
      } else if (!outgoingSrcRef.current) {
        outgoingSrcRef.current = null;
        outgoingDimsRef.current = null;
        outgoingIndexRef.current = -1;
        setOutgoingSrc(null);
        setOutgoingIndex(-1);
        setOutgoingDims(null);
      }
      // else: keep existing outgoing across a skip where the intermediate never painted

      prevSrcRef.current = currentImage.src;
      prevIndexRef.current = currentIndex;
      presentationCaptureLockRef.current = false;
      setSuppressTransformForSrcSwitch(true);

      const el = layerElBySrcRef.current.get(currentImage.src);
      const meta = getMeta(currentImage.src);
      const paintable = !!(el && el.complete && el.naturalWidth > 0);
      // Live transform only drives the *current* layer; outgoing keeps a frozen copy.
      if (paintable) {
        setPaceMainPainted(true);
        onImageLoad({
          naturalWidth: el!.naturalWidth,
          naturalHeight: el!.naturalHeight,
        });
      } else if (meta) {
        onImageLoad(meta);
      } else if (!outgoingSrcRef.current) {
        resetImageDims();
      }
    }, [
      currentImage.src,
      currentIndex,
      getMeta,
      onImageLoad,
      resetImageDims,
      freezePresentation,
      transform.cssTransform,
    ]);

    const progressive = useProgressiveMainImage({
      mainSrc: currentImage.src,
      minimapSrc: currentImage.minimapSrc,
      minimapCustom: !!currentImage.minimap,
      enabled: progressiveMain,
      placeholderMinVisibleMs: progressivePlaceholderMinMs,
      preferFastReveal,
      knownDimensions: knownDisplayMeta,
      onImageLayout: onImageLoad,
      onStageChange: onMainImageLoadStageChange,
    });

    const { onMainImgDecoded } = progressive;

    // Retained layer already decoded → reveal ASAP (underlay still covers until fullDecoded).
    useLayoutEffect(() => {
      const el = layerElBySrcRef.current.get(currentImage.src);
      if (!el || !el.complete || el.naturalWidth <= 0) return;
      setPaceMainPainted(true);
      onImageLoad({ naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight });
      if (preferFastReveal) {
        onMainImgDecoded();
      } else {
        scheduleRevealAfterDecode(el, onMainImgDecoded, IMAGE_DECODE_TIMEOUT_MS);
      }
    }, [currentImage.src, onImageLoad, onMainImgDecoded, preferFastReveal]);

    const bindLayerRef = useCallback(
      (src: string, isCurrent: boolean) => (el: HTMLImageElement | null) => {
        if (el) layerElBySrcRef.current.set(src, el);
        else layerElBySrcRef.current.delete(src);
        if (isCurrent && el && el.complete && el.naturalWidth > 0) {
          setPaceMainPainted(true);
          onImageLoad({ naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight });
          if (preferFastReveal) onMainImgDecoded();
          else scheduleRevealAfterDecode(el, onMainImgDecoded, IMAGE_DECODE_TIMEOUT_MS);
        }
      },
      [onImageLoad, onMainImgDecoded, preferFastReveal],
    );

    const onCurrentLayerLoad = useCallback(
      (img: HTMLImageElement) => {
        setPaceMainPainted(true);
        onImageLoad({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
        if (preferFastReveal) onMainImgDecoded();
        else scheduleRevealAfterDecode(img, onMainImgDecoded, IMAGE_DECODE_TIMEOUT_MS);
      },
      [onImageLoad, onMainImgDecoded, preferFastReveal],
    );

    // ── Group info ──────────────────────────────────────────────────────────
    const groupInfo = useMemo(() => findGroup(groupSlices, currentIndex), [groupSlices, currentIndex]);
    const currentGroup   = groupInfo?.group ?? null;
    const currentGroupIdx = groupInfo?.groupIdx ?? -1;

    // ── Navigation ──────────────────────────────────────────────────────────
    const goTo = useCallback(
      (idx: number) => {
        if (images.length === 0) return;
        const clamped = Math.max(0, Math.min(images.length - 1, idx));
        if (clamped === currentIndex) return;

        // Snapshot the leaving frame *before* resetPan/reset — otherwise outgoing hold
        // freezes the post-reset fit pose (or worse, races into 1×1 keep-alive).
        const leaving = images[currentIndex];
        const leavingSrc = leaving?.src;
        const leavingEl = leavingSrc ? layerElBySrcRef.current.get(leavingSrc) : undefined;
        const snap = lastPresentationRef.current;
        const dims =
          (snap && snap.src === leavingSrc ? snap.dims : null) ??
          imageDims ??
          (leavingEl && leavingEl.complete && leavingEl.naturalWidth > 0
            ? {
                naturalWidth: leavingEl.naturalWidth,
                naturalHeight: leavingEl.naturalHeight,
              }
            : null);
        const cssTransform =
          snap && snap.src === leavingSrc
            ? snap.cssTransform
            : transform.cssTransform;
        if (leavingSrc && dims) {
          presentationCaptureLockRef.current = true;
          lastPresentationRef.current = {
            src: leavingSrc,
            dims: { ...dims },
            cssTransform,
          };
          freezePresentation(leavingSrc, dims, cssTransform);
          outgoingSrcRef.current = leavingSrc;
          outgoingDimsRef.current = dims;
          outgoingIndexRef.current = currentIndex;
          setOutgoingSrc(leavingSrc);
          setOutgoingIndex(currentIndex);
          setOutgoingDims(dims);
        }

        if (!isIndexControlled) setCurrentIndex(clamped);
        setImageLoadError(false);
        onIndexChange?.(clamped);
        // Reset zoom only when not locked (and when switchImageResetZoom allows it).
        if (switchImageResetZoom && !zoomLocked) reset();
        resetPan();
        if (switchImageResetTransform) resetOrientation();
      },
      [
        images,
        currentIndex,
        imageDims,
        transform.cssTransform,
        freezePresentation,
        isIndexControlled,
        onIndexChange,
        reset,
        resetPan,
        resetOrientation,
        switchImageResetZoom,
        switchImageResetTransform,
        zoomLocked,
      ],
    );

    // Flat prev / next across the full list (crosses group boundaries).
    // Group jumps remain PageUp/PageDown + toolbar ⏮/⏭.
    const prev = useCallback(() => {
      if (currentIndex > 0) goTo(currentIndex - 1);
    }, [currentIndex, goTo]);

    const next = useCallback(() => {
      if (currentIndex < images.length - 1) goTo(currentIndex + 1);
    }, [currentIndex, images.length, goTo]);

    // Jump to first image of previous / next group
    const prevGroup = useCallback(() => {
      if (groupSlices && currentGroupIdx > 0) goTo(groupSlices[currentGroupIdx - 1].start);
    }, [groupSlices, currentGroupIdx, goTo]);

    const nextGroup = useCallback(() => {
      if (groupSlices && currentGroupIdx < groupSlices.length - 1) goTo(groupSlices[currentGroupIdx + 1].start);
    }, [groupSlices, currentGroupIdx, goTo]);

    // Keep currentIndex in range when the host removes images (e.g. after onDeleteImage).
    useEffect(() => {
      if (images.length === 0) return;
      if (currentIndex > images.length - 1) {
        const nextIdx = images.length - 1;
        if (!isIndexControlled) setCurrentIndex(nextIdx);
        onIndexChange?.(nextIdx);
      }
    }, [images.length, currentIndex, onIndexChange, isIndexControlled]);

    const { status: neighborByteStatus, markSrcReady } = useNeighborPreload({
      images,
      currentIndex,
      radius: preloadRadius,
      settleMs: preloadDisplaySettleMs,
      onPreloadIndexesChange,
    });

    const neighborPreloadStatus = useMemo(
      () =>
        mergeByteAndDisplayStatus(
          neighborByteStatus,
          displayReadyIndexes,
        ) as NeighborPreloadStatusMap,
      [neighborByteStatus, displayReadyIndexes],
    );

    useEffect(() => {
      onPreloadStatusChange?.(neighborPreloadStatus);
    }, [neighborPreloadStatus, onPreloadStatusChange]);

    const deleteCurrentImage = useCallback(() => {
      const item = images[currentIndex];
      if (!item) return;

      const willBeEmpty = images.length <= 1;
      const nextIdx = willBeEmpty
        ? null
        : currentIndex < images.length - 1
          ? currentIndex
          : currentIndex - 1;

      onDeleteImage?.(currentIndex, item);

      if (willBeEmpty) {
        onClose?.();
        return;
      }

      // Deleting the last item: move focus back before/while the host updates props.
      if (nextIdx != null && nextIdx !== currentIndex) {
        goTo(nextIdx);
      }
    }, [images, currentIndex, onDeleteImage, onClose, goTo]);

    const keyboardPanStepPx = useMemo(() => {
      if (!containerSize) return 0;
      return Math.min(containerSize.width, containerSize.height) * KEYBOARD_PAN_STEP_VIEWPORT_FRACTION;
    }, [containerSize]);

    // ── Auto-fade overlay controls (inactivity-based) ───────────────────────
    // After 3 s of no mouse movement, clicks, or key presses, all controls
    // fade to a ghost opacity (10%) over 1.6 s. Any activity instantly
    // restores them (0.12 s).  Applies to: arrows, close button, toolbar,
    // filename badge.
    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetHideTimer = useCallback(() => {
      // Do not call notifyInteraction here — that paused neighbor display-ready warm-up on
      // every mouse/key activity and never re-armed (panIdle stuck false → perpetual cold nav).
      setControlsVisible(true);
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }, []);

    // Kick off the timer on mount; clean up on unmount.
    useEffect(() => {
      resetHideTimer();
      return () => {
        if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
      };
    }, [resetHideTimer]);

    // ── Wheel zoom ───────────────────────────────────────────────────────────
    useWheelZoom({
      containerRef: overlayRef,
      enabled: wheelEnabled,
      mode,
      currentScale: transform.scale,
      fitEquivalentNativePercent,
      zoomIn,
      zoomOut,
      peekZoomIn,
      peekZoomOut,
      zoomAnchorTranslate,
    });

    // ── Pinch-to-zoom (touch / multi-touch trackpad) ─────────────────────────
    usePinchZoom({
      containerRef: overlayRef,
      enabled: pinchEnabled,
      mode,
      currentScale: transform.scale,
      stops: sortedStops,
      fitEquivalentNativePercent,
      fit,
      setNative,
      zoomAnchorTranslate,
    });

    const [keyboardActive, setKeyboardActive] = useState(!isContained);
    const [isFs, setIsFs] = useState(false);

    const syncFullscreenState = useCallback(() => {
      const root = overlayRef.current;
      setIsFs(!!root && document.fullscreenElement === root);
    }, []);

    useEffect(() => {
      document.addEventListener('fullscreenchange', syncFullscreenState);
      return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
    }, [syncFullscreenState]);

    const isFullscreen = useCallback(() => {
      const root = overlayRef.current;
      return !!root && document.fullscreenElement === root;
    }, []);

    const requestFullscreen = useCallback(async (): Promise<boolean> => {
      const root = overlayRef.current;
      if (!root || typeof root.requestFullscreen !== 'function') return false;
      try {
        await root.requestFullscreen();
        syncFullscreenState();
        return true;
      } catch {
        return false;
      }
    }, [syncFullscreenState]);

    const exitFullscreen = useCallback(async (): Promise<void> => {
      if (!document.fullscreenElement || typeof document.exitFullscreen !== 'function') return;
      try {
        await document.exitFullscreen();
      } catch {
        /* quiet degrade */
      }
      syncFullscreenState();
    }, [syncFullscreenState]);

    const toggleFullscreen = useCallback(() => {
      if (isFullscreen()) void exitFullscreen();
      else void requestFullscreen();
    }, [isFullscreen, exitFullscreen, requestFullscreen]);

    const navArrowPointerRef = useRef(false);

    // Cached underlay may complete before React attaches onLoad — sync from the DOM node.
    useLayoutEffect(() => {
      if (!progressive.showMinimapUnderlay || !currentImage.minimapSrc) return;
      const el = underlayElRef.current;
      if (el && el.complete && el.naturalWidth > 0) {
        setPaceUnderlayPainted(true);
      }
    }, [
      currentImage.src,
      currentImage.minimapSrc,
      progressive.showMinimapUnderlay,
      currentIndex,
    ]);

    const getHoldUnderlayEl = useCallback(() => underlayElRef.current, []);
    const getHoldMainEl = useCallback(
      () => layerElBySrcRef.current.get(currentImage.src) ?? null,
      [currentImage.src],
    );

    const thumbReadyForPace = useHoldStagePresented({
      visitKey: `${currentIndex}:${currentImage.src}`,
      imageLoadError:
        imageLoadError || progressive.preloadStage === 'error',
      imageShowReady,
      // Outgoing hold covers the stage — do not treat incoming underlay as "presented".
      showMinimapUnderlay: progressive.showMinimapUnderlay && !holdSrc,
      underlayPainted: paceUnderlayPainted,
      pipelineActive: progressive.pipelineActive,
      fullDecoded: progressive.fullDecoded,
      thumbOnly: progressive.preloadStage === 'thumb-only',
      mainPainted: paceMainPainted,
      getUnderlayEl: getHoldUnderlayEl,
      getMainEl: getHoldMainEl,
    });

    const { beginHold: beginNavHold, endHold: endNavHold } = useThumbPacedNavigation({
      currentIndex,
      thumbReady: thumbReadyForPace,
      prev,
      next,
      minVisibleMs: holdMinVisibleMs,
    });

    useImagePreviewKeyboard({
      resetHideTimer,
      onClose,
      zoomIn,
      zoomOut,
      fit,
      setNative,
      mode,
      prev,
      next,
      prevGroup,
      nextGroup,
      rotateCW,
      rotateCCW,
      panByDelta,
      keyboardPanStepPx,
      fitEquivalentNativePercent,
      onDeleteImage: showDelete ? deleteCurrentImage : undefined,
      keyboardActive: isContained ? keyboardActive : true,
      isFullscreen,
      exitFullscreen,
      beginNavHold,
      endNavHold,
    });

    // ── Double-click ────────────────────────────────────────────────────────
    const handleDoubleClick = useCallback(() => {
      if (!doubleClickEnabled) return;
      if (mode === 'fit') setNative(100);
      else fit();
    }, [doubleClickEnabled, mode, fit, setNative]);

    // ── Focus ───────────────────────────────────────────────────────────────
    // Overlay: focus on mount (modal). Contained: do not steal focus; activate keys when focused.
    useEffect(() => {
      if (isContained) return;
      overlayRef.current?.focus();
    }, [isContained]);

    useEffect(() => {
      if (!isContained) {
        setKeyboardActive(true);
        return;
      }
      const root = overlayRef.current;
      if (!root) return;
      const onFocusIn = () => setKeyboardActive(true);
      const onFocusOut = (e: FocusEvent) => {
        const next = e.relatedTarget as Node | null;
        if (next && root.contains(next)) return;
        setKeyboardActive(false);
      };
      root.addEventListener('focusin', onFocusIn);
      root.addEventListener('focusout', onFocusOut);
      setKeyboardActive(root.contains(document.activeElement));
      return () => {
        root.removeEventListener('focusin', onFocusIn);
        root.removeEventListener('focusout', onFocusOut);
      };
    }, [isContained]);

    // ── Imperative ref ──────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      zoomIn: () => zoomIn(fitEquivalentNativePercent),
      zoomOut: () => zoomOut(fitEquivalentNativePercent),
      fit,
      setNative,
      rotateCW,
      rotateCCW,
      flipHorizontal,
      flipVertical,
      next,
      prev,
      nextGroup,
      prevGroup,
      goTo,
      requestFullscreen,
      exitFullscreen,
      isFullscreen,
      getState: () => zoomState.getState(fitEquivalentNativePercent),
    }), [
      zoomIn, zoomOut, fit, setNative, rotateCW, rotateCCW, flipHorizontal, flipVertical,
      next, prev, nextGroup, prevGroup, goTo, requestFullscreen, exitFullscreen, isFullscreen,
      zoomState, fitEquivalentNativePercent,
    ]);

    // ── Derived ─────────────────────────────────────────────────────────────
    const atMinStop = mode === 'native' && nativePercent <= sortedStops[0];
    const atMaxStop = mode === 'native' && nativePercent >= sortedStops[sortedStops.length - 1];
    const ready =
      imageDims !== null &&
      containerSize !== null &&
      containerSize.width > 1 &&
      containerSize.height > 1;

    // ── Prevent the "shrink on first load" animation bug ─────────────────────
    // When ready flips from false→true, keep opacity 0 for one frame so transform
    // settles at fit (never animate 100%→fit). Across navigations with an outgoing
    // hold, keep the stage visible and only suppress transform easing.
    useEffect(() => {
      if (!ready) {
        setImageShowReady(false);
        return;
      }
      // Layout may have already armed outgoingSrcRef for this src change.
      if (outgoingSrcRef.current) {
        setImageShowReady(true);
        setSuppressTransformForSrcSwitch(true);
        // Keep easing off for the whole outgoing hold (promote keep-alive→full must be instant).
        return;
      }
      setSuppressTransformForSrcSwitch(true);
      setImageShowReady(false);
      let id2 = 0;
      const id1 = requestAnimationFrame(() => {
        setImageShowReady(true);
        id2 = requestAnimationFrame(() => setSuppressTransformForSrcSwitch(false));
      });
      return () => {
        cancelAnimationFrame(id1);
        if (id2) cancelAnimationFrame(id2);
      };
      // Intentionally omit `outgoingSrc`: clearing the hold must not blank the stage.
    }, [ready, currentImage.src]);

    const hideMainUntilDecoded =
      progressive.pipelineActive &&
      !progressive.fullDecoded &&
      progressive.preloadStage !== 'thumb-only';

    // Drop outgoing as soon as the incoming layer can own the stage.
    // Display-ready: do not wait for progressive fullDecoded / createImageBitmap — that gap
    // was ~0.2–0.3s with the previous frame still visible after N+1 had already sized up.
    useLayoutEffect(() => {
      if (!outgoingSrc) return;
      if (!imageDims || imageDims.naturalWidth <= 0) return;
      const el = layerElBySrcRef.current.get(currentImage.src);
      const incomingOk = !!(el && el.complete && el.naturalWidth > 0);
      if (!incomingOk && !paceMainPainted) return;

      if (preferFastReveal) {
        // Retained decoded DOM — flip progressive + drop hold in this layout pass.
        // Do not wait on imageShowReady / hideMainUntilDecoded (those added the visible lag).
        onMainImgDecoded();
      } else {
        if (!imageShowReady) return;
        if (hideMainUntilDecoded) return;
      }

      if (outgoingSrcRef.current !== outgoingSrc) return;
      outgoingSrcRef.current = null;
      outgoingDimsRef.current = null;
      outgoingIndexRef.current = -1;
      setOutgoingSrc(null);
      setOutgoingIndex(-1);
      setOutgoingDims(null);
      setSuppressTransformForSrcSwitch(true);
      const id = requestAnimationFrame(() => setSuppressTransformForSrcSwitch(false));
      revealSuppressRafRef.current = id;
      return () => {
        if (revealSuppressRafRef.current != null) {
          cancelAnimationFrame(revealSuppressRafRef.current);
          revealSuppressRafRef.current = null;
        }
      };
    }, [
      outgoingSrc,
      hideMainUntilDecoded,
      imageShowReady,
      imageDims,
      currentImage.src,
      paceMainPainted,
      progressive.fullDecoded,
      preferFastReveal,
      onMainImgDecoded,
    ]);

    // Current main image counts as ready once the full src is usable.
    useEffect(() => {
      const src = currentImage?.src;
      if (!src) return;
      if (progressive.pipelineActive) {
        if (progressive.fullDecoded) {
          markSrcReady(src);
          if (imageDims) {
            markSrcDisplayReady(src, {
              naturalWidth: imageDims.naturalWidth,
              naturalHeight: imageDims.naturalHeight,
            });
          } else {
            markSrcDisplayReady(src);
          }
        }
        return;
      }
      if (imageShowReady) {
        markSrcReady(src);
        if (imageDims) {
          markSrcDisplayReady(src, {
            naturalWidth: imageDims.naturalWidth,
            naturalHeight: imageDims.naturalHeight,
          });
        } else {
          markSrcDisplayReady(src);
        }
      }
    }, [
      currentImage?.src,
      progressive.pipelineActive,
      progressive.fullDecoded,
      imageShowReady,
      imageDims,
      markSrcReady,
      markSrcDisplayReady,
    ]);

    // ── Loading indicator ────────────────────────────────────────────────────
    // Only show the spinner if loading takes longer than LOADER_DELAY_MS.
    // This avoids a distracting flash for fast-loading images (e.g. local
    // files in a VSCode webview) while still signalling progress for large
    // images that take several hundred milliseconds or more.
    const LOADER_DELAY_MS = 300;
    const [showLoader, setShowLoader] = useState(false);
    useEffect(() => {
      if (imageShowReady) { setShowLoader(false); return; }
      const id = setTimeout(() => setShowLoader(true), LOADER_DELAY_MS);
      return () => clearTimeout(id);
    }, [imageShowReady]);

    const [delayedPreloadSpinner, setDelayedPreloadSpinner] = useState(false);
    useEffect(() => {
      if (!progressive.pipelineActive || progressive.preloadStage !== 'preloading') {
        setDelayedPreloadSpinner(false);
        return;
      }
      const id = setTimeout(() => setDelayedPreloadSpinner(true), LOADER_DELAY_MS);
      return () => clearTimeout(id);
    }, [progressive.pipelineActive, progressive.preloadStage]);

    /** Minimap bitmap is on screen while main is still decoding — no empty black viewport. */
    const thumbHoldingMainArea =
      progressive.pipelineActive &&
      progressive.showMinimapUnderlay &&
      !progressive.fullDecoded;

    /** Same window as thumb-on-main / image switch: no `transform` easing (avoids shrink/zoom pop). */
    const outgoingHolding = !!holdSrc && holdSrc !== currentImage.src;
    const suppressTransformTransition =
      thumbHoldingMainArea || suppressTransformForSrcSwitch || outgoingHolding;

    /**
     * Waiting for the *current* main to be the visible sharp frame.
     * Outgoing hold and progressive “hide until decoded” both count — prefer-fast-reveal
     * must not hide the L4 spinner during that gap (users otherwise see a stuck previous
     * frame with no feedback).
     */
    const awaitingMainReveal = outgoingHolding || hideMainUntilDecoded;

    /** Progressive: spinner over thumb underlay when not already covered by awaitingMainReveal. */
    const progressiveWaitingFullOverThumb =
      !awaitingMainReveal &&
      progressive.pipelineActive &&
      progressive.showMinimapUnderlay &&
      !progressive.fullDecoded;

    const progressivePreloadSpinnerNoThumbYet =
      !awaitingMainReveal &&
      progressive.pipelineActive &&
      !progressive.showMinimapUnderlay &&
      progressive.preloadStage === 'preloading' &&
      delayedPreloadSpinner;

    const showCenterLoader =
      showSwitchLoader &&
      (awaitingMainReveal ||
        progressiveWaitingFullOverThumb ||
        progressivePreloadSpinnerNoThumbYet ||
        (!progressive.pipelineActive && showLoader) ||
        (progressive.pipelineActive && progressive.preloadStage === 'error' && showLoader));

    const opacityTransition =
      progressive.pipelineActive && progressiveFadeMs > 0
        ? `opacity ${progressiveFadeMs}ms ease`
        : 'none';

    // Group-aware toolbar props
    const groupToolbarProps =
      currentGroup && groupSlices
        ? {
            groupCurrentIndex: currentIndex - currentGroup.start + 1,
            groupTotal:        currentGroup.end - currentGroup.start + 1,
            hasPrevGroup:      currentGroupIdx > 0,
            hasNextGroup:      currentGroupIdx < groupSlices.length - 1,
            groupName:         currentGroup.name,
            groupOrdinal:      currentGroupIdx + 1,
            groupCount:        groupSlices.length,
            onPrevGroup:       prevGroup,
            onNextGroup:       nextGroup,
          }
        : {};

    const showStrip = showThumbnails;
    const stripStart =
      thumbnailsScope === 'flat' ? 0 : (currentGroup?.start ?? 0);
    const stripEnd =
      thumbnailsScope === 'flat'
        ? images.length - 1
        : (currentGroup?.end ?? images.length - 1);
    const stripEntries = useMemo(() => {
      if (!showStrip || images.length <= 1) return [];
      if (stripEnd - stripStart < 1) return [];
      const out: { flatIndex: number; item: (typeof images)[number] }[] = [];
      for (let i = stripStart; i <= stripEnd; i++) {
        out.push({ flatIndex: i, item: images[i] });
      }
      return out;
    }, [showStrip, images, stripStart, stripEnd]);
    const stripLiftPx = thumbnailStripTotalHeightPx(stripEntries.length);

    return (
      <div
        ref={overlayRef}
        role={isContained ? 'region' : 'dialog'}
        aria-modal={isContained ? undefined : 'true'}
        aria-label={t.imagePreview}
        tabIndex={-1}
        className={overlayClassName}
        style={{
          position: isContained ? 'absolute' : 'fixed',
          inset: 0,
          zIndex: isContained ? 1 : 9999,
          /* macOS-style frosted glass: semi-transparent + blur */
          background: 'rgba(10, 12, 20, 0.70)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          ...overlayStyle,
        }}
        onClick={(e) => { if (closeOnMaskClick && e.target === e.currentTarget) onClose?.(); }}
        onMouseMove={resetHideTimer}
        onMouseDown={(e) => {
          resetHideTimer();
          if (isContained) {
            // Activate keyboard boundary when the user interacts with the preview.
            (e.currentTarget as HTMLDivElement).focus({ preventScroll: true });
          }
        }}
      >
        {/* Stage floors (bottom → top via DOM order; avoid ad-hoc z-index):
            L1 content → L2 hit → L3 chrome → L4 loading */}
        {/* NOTE: This div is 100 % × 100 % and covers the whole overlay, so mask
            clicks land here (not on the overlay root). We mirror the same check. */}
        <div
          ref={setContainerEl}
          onClick={(e) => { if (closeOnMaskClick && e.target === e.currentTarget) onClose?.(); }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* L1 — main + neighbor image layers (isolated so inner z-index cannot cover L4) */}
          <div
            data-rip-floor="content"
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}
          >
            {progressive.preloadStage !== 'thumb-only' && (
              <DisplayStageLayers
                layers={displayLayers}
                currentIndex={currentIndex}
                currentAlt={currentImage.alt ?? ''}
                liveDims={imageDims}
                liveTransform={transform.cssTransform}
                frozenBySrc={frozenBySrc}
                hideCurrentUntilDecoded={hideMainUntilDecoded}
                suppressTransformTransition={suppressTransformTransition}
                isPanning={isPanning || minimapDragging}
                imageShowReady={imageShowReady}
                forceCurrentAboveOutgoing={preferFastReveal && imageShowReady}
                bindLayerRef={bindLayerRef}
                onCurrentLoad={onCurrentLayerLoad}
                onCurrentError={() => {
                  onMainImgDecoded();
                  setImageLoadError(true);
                  onImageError?.(currentIndex, currentImage.src);
                }}
                onNeighborLoad={onSlotImgLoad}
                underlay={
                  progressive.showMinimapUnderlay && currentImage.minimapSrc ? (
                    <img
                      key={`${currentImage.minimapSrc}-${currentIndex}`}
                      ref={underlayElRef}
                      src={currentImage.minimapSrc}
                      alt=""
                      aria-hidden
                      draggable={false}
                      onLoad={() => setPaceUnderlayPainted(true)}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        display: 'block',
                        opacity: holdSrc
                          ? 0
                          : progressive.fullDecoded
                            ? 0
                            : 1,
                        transition: opacityTransition,
                        zIndex: progressive.fullDecoded ? 0 : 2,
                      }}
                    />
                  ) : null
                }
              />
            )}
          </div>

          {/* L2 — pan / zoom hit target (live transform lives on the current layer only) */}
          <div
            data-rip-floor="hit"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              cursor: mode === 'native' ? 'grab' : 'zoom-in',
              touchAction: 'none',
              userSelect: 'none',
            }}
            onPointerDown={onPanStart}
            onPointerMove={onPanMove}
            onPointerUp={(e) => onPanEnd(e)}
            onPointerCancel={(e) => onPanEnd(e)}
            onLostPointerCapture={(e) => onPanEnd(e)}
            onDoubleClick={handleDoubleClick}
          />

          {/* L3 — chrome: close, ←/→, toolbar/filename, minimap, filmstrip, EXIF */}
          <div
            data-rip-floor="chrome"
            style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
          >
            <ImagePreviewCloseButton
              onClick={() => onClose?.()}
              visible={controlsVisible}
              idleOpacity={idleOpacity}
              label={t.close}
              tip={t.tipClose}
            />

            {showMinimap && imageDims && containerSize && (
              <Minimap
                imageSrc={currentImage.minimapSrc ?? currentImage.src}
                thumbnail={currentImage.minimap}
                imageAlt={currentImage.alt ?? ''}
                nw={imageDims.naturalWidth}
                nh={imageDims.naturalHeight}
                cw={containerSize.width}
                ch={containerSize.height}
                scale={transform.scale}
                mode={mode}
                tx={transform.translateX}
                ty={transform.translateY}
                rotationDeg={transform.rotation}
                flipH={transform.flipH}
                flipV={transform.flipV}
                controlsVisible={controlsVisible}
                idleOpacity={minimapIdleOpacity}
                bottomPx={MINIMAP_BOTTOM + stripLiftPx}
                onPanByDelta={panByDelta}
                onJumpToNatural={panJumpToNatural}
                onUserActivity={resetHideTimer}
                onDragChange={setMinimapDragging}
                ariaLabel={t.minimapNav}
                minimapTooltip={t.tipMinimap}
              />
            )}

            {/* Flat ←/→ across the full list (including across groups). Hide at the
                absolute first / last image. Group jumps: toolbar ⏮/⏭ or PageUp/Down. */}
            {(() => {
              if (!showSideArrows) return null;
              const isAtStart = currentIndex === 0;
              const isAtEnd = currentIndex === images.length - 1;

              return (
                <>
                  {!isAtStart && (
                    <ImagePreviewNavArrow
                      direction="left"
                      onClick={() => {
                        if (navArrowPointerRef.current) {
                          navArrowPointerRef.current = false;
                          return;
                        }
                        beginNavHold('prev');
                        endNavHold('prev');
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        navArrowPointerRef.current = true;
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        beginNavHold('prev');
                      }}
                      onPointerUp={() => endNavHold('prev')}
                      onPointerCancel={() => endNavHold('prev')}
                      label={t.prev}
                      tip={t.tipPrev}
                      visible={controlsVisible}
                      idleOpacity={idleOpacity}
                    />
                  )}
                  {!isAtEnd && (
                    <ImagePreviewNavArrow
                      direction="right"
                      onClick={() => {
                        if (navArrowPointerRef.current) {
                          navArrowPointerRef.current = false;
                          return;
                        }
                        beginNavHold('next');
                        endNavHold('next');
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        navArrowPointerRef.current = true;
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        beginNavHold('next');
                      }}
                      onPointerUp={() => endNavHold('next')}
                      onPointerCancel={() => endNavHold('next')}
                      label={t.next}
                      tip={t.tipNext}
                      visible={controlsVisible}
                      idleOpacity={idleOpacity}
                    />
                  )}
                </>
              );
            })()}

            {stripEntries.length > 0 && (
              <ThumbnailsStrip
                entries={stripEntries}
                activeFlatIndex={currentIndex}
                controlsVisible={controlsVisible}
                idleOpacity={idleOpacity}
                preloadStatus={showThumbnailPreloadStatus ? neighborPreloadStatus : undefined}
                ariaLabel={t.thumbnailsNav}
                thumbAria={t.thumbStripItem}
                onSelect={goTo}
                onUserActivity={resetHideTimer}
              />
            )}

            {showExif && exifOpen && (
              <ExifInfoPanel
                exif={currentImage.exif}
                strings={t}
                onUserActivity={resetHideTimer}
              />
            )}

            <Toolbar
              controlsVisible={controlsVisible}
              idleOpacity={idleOpacity}
              bottomPx={stripLiftPx + THUMBNAIL_STRIP_TOOLBAR_GAP_PX}
              mode={mode}
              nativePercent={nativePercent}
              fitEquivalentNativePercent={fitEquivalentNativePercent}
              stops={sortedStops}
              atMinStop={atMinStop}
              atMaxStop={atMaxStop}
              totalImages={images.length}
              currentIndex={currentIndex}
              imageName={currentImage.name}
              showFlip={showFlip}
              showExif={showExif}
              exifOpen={exifOpen}
              showDelete={showDelete}
              showFullscreen
              isFullscreen={isFs}
              toolbarExtra={toolbarExtra}
              showToolbarArrows={showToolbarArrows}
              zoomLocked={zoomLocked}
              strings={t}
              zoomLabelSlotPx={zoomLabelSlotPx}
              zoomDropdownWidthPx={zoomDropdownWidthPx}
              onToggleLock={() => setZoomLocked((v) => !v)}
              onToggleExif={() => setExifOpen((v) => !v)}
              onDeleteImage={deleteCurrentImage}
              onToggleFullscreen={toggleFullscreen}
              onZoomIn={() => zoomIn(fitEquivalentNativePercent)}
              onZoomOut={() => zoomOut(fitEquivalentNativePercent)}
              onFit={fit}
              onOneToOne={() => setNative(100)}
              onSetNative={setNative}
              onRotateCW={rotateCW}
              onRotateCCW={rotateCCW}
              onFlipH={flipHorizontal}
              onFlipV={flipVertical}
              onPrev={prev}
              onNext={next}
              {...groupToolbarProps}
            />
          </div>

          {/* L4 — loading / error (always topmost) */}
          <div
            data-rip-floor="loading"
            data-rip-loader={showCenterLoader ? 'on' : 'off'}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
          >
            <div
              aria-label={t.loadingImage}
              aria-live="polite"
              aria-hidden={!showCenterLoader}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                visibility: showCenterLoader ? 'visible' : 'hidden',
                opacity: showCenterLoader ? 1 : 0,
                /* No fade — appear/disappear in lockstep with outgoing hold / reveal. */
                transition: 'none',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '3px solid rgba(96, 165, 250, 0.28)',
                  borderTopColor: 'rgba(147, 197, 253, 0.95)',
                  animation: '_rip_spin 0.75s linear infinite',
                }}
              />
            </div>

            {imageLoadError && errorFallback && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {errorFallback(currentIndex, currentImage.src)}
              </div>
            )}
          </div>

          {/* Above all floors — local pack only (file: / pack:local). */}
          {isLocalPackBuild ? (
            <div
              data-rip-local-pack-badge=""
              aria-hidden
              title="right-image-preview local pack build time"
              style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                pointerEvents: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 11,
                lineHeight: 1.3,
                fontWeight: 500,
                letterSpacing: '0.02em',
                color: 'rgba(255, 220, 220, 0.9)',
                background: 'rgba(140, 36, 36, 0.42)',
                padding: '3px 8px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              {`local v${PACKAGE_VERSION} · ${LOCAL_PACK_BUILD_AT}`}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);
