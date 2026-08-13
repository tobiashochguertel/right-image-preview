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
import type { DisplayLayerEntry } from '../parts/DisplayStageLayers';
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
import { useNeighborDisplayPreload } from '../useNeighborDisplayPreload';
import { useNeighborPreload } from '../useNeighborPreload';
import { useProgressiveMainImage } from '../useProgressiveMainImage';
import { usePinchZoom } from '../usePinchZoom';
import { useWheelZoom } from '../useWheelZoom';
import { useZoomState } from '../useZoomState';

const DEFAULT_STOPS: NativePercent[] = [10, 25, 50, 75, 100, 150, 200];

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
      preloadRadius = 0,
      preloadDisplaySlots = 0,
      preloadDisplaySettleMs = PRELOAD_DISPLAY_SETTLE_MS,
      holdMinVisibleMs = NAV_HOLD_MIN_VISIBLE_MS,
      preloadMemoryBudgetBytes,
      estimateDecodedBytes,
      preloadDisplayMode = 'slot',
      onPreloadIndexesChange,
      onPreloadStatusChange,
      showThumbnailPreloadStatus = false,
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

    /**
     * Live stage `<img>` nodes by src. Sticky display-ready alone must not blank the underlay.
     */
    const layerElBySrcRef = useRef(new Map<string, HTMLImageElement>());

    /**
     * Keep progressive underlay whenever we have `minimapSrc` — never blank the stage.
     * Display-ready only skips artificial dwell.
     */
    const preferFastReveal = progressiveMain && isSrcDisplayReady(currentImage.src);
    const knownDisplayMeta = preferFastReveal ? getMeta(currentImage.src) ?? null : null;

    const displayLayers: DisplayLayerEntry[] = useMemo(() => {
      const bySrc = new Map<string, number>();
      for (const e of slotRenderEntries) bySrc.set(e.src, e.index);
      bySrc.set(currentImage.src, currentIndex);
      return [...bySrc.entries()].map(([src, index]) => ({
        src,
        index,
        isCurrent: src === currentImage.src,
      }));
    }, [slotRenderEntries, currentImage.src, currentIndex]);

    const prevSrcRef = useRef(currentImage.src);
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

    useLayoutEffect(() => {
      if (prevSrcRef.current === currentImage.src) return;
      prevSrcRef.current = currentImage.src;
      setSuppressTransformForSrcSwitch(true);
      // Always hide until the next rAF — keep dims from meta without leaving opacity:1
      // across visits (that made hold dwell start during the black flash).
      setImageShowReady(false);

      const el = layerElBySrcRef.current.get(currentImage.src);
      const meta = getMeta(currentImage.src);
      const paintable = !!(el && el.complete && el.naturalWidth > 0);
      if (paintable) {
        setPaceMainPainted(true);
        onImageLoad({
          naturalWidth: el!.naturalWidth,
          naturalHeight: el!.naturalHeight,
        });
      } else if (meta) {
        // Keep stage sized so minimap underlay can show (avoid opacity-0 black wrapper).
        onImageLoad(meta);
      } else {
        resetImageDims();
      }
    }, [currentImage.src, getMeta, onImageLoad, resetImageDims]);

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
      scheduleRevealAfterDecode(el, onMainImgDecoded, IMAGE_DECODE_TIMEOUT_MS);
    }, [currentImage.src, onImageLoad, onMainImgDecoded]);

    const bindLayerRef = useCallback(
      (src: string, isCurrent: boolean) => (el: HTMLImageElement | null) => {
        if (el) layerElBySrcRef.current.set(src, el);
        else layerElBySrcRef.current.delete(src);
        if (isCurrent && el && el.complete && el.naturalWidth > 0) {
          setPaceMainPainted(true);
          onImageLoad({ naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight });
          scheduleRevealAfterDecode(el, onMainImgDecoded, IMAGE_DECODE_TIMEOUT_MS);
        }
      },
      [onImageLoad, onMainImgDecoded],
    );

    const onCurrentLayerLoad = useCallback(
      (img: HTMLImageElement) => {
        setPaceMainPainted(true);
        onImageLoad({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
        scheduleRevealAfterDecode(img, onMainImgDecoded, IMAGE_DECODE_TIMEOUT_MS);
      },
      [onImageLoad, onMainImgDecoded],
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
        if (!isIndexControlled) setCurrentIndex(clamped);
        setImageLoadError(false);
        onIndexChange?.(clamped);
        // Reset zoom only when not locked (and when switchImageResetZoom allows it).
        if (switchImageResetZoom && !zoomLocked) reset();
        resetPan();
        if (switchImageResetTransform) resetOrientation();
      },
      [
        images.length,
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

    // Within-group (or global when flat) prev / next
    const prev = useCallback(() => {
      const boundary = currentGroup?.start ?? 0;
      if (currentIndex > boundary) goTo(currentIndex - 1);
    }, [currentIndex, currentGroup, goTo]);

    const next = useCallback(() => {
      const boundary = currentGroup?.end ?? images.length - 1;
      if (currentIndex < boundary) goTo(currentIndex + 1);
    }, [currentIndex, currentGroup, images.length, goTo]);

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
      showMinimapUnderlay: progressive.showMinimapUnderlay,
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
      currentIndex,
      currentGroup,
      currentGroupIdx,
      groupSlices,
      imagesLength: images.length,
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
    const ready     = imageDims !== null && containerSize !== null;

    // ── Prevent the "shrink on first load" animation bug ─────────────────────
    // When ready flips from false→true, the CSS transform has just jumped to the
    // correct fit-scale in the same render.  If we make the image visible in
    // that same render, the `transform` transition fires and produces a visible
    // "zoom-out" animation.  Instead we keep opacity:0 for one animation frame
    // (so the browser paints the correct transform while the image is still
    // invisible), then set imageShowReady→true so only the opacity transitions.
    // Key on `src` too: known dims keep `ready===true` across navigations; without
    // this, opacity stayed 1 through the black flash and hold dwell started early.
    useEffect(() => {
      if (!ready) {
        setImageShowReady(false);
        return;
      }
      setImageShowReady(false);
      const id = requestAnimationFrame(() => {
        setImageShowReady(true);
        setSuppressTransformForSrcSwitch(false);
      });
      return () => cancelAnimationFrame(id);
    }, [ready, currentImage.src]);

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
    const suppressTransformTransition =
      thumbHoldingMainArea || suppressTransformForSrcSwitch;

    /** Progressive: spinner stays on top of the thumbnail until the real main bitmap replaces it. */
    const progressiveWaitingFullOverThumb =
      progressive.pipelineActive && progressive.showMinimapUnderlay && !progressive.fullDecoded;

    const progressivePreloadSpinnerNoThumbYet =
      progressive.pipelineActive &&
      !progressive.showMinimapUnderlay &&
      progressive.preloadStage === 'preloading' &&
      delayedPreloadSpinner;

    const showCenterLoader =
      !preferFastReveal &&
      (progressiveWaitingFullOverThumb ||
        progressivePreloadSpinnerNoThumbYet ||
        (!progressive.pipelineActive && showLoader) ||
        (progressive.pipelineActive && progressive.preloadStage === 'error' && showLoader));

    const hideMainUntilDecoded =
      progressive.pipelineActive &&
      !progressive.fullDecoded &&
      progressive.preloadStage !== 'thumb-only';
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
            atGroupStart:      currentIndex === currentGroup.start,
            atGroupEnd:        currentIndex === currentGroup.end,
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
        {/* ── Close button — top-right corner ── */}
        <ImagePreviewCloseButton
          onClick={() => onClose?.()}
          visible={controlsVisible}
          idleOpacity={idleOpacity}
          label={t.close}
          tip={t.tipClose}
        />

        {/* ── Viewport ── */}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              width:     imageDims ? imageDims.naturalWidth  : 'auto',
              height:    imageDims ? imageDims.naturalHeight : 'auto',
              maxWidth:  imageDims ? 'none' : '100%',
              maxHeight: imageDims ? 'none' : '100%',
              transform: transform.cssTransform,
              transformOrigin: 'center center',
              transition: isPanning || minimapDragging
                ? 'none'
                : !imageShowReady
                  ? 'opacity 0.15s ease'
                  : suppressTransformTransition
                    ? 'opacity 0.15s ease'
                    : 'transform 0.3s ease, opacity 0.15s ease',
              opacity: imageShowReady ? 1 : 0,
              cursor:     mode === 'native' ? 'grab' : 'zoom-in',
              willChange: 'transform',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onPointerDown={onPanStart}
            onPointerMove={onPanMove}
            onPointerUp={(e) => onPanEnd(e)}
            onPointerCancel={(e) => onPanEnd(e)}
            onLostPointerCapture={(e) => onPanEnd(e)}
            onDoubleClick={handleDoubleClick}
          >
            {progressive.showMinimapUnderlay &&
              currentImage.minimapSrc && (
                <img
                  key={`${currentImage.minimapSrc}-${currentIndex}`}
                  ref={underlayElRef}
                  src={currentImage.minimapSrc}
                  alt=""
                  aria-hidden
                  draggable={false}
                  onLoad={() => setPaceUnderlayPainted(true)}
                  style={{
                    position:      'absolute',
                    inset:         0,
                    width:         '100%',
                    height:        '100%',
                    objectFit:     'fill',
                    pointerEvents: 'none',
                    display:       'block',
                    opacity:
                      progressive.preloadStage === 'thumb-only'
                        ? 1
                        : progressive.fullDecoded
                          ? 0
                          : 1,
                    transition:    opacityTransition,
                    // Above keep-alive full-src layers (opacity ~0.02) so neighbors / covered
                    // current never ghost through the thumb placeholder.
                    zIndex: progressive.fullDecoded ? 0 : 2,
                  }}
                />
              )}
            {progressive.preloadStage !== 'thumb-only' && (
              <DisplayStageLayers
                layers={displayLayers}
                currentAlt={currentImage.alt ?? ''}
                imageDims={imageDims}
                hideCurrentUntilDecoded={hideMainUntilDecoded}
                opacityTransition={opacityTransition}
                bindLayerRef={bindLayerRef}
                onCurrentLoad={onCurrentLayerLoad}
                onCurrentError={() => {
                  onMainImgDecoded();
                  setImageLoadError(true);
                  onImageError?.(currentIndex, currentImage.src);
                }}
                onNeighborLoad={onSlotImgLoad}
              />
            )}
          </div>

          {/* ── Loading spinner ── */}
          <div
            aria-label={t.loadingImage}
            aria-live="polite"
            style={{
              position:      'absolute',
              inset:         0,
              zIndex:        1,
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              pointerEvents: 'none',
              opacity:       showCenterLoader ? 1 : 0,
              transition:    showCenterLoader ? 'none' : 'opacity 0.2s ease',
            }}
          >
            <div style={{
              width:         28,
              height:        28,
              borderRadius:  '50%',
              border:        '2.5px solid rgba(180, 200, 230, 0.12)',
              borderTopColor:'rgba(180, 200, 230, 0.55)',
              animation:     '_rip_spin 0.75s linear infinite',
            }} />
          </div>

          {/* ── Error fallback ── */}
          {imageLoadError && errorFallback && (
            <div
              style={{
                position:       'absolute',
                inset:          0,
                zIndex:         2,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                pointerEvents:  'none',
              }}
            >
              {errorFallback(currentIndex, currentImage.src)}
            </div>
          )}
        </div>

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

        {/* ── Side nav arrows ────────────────────────────────────────────────
             Rules:
             · Arrow only renders when navigation is possible — never grayed-out.
             · At a group boundary with an adjacent group: swap the arrow for a
               "jump to next/prev group" button (double-chevron icon).
             · Single group: hide when at the first / last image. ── */}
        {(() => {
          if (!showSideArrows) return null;
          const isAtStart = currentGroup
            ? currentIndex === currentGroup.start
            : currentIndex === 0;
          const isAtEnd = currentGroup
            ? currentIndex === currentGroup.end
            : currentIndex === images.length - 1;
          const hasPrevGroupNav = !!(currentGroup && currentGroupIdx > 0);
          const hasNextGroupNav = !!(currentGroup && groupSlices && currentGroupIdx < groupSlices.length - 1);

          const showLeft  = !isAtStart || hasPrevGroupNav;
          const showRight = !isAtEnd   || hasNextGroupNav;
          const leftIsGroup  = isAtStart && hasPrevGroupNav;
          const rightIsGroup = isAtEnd   && hasNextGroupNav;

          return (
            <>
              {showLeft && (
                <ImagePreviewNavArrow
                  direction="left"
                  isGroupJump={leftIsGroup}
                  onClick={
                    leftIsGroup
                      ? prevGroup
                      : () => {
                          if (navArrowPointerRef.current) {
                            navArrowPointerRef.current = false;
                            return;
                          }
                          beginNavHold('prev');
                          endNavHold('prev');
                        }
                  }
                  onPointerDown={
                    leftIsGroup
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          navArrowPointerRef.current = true;
                          e.currentTarget.setPointerCapture?.(e.pointerId);
                          beginNavHold('prev');
                        }
                  }
                  onPointerUp={leftIsGroup ? undefined : () => endNavHold('prev')}
                  onPointerCancel={leftIsGroup ? undefined : () => endNavHold('prev')}
                  label={leftIsGroup ? t.prevGroup : t.prev}
                  tip={leftIsGroup ? t.tipPrevGroup : t.tipPrev}
                  visible={controlsVisible}
                  idleOpacity={idleOpacity}
                />
              )}
              {showRight && (
                <ImagePreviewNavArrow
                  direction="right"
                  isGroupJump={rightIsGroup}
                  onClick={
                    rightIsGroup
                      ? nextGroup
                      : () => {
                          if (navArrowPointerRef.current) {
                            navArrowPointerRef.current = false;
                            return;
                          }
                          beginNavHold('next');
                          endNavHold('next');
                        }
                  }
                  onPointerDown={
                    rightIsGroup
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          navArrowPointerRef.current = true;
                          e.currentTarget.setPointerCapture?.(e.pointerId);
                          beginNavHold('next');
                        }
                  }
                  onPointerUp={rightIsGroup ? undefined : () => endNavHold('next')}
                  onPointerCancel={rightIsGroup ? undefined : () => endNavHold('next')}
                  label={rightIsGroup ? t.nextGroup : t.next}
                  tip={rightIsGroup ? t.tipNextGroup : t.tipNext}
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

        {/* Neighbor decode layers live in DisplayStageLayers (slot mode). decode-mode uses detached Image(). */}

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
    );
  },
);
