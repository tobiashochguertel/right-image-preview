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
import { ThumbnailsStrip } from '../parts/ThumbnailsStrip';
import { ImagePreviewNavArrow } from '../parts/ImagePreviewNavArrow';
import { Toolbar } from '../Toolbar';
import { MediaControllerSlot } from '../core/media-controller-slot';
import type {
  MediaController,
  MediaPresentationPhase,
  ViewerCommand,
} from '../core/media-contract';
import type { MediaSource } from '../core/media-source';
import { useDetectedMediaKind } from '../core/use-detected-media-kind';
import type { RasterPreloadSource } from '../renderers/raster-webgl/rasterPreloadPlan';
import type { RasterRuntimeSnapshot } from '../renderers/raster-webgl/RasterPipeline';
import { buildRasterPreloadPlan } from '../renderers/raster-webgl/rasterPreloadPlan';
import { MediaStage } from '../renderers/MediaStage';
import { mediaCapabilitiesForKind } from '../renderers/media-capabilities';
import {
  KEYBOARD_PAN_STEP_VIEWPORT_FRACTION,
  NAV_HOLD_REPEAT_DELAY_MS,
  NAV_HOLD_MIN_VISIBLE_MS,
  THUMBNAIL_STRIP_TOOLBAR_GAP_PX,
  thumbnailStripTotalHeightPx,
  toolbarZoomDropdownWidthPx,
  toolbarZoomLabelSlotPx,
} from '../imagePreviewTuning';
import { injectGlobalStyle } from '../injectGlobalStyle';
import { findGroup } from '../lib/imagePreviewFindGroup';
import { resolveMinimapMediaSource } from '../lib/imagePreviewData';
import {
  isLocalPackBuild,
  LOCAL_PACK_BUILD_AT,
  PACKAGE_VERSION,
} from '../lib/localPackBuildInfo';
import {
  resolveDefaultGroupedFlatIndex,
  resolvePreviewImages,
} from '../flattenGroupedImages';
import { mergeStrings, resolveStrings } from '../locale';
import type {
  ImagePreviewProps,
  ImagePreviewRef,
  NativePercent,
  NeighborPreloadEntry,
  NeighborPreloadStatusMap,
} from '../types';
import { useImagePreviewKeyboard } from '../useImagePreviewKeyboard';
import { useThumbPacedNavigation } from '../useThumbPacedNavigation';
import { resolveFitMaxScale, useImageTransform } from '../useImageTransform';
import { usePinchZoom } from '../usePinchZoom';
import { useWheelZoom } from '../useWheelZoom';
import { useZoomState } from '../useZoomState';

function sameNeighborPreloadEntry(
  left: NeighborPreloadEntry | undefined,
  right: NeighborPreloadEntry | undefined,
): boolean {
  return left === right || !!left && !!right &&
    left.phase === right.phase &&
    left.targetLod === right.targetLod &&
    left.progress === right.progress &&
    left.loadedBytes === right.loadedBytes &&
    left.totalBytes === right.totalBytes &&
    left.textureBytes === right.textureBytes &&
    left.textureWidth === right.textureWidth &&
    left.textureHeight === right.textureHeight;
}

function sameNeighborPreloadStatusMap(
  left: NeighborPreloadStatusMap,
  right: NeighborPreloadStatusMap,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && rightKeys.every((key) => {
    const index = Number(key);
    return sameNeighborPreloadEntry(left[index], right[index]);
  });
}

const DEFAULT_STOPS: NativePercent[] = [5, 10, 20, 35, 50, 75, 100, 125, 150, 175, 200];

injectGlobalStyle('rip-spin', '@keyframes _rip_spin{to{transform:rotate(360deg)}}');

/**
 * WebGL draws into a viewport-sized canvas, so DOM targets cannot distinguish the rendered
 * image from its black surround. Invert the image transform to test the real media rectangle.
 */
function isViewportPointInsideTransformedImage(
  x: number,
  y: number,
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
  translateX: number,
  translateY: number,
  rotation: number,
): boolean {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    scale <= 0
  ) {
    return false;
  }
  const dx = x - viewportWidth / 2 - translateX;
  const dy = y - viewportHeight / 2 - translateY;
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Inverse rotation. Flips do not alter the rectangular hit boundary.
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  return Math.abs(localX) <= naturalWidth * scale / 2 &&
    Math.abs(localY) <= naturalHeight * scale / 2;
}

// ── Inner dialog ───────────────────────────────────────────────────────────
export const ImagePreviewInner = forwardRef<ImagePreviewRef, ImagePreviewProps>(
  function ImagePreviewInner(props, ref) {
    const {
      stops = DEFAULT_STOPS,
      initialMode = 'fit',
      initialNativePercent,
      fitMaxNativePercent,
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
      fullscreen,
      onFullscreenError,
      onThumbnailVisibleIndexesChange,
      presentation = 'overlay',
      shiftArrowAction = 'pan',
      preloadRadius = 'auto',
      preloadMaxCount = 128,
      holdRepeatDelayMs = NAV_HOLD_REPEAT_DELAY_MS,
      holdMinVisibleMs = NAV_HOLD_MIN_VISIBLE_MS,
      fullResolutionSettleMs,
      rasterFullDecodeMaxBytes,
      preloadMemoryBudgetBytes,
      rasterDecodeWorkers,
      rasterDecodeWorkerMax,
      onPreloadIndexesChange,
      onPreloadStatusChange,
      onRasterPreloadPlanChange,
      onRasterRendererStateChange,
      showThumbnailPreloadStatus = false,
      showSwitchLoader = true,
      chrome = 'default',
      progressiveMain = true,
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
      // eslint-disable-next-line react-hooks/exhaustive-deps -- groupedImages, images, source/src/kind, alt, minimap*, exif
      [props.groupedImages, props.images, props.source, props.src, props.kind, props.mimeType, props.alt, props.minimapSource, props.minimapSrc, props.minimap, props.exif],
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
    const rasterPreviousIndexRef = useRef(currentIndex);
    const rasterDirectionRef = useRef<1 | -1>(1);
    const rasterPreloadDirection: 1 | -1 = currentIndex === rasterPreviousIndexRef.current
      ? rasterDirectionRef.current
      : currentIndex > rasterPreviousIndexRef.current ? 1 : -1;
    useLayoutEffect(() => {
      if (currentIndex !== rasterPreviousIndexRef.current) {
        rasterDirectionRef.current = currentIndex > rasterPreviousIndexRef.current ? 1 : -1;
        rasterPreviousIndexRef.current = currentIndex;
      }
    }, [currentIndex]);

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
    } = useImageTransform({
      mode,
      nativePercent,
      fitResetPan,
      fitMaxScale: resolveFitMaxScale(fitMaxNativePercent),
    });

    // Stable Shell → active-media command boundary. During Phase 2 the existing DOM
    // implementation is attached through this narrow controller; the WebGL/media
    // dispatcher will replace the attachment without changing Toolbar/ref/keyboard calls.
    const [mediaControllerSlot] = useState(() => new MediaControllerSlot());
    const mediaCapabilitiesRef = useRef(mediaCapabilitiesForKind('raster'));
    const phase2MediaController = useMemo<MediaController>(() => ({
      execute(command: ViewerCommand) {
        const capabilities = mediaCapabilitiesRef.current;
        switch (command.type) {
          case 'zoom-in':
            if (!capabilities.zoom) break;
            zoomIn(fitEquivalentNativePercent);
            break;
          case 'zoom-out':
            if (!capabilities.zoom) break;
            zoomOut(fitEquivalentNativePercent);
            break;
          case 'set-native':
            if (!capabilities.nativeZoom) break;
            setNative(command.percent);
            break;
          case 'fit':
            if (!capabilities.zoom) break;
            fit();
            break;
          case 'reset':
            reset();
            resetPan();
            resetOrientation();
            break;
          case 'pan-by':
            if (!capabilities.pan) break;
            panByDelta(command.dx, command.dy);
            break;
          case 'pan-to-natural':
            if (!capabilities.pan) break;
            panJumpToNatural(command.x, command.y);
            break;
          case 'rotate-cw':
            if (!capabilities.rotate) break;
            rotateCW();
            break;
          case 'rotate-ccw':
            if (!capabilities.rotate) break;
            rotateCCW();
            break;
          case 'flip-horizontal':
            if (!capabilities.flip) break;
            flipHorizontal();
            break;
          case 'flip-vertical':
            if (!capabilities.flip) break;
            flipVertical();
            break;
        }
      },
      getCapabilities: () => mediaCapabilitiesRef.current,
      getViewState: () => ({
        zoomMode: mode,
        zoomPercent: mode === 'fit' ? fitEquivalentNativePercent : nativePercent,
        fitEquivalentNativePercent,
        canZoomIn: !(mode === 'native' && nativePercent >= sortedStops[sortedStops.length - 1]),
        canZoomOut: mode !== 'fit',
        rotation: transform.rotation,
        flipH: transform.flipH,
        flipV: transform.flipV,
        isPanned: transform.translateX !== 0 || transform.translateY !== 0,
        minimapGeometry: imageDims && containerSize
          ? {
              naturalWidth: imageDims.naturalWidth,
              naturalHeight: imageDims.naturalHeight,
              viewportWidth: containerSize.width,
              viewportHeight: containerSize.height,
              scale: transform.scale,
              translateX: transform.translateX,
              translateY: transform.translateY,
              rotation: transform.rotation,
              flipH: transform.flipH,
              flipV: transform.flipV,
            }
          : undefined,
      }),
    }), [
      zoomIn,
      zoomOut,
      fit,
      setNative,
      reset,
      resetPan,
      resetOrientation,
      panByDelta,
      panJumpToNatural,
      rotateCW,
      rotateCCW,
      flipHorizontal,
      flipVertical,
      mode,
      nativePercent,
      sortedStops,
      fitEquivalentNativePercent,
      transform,
      imageDims,
      containerSize,
    ]);

    useLayoutEffect(
      () => mediaControllerSlot.attach(phase2MediaController),
      [mediaControllerSlot, phase2MediaController],
    );

    const executeMediaCommand = useCallback(
      (command: ViewerCommand) => {
        mediaControllerSlot.execute(command);
      },
      [mediaControllerSlot],
    );
    const commandZoomIn = useCallback(
      () => executeMediaCommand({ type: 'zoom-in' }),
      [executeMediaCommand],
    );
    const commandZoomOut = useCallback(
      () => executeMediaCommand({ type: 'zoom-out' }),
      [executeMediaCommand],
    );
    const commandFit = useCallback(
      () => executeMediaCommand({ type: 'fit' }),
      [executeMediaCommand],
    );
    const commandSetNative = useCallback(
      (percent: number) => executeMediaCommand({ type: 'set-native', percent }),
      [executeMediaCommand],
    );
    const commandRotateCW = useCallback(
      () => executeMediaCommand({ type: 'rotate-cw' }),
      [executeMediaCommand],
    );
    const commandRotateCCW = useCallback(
      () => executeMediaCommand({ type: 'rotate-ccw' }),
      [executeMediaCommand],
    );
    const commandFlipHorizontal = useCallback(
      () => executeMediaCommand({ type: 'flip-horizontal' }),
      [executeMediaCommand],
    );
    const commandFlipVertical = useCallback(
      () => executeMediaCommand({ type: 'flip-vertical' }),
      [executeMediaCommand],
    );
    const commandPanByDelta = useCallback(
      (dx: number, dy: number) => executeMediaCommand({ type: 'pan-by', dx, dy }),
      [executeMediaCommand],
    );

    // ── Current image ───────────────────────────────────────────────────────
    const currentImage = images[currentIndex] ?? images[0];
    const rasterSource = useMemo<MediaSource>(
      () => currentImage.source ?? { type: 'url', href: currentImage.src },
      [currentImage.source, currentImage.src],
    );
    const sourceHref = rasterSource.type === 'url' ? rasterSource.href : currentImage.src;
    const detectedMediaKind = useDetectedMediaKind({
      source: rasterSource,
      kind: currentImage.kind,
      mimeType: currentImage.mimeType,
      href: sourceHref,
      fileName: currentImage.name,
    });
    const currentMediaKind = detectedMediaKind.kind;
    const currentMediaCapabilities = mediaCapabilitiesForKind(currentMediaKind);
    useLayoutEffect(() => {
      mediaCapabilitiesRef.current = currentMediaCapabilities;
    }, [currentMediaCapabilities]);
    const rasterPreviewSource = useMemo<MediaSource | undefined>(
      () => progressiveMain
        ? currentImage.minimapSource ?? (currentImage.minimapSrc
            ? { type: 'url', href: currentImage.minimapSrc }
            : undefined)
        : undefined,
      [currentImage.minimapSource, currentImage.minimapSrc, progressiveMain],
    );
    const [rasterKnownSizes, setRasterKnownSizes] = useState<Readonly<Record<string, {
      width: number;
      height: number;
    }>>>({});
    const rasterNeighborSources = useMemo<readonly RasterPreloadSource[]>(() => {
      if (preloadRadius === 0 || preloadMaxCount <= 0) return [];
      return buildRasterPreloadPlan({
        images,
        currentIndex,
        direction: rasterPreloadDirection,
        range: preloadRadius,
        maxCount: preloadMaxCount,
        allowPreviewSource: progressiveMain,
      }).map((item) => ({
        ...item,
        knownSize: item.knownSize ?? rasterKnownSizes[item.resourceKey],
      }));
    }, [
      preloadRadius,
      preloadMaxCount,
      currentIndex,
      images,
      rasterPreloadDirection,
      rasterKnownSizes,
      progressiveMain,
    ]);
    const rasterIndexByResourceKey = useMemo(() => {
      const index = new Map<string, number>();
      // 运行时只可能回报当前图和有界预热走廊。不要在打开 5000+ 项目录时
      // 为诊断状态同步扫描整表；历史项会在再次成为当前/候选时重新进入索引。
      index.set(currentImage.id ?? currentImage.src, currentIndex);
      rasterNeighborSources.forEach((item) => {
        if (item.flatIndex != null) index.set(item.resourceKey, item.flatIndex);
      });
      return index;
    }, [currentImage.id, currentImage.src, currentIndex, rasterNeighborSources]);
    const [gpuPreloadStatus, setGpuPreloadStatus] = useState<NeighborPreloadStatusMap>({});
    const onRasterPreloadStateChange = useCallback((
      item: RasterPreloadSource,
      phase: 'loading' | 'browse-ready' | 'display-ready' | 'evicted' | 'error',
      targetLod?: 'browse' | 'screen',
    ) => {
      if (item.flatIndex == null) return;
      setGpuPreloadStatus((previous) => {
        const nextEntry: NeighborPreloadEntry = phase === 'loading'
          ? { ...previous[item.flatIndex!], phase: 'loading', targetLod }
          : phase === 'display-ready'
            ? { ...previous[item.flatIndex!], phase: 'display-ready', progress: 1 }
            : phase === 'browse-ready'
              ? { ...previous[item.flatIndex!], phase: 'browse-ready', progress: 1 }
            : phase === 'evicted'
              ? { phase: 'warm', progress: 1 }
              : { phase: 'error', progress: 0 };
        if (sameNeighborPreloadEntry(previous[item.flatIndex!], nextEntry)) return previous;
        return { ...previous, [item.flatIndex!]: nextEntry };
      });
    }, []);
    const onRasterRuntimeStateChange = useCallback((snapshot: RasterRuntimeSnapshot) => {
      setRasterKnownSizes((previous) => {
        let changed = false;
        const next = { ...previous };
        snapshot.residentTextures.forEach((texture) => {
          const known = previous[texture.resourceKey];
          if (known?.width === texture.naturalWidth && known.height === texture.naturalHeight) return;
          next[texture.resourceKey] = {
            width: texture.naturalWidth,
            height: texture.naturalHeight,
          };
          changed = true;
        });
        return changed ? next : previous;
      });
      const texturesByResource = new Map<string, typeof snapshot.residentTextures>();
      snapshot.residentTextures.forEach((texture) => {
        texturesByResource.set(texture.resourceKey, [
          ...(texturesByResource.get(texture.resourceKey) ?? []),
          texture,
        ]);
      });
      setGpuPreloadStatus((previous) => {
        const next: Record<number, NeighborPreloadEntry> = {};
        texturesByResource.forEach((textures, resourceKey) => {
          const index = rasterIndexByResourceKey.get(resourceKey);
          if (index == null) return;
          const largest = textures.reduce<(typeof textures)[number] | undefined>(
            (best, texture) => !best || texture.bytes > best.bytes ? texture : best,
            undefined,
          );
          next[index] = {
            phase: textures.some((texture) =>
              texture.quality === 'display' || texture.quality === 'full')
              ? 'display-ready'
              : 'browse-ready',
            progress: 1,
            textureBytes: textures.reduce((sum, texture) => sum + texture.bytes, 0),
            textureWidth: largest?.width,
            textureHeight: largest?.height,
          };
        });
        Object.entries(snapshot.downloads).forEach(([resourceKey, download]) => {
          const index = rasterIndexByResourceKey.get(resourceKey);
          if (index == null || next[index]) return;
          if (download.complete) {
            const loadingTarget = previous[index]?.phase === 'loading'
              ? previous[index]?.targetLod
              : undefined;
            next[index] = {
              phase: loadingTarget ? 'loading' : 'warm',
              progress: 1,
              loadedBytes: download.loadedBytes,
              totalBytes: download.totalBytes,
              targetLod: loadingTarget,
            };
          } else {
            next[index] = {
              phase: 'loading',
              progress: download.progress,
              loadedBytes: download.loadedBytes,
              totalBytes: download.totalBytes,
              targetLod: previous[index]?.targetLod,
            };
          }
        });
        Object.entries(previous).forEach(([key, entry]) => {
          const index = Number(key);
          if (!next[index] && entry.phase === 'error') next[index] = entry;
        });
        return sameNeighborPreloadStatusMap(previous, next) ? previous : next;
      });
    }, [rasterIndexByResourceKey]);
    // Keep the current entry in the public/debug snapshot so hosts can sum true
    // cache bytes. ThumbnailsStrip independently suppresses the active tile bar.
    const rasterThumbnailStatus = gpuPreloadStatus;

    useEffect(() => {
      onPreloadIndexesChange?.(
        rasterNeighborSources
          .map((item) => item.flatIndex)
          .filter((index): index is number => index != null),
      );
    }, [onPreloadIndexesChange, rasterNeighborSources]);

    const [mediaPhase, setMediaPhase] = useState<MediaPresentationPhase>('idle');
    const currentPaceVisitKey = `${currentIndex}:${currentImage.id ?? currentImage.src}`;
    const [presentedPaceVisitKey, setPresentedPaceVisitKey] = useState<string | null>(null);

    // Cold open from gallery: seed layout from host EXIF before decode so the stage box
    // has a real aspect (avoids underlay-in-collapsed-box → tall thin strip).
    useLayoutEffect(() => {
      const w = Number(currentImage.exif?.width);
      const h = Number(currentImage.exif?.height);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 1 && h > 1) {
        onImageLoad({ naturalWidth: w, naturalHeight: h });
      }
    }, [currentImage.src, currentImage.exif?.width, currentImage.exif?.height, onImageLoad]);

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

    const neighborPreloadStatus = rasterThumbnailStatus;

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
    const [browserIsFullscreen, setBrowserIsFullscreen] = useState(false);
    const fullscreenActionInFlightRef = useRef(false);

    const browserFullscreenState = useCallback(() => {
      const root = overlayRef.current;
      return !!root && document.fullscreenElement === root;
    }, []);

    const syncBrowserFullscreenState = useCallback(() => {
      // During a component-initiated action, state is committed below only after both the
      // API promise and its matching `fullscreenchange` confirmation have succeeded.
      // Unrelated browser changes continue to synchronise normally.
      if (!fullscreenActionInFlightRef.current) {
        setBrowserIsFullscreen(browserFullscreenState());
      }
    }, [browserFullscreenState]);

    useEffect(() => {
      // A supplied adapter is the fullscreen state authority. In this mode, do not read
      // or subscribe to any browser Fullscreen API state.
      if (fullscreen) return;
      syncBrowserFullscreenState();
      document.addEventListener('fullscreenchange', syncBrowserFullscreenState);
      return () => document.removeEventListener('fullscreenchange', syncBrowserFullscreenState);
    }, [fullscreen, syncBrowserFullscreenState]);

    const waitForBrowserFullscreenChange = useCallback((expected: boolean) => {
      let cancel = () => {};
      const confirmation = new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (confirmed: boolean) => {
          if (settled) return;
          settled = true;
          document.removeEventListener('fullscreenchange', onFullscreenChange);
          window.clearTimeout(timeout);
          resolve(confirmed);
        };
        const onFullscreenChange = () => {
          const active = browserFullscreenState();
          finish(active === expected);
        };
        const timeout = window.setTimeout(() => finish(false), 500);
        cancel = () => finish(false);
        document.addEventListener('fullscreenchange', onFullscreenChange);
      });
      return { confirmation, cancel };
    }, [browserFullscreenState]);

    const isFullscreen = useCallback(() => {
      // Do not even read `document.fullscreenElement` while the host owns fullscreen.
      return fullscreen ? fullscreen.isFullscreen : browserFullscreenState();
    }, [fullscreen, browserFullscreenState]);

    const requestFullscreen = useCallback(async (): Promise<boolean> => {
      if (fullscreenActionInFlightRef.current) return false;
      fullscreenActionInFlightRef.current = true;

      if (fullscreen) {
        try {
          await fullscreen.enter();
          return true;
        } catch (error) {
          onFullscreenError?.(error);
          return false;
        } finally {
          fullscreenActionInFlightRef.current = false;
        }
      }

      const root = overlayRef.current;
      if (!root || typeof root.requestFullscreen !== 'function' ||
        typeof document.exitFullscreen !== 'function') {
        onFullscreenError?.(new Error('Browser Fullscreen API is not available for this preview.'));
        fullscreenActionInFlightRef.current = false;
        return false;
      }

      const { confirmation, cancel } = waitForBrowserFullscreenChange(true);
      try {
        await root.requestFullscreen();
        const confirmed = await confirmation;
        if (!confirmed) {
          onFullscreenError?.(new Error('Browser fullscreen state did not change after the request.'));
        } else {
          setBrowserIsFullscreen(true);
        }
        return confirmed;
      } catch (error) {
        cancel();
        onFullscreenError?.(error);
        return false;
      } finally {
        fullscreenActionInFlightRef.current = false;
      }
    }, [fullscreen, onFullscreenError, waitForBrowserFullscreenChange]);

    const exitFullscreen = useCallback(async (): Promise<void> => {
      if (fullscreenActionInFlightRef.current) return;
      fullscreenActionInFlightRef.current = true;

      if (fullscreen) {
        try {
          await fullscreen.exit();
        } catch (error) {
          onFullscreenError?.(error);
        } finally {
          fullscreenActionInFlightRef.current = false;
        }
        return;
      }

      if (!document.fullscreenElement) {
        fullscreenActionInFlightRef.current = false;
        return;
      }
      if (typeof document.exitFullscreen !== 'function') {
        onFullscreenError?.(new Error('Browser Fullscreen API cannot exit fullscreen.'));
        fullscreenActionInFlightRef.current = false;
        return;
      }

      const { confirmation, cancel } = waitForBrowserFullscreenChange(false);
      try {
        await document.exitFullscreen();
        const confirmed = await confirmation;
        if (!confirmed) {
          onFullscreenError?.(new Error('Browser fullscreen state did not change after the exit request.'));
        } else {
          setBrowserIsFullscreen(false);
        }
      } catch (error) {
        cancel();
        onFullscreenError?.(error);
      } finally {
        fullscreenActionInFlightRef.current = false;
      }
    }, [fullscreen, onFullscreenError, waitForBrowserFullscreenChange]);

    const toggleFullscreen = useCallback(() => {
      if (isFullscreen()) void exitFullscreen();
      else void requestFullscreen();
    }, [isFullscreen, exitFullscreen, requestFullscreen]);

    const navArrowPointerRef = useRef(false);

    const thumbReadyForPace = presentedPaceVisitKey === currentPaceVisitKey;

    const {
      beginHold: beginNavHold,
      endHold: endNavHold,
      holdingDirection,
    } = useThumbPacedNavigation({
      currentIndex,
      thumbReady: thumbReadyForPace,
      prev,
      next,
      repeatDelayMs: holdRepeatDelayMs,
      minVisibleMs: holdMinVisibleMs,
    });

    useImagePreviewKeyboard({
      resetHideTimer,
      onClose,
      zoomIn: commandZoomIn,
      zoomOut: commandZoomOut,
      fit: commandFit,
      setNative: commandSetNative,
      mode,
      prev,
      next,
      prevGroup,
      nextGroup,
      rotateCW: commandRotateCW,
      rotateCCW: commandRotateCCW,
      panByDelta: commandPanByDelta,
      keyboardPanStepPx,
      shiftArrowAction,
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
      if (mode === 'fit') commandSetNative(100);
      else commandFit();
    }, [doubleClickEnabled, mode, commandFit, commandSetNative]);

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
      zoomIn: commandZoomIn,
      zoomOut: commandZoomOut,
      fit: commandFit,
      setNative: commandSetNative,
      rotateCW: commandRotateCW,
      rotateCCW: commandRotateCCW,
      flipHorizontal: commandFlipHorizontal,
      flipVertical: commandFlipVertical,
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
      commandZoomIn, commandZoomOut, commandFit, commandSetNative,
      commandRotateCW, commandRotateCCW, commandFlipHorizontal, commandFlipVertical,
      next, prev, nextGroup, prevGroup, goTo, requestFullscreen, exitFullscreen, isFullscreen,
      zoomState, fitEquivalentNativePercent,
    ]);

    // ── Derived ─────────────────────────────────────────────────────────────
    const atMinStop = mode === 'native' && nativePercent <= sortedStops[0];
    const atMaxStop = mode === 'native' && nativePercent >= sortedStops[sortedStops.length - 1];
    // ── Loading indicator ────────────────────────────────────────────────────
    // Only show the spinner if loading takes longer than LOADER_DELAY_MS.
    // This avoids a distracting flash for fast-loading images (e.g. local
    // files in a VSCode webview) while still signalling progress for large
    // images that take several hundred milliseconds or more.
    const LOADER_DELAY_MS = 300;
    const mediaAwaitingDisplay =
      mediaPhase === 'loading' ||
      mediaPhase === 'preview-ready' ||
      mediaPhase === 'restoring';
    const [showMediaLoader, setShowMediaLoader] = useState(false);
    useEffect(() => {
      if (!mediaAwaitingDisplay) {
        setShowMediaLoader(false);
        return;
      }
      const id = setTimeout(() => setShowMediaLoader(true), LOADER_DELAY_MS);
      return () => clearTimeout(id);
    }, [mediaAwaitingDisplay]);

    const showCenterLoader = showSwitchLoader && showMediaLoader;

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
            <MediaStage
              resourceKey={currentImage.id ?? currentImage.src}
              currentFlatIndex={currentIndex}
              kind={currentMediaKind}
              kindPending={detectedMediaKind.pending}
              source={rasterSource}
              previewSource={rasterPreviewSource}
              preloadSources={rasterNeighborSources}
              rasterPreloadEnabled={preloadRadius !== 0 && preloadMaxCount > 0}
              rasterPreloadPaused={isPanning || minimapDragging}
              rasterFullResolutionPaused={holdingDirection != null}
              rasterFullResolutionSettleMs={fullResolutionSettleMs}
              rasterFullDecodeMaxBytes={rasterFullDecodeMaxBytes}
              textureBudgetBytes={preloadMemoryBudgetBytes}
              decodeWorkers={rasterDecodeWorkers}
              decodeWorkerMax={rasterDecodeWorkerMax}
              onPreloadStateChange={onRasterPreloadStateChange}
              onRasterRuntimeStateChange={onRasterRuntimeStateChange}
              onRasterRendererStateChange={onRasterRendererStateChange}
              onRasterPreloadPlanChange={onRasterPreloadPlanChange}
              alt={currentImage.alt ?? ''}
              label={currentImage.name ?? currentImage.src}
              transform={transform}
              knownSize={
                Number(currentImage.exif?.width) > 0 && Number(currentImage.exif?.height) > 0
                  ? {
                      width: Number(currentImage.exif?.width),
                      height: Number(currentImage.exif?.height),
                    }
                  : undefined
              }
              onDimensions={(width, height) => {
                onImageLoad({ naturalWidth: width, naturalHeight: height });
              }}
              onPhaseChange={(phase) => {
                setMediaPhase(phase);
                onMainImageLoadStageChange?.(
                  phase === 'idle'
                    ? 'inactive'
                    : phase === 'preview-ready'
                      ? 'thumbnail-placeholder'
                      : phase === 'display-ready'
                        ? 'full-ready'
                        : 'preloading',
                );
              }}
              onPresented={() => {
                setPresentedPaceVisitKey(currentPaceVisitKey);
              }}
              onError={() => {
                setImageLoadError(true);
                onMainImageLoadStageChange?.('error');
                onImageError?.(currentIndex, currentImage.src);
              }}
            />
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
            onClick={(e) => {
              if (!closeOnMaskClick) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const insideImage = imageDims && containerSize &&
                isViewportPointInsideTransformedImage(
                  e.clientX - rect.left,
                  e.clientY - rect.top,
                  imageDims.naturalWidth,
                  imageDims.naturalHeight,
                  containerSize.width,
                  containerSize.height,
                  transform.scale,
                  transform.translateX,
                  transform.translateY,
                  transform.rotation,
                );
              if (!insideImage) onClose?.();
            }}
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

            {showMinimap && currentMediaCapabilities.minimap && imageDims && containerSize && (
              <Minimap
                imageSrc={currentImage.minimapSrc ?? currentImage.src}
                imageSource={resolveMinimapMediaSource(currentImage)}
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
                onVisibleIndexesChange={onThumbnailVisibleIndexesChange}
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
              capabilities={currentMediaCapabilities}
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
              isFullscreen={fullscreen ? fullscreen.isFullscreen : browserIsFullscreen}
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
              onZoomIn={commandZoomIn}
              onZoomOut={commandZoomOut}
              onFit={commandFit}
              onOneToOne={() => commandSetNative(100)}
              onSetNative={commandSetNative}
              onRotateCW={commandRotateCW}
              onRotateCCW={commandRotateCCW}
              onFlipH={commandFlipHorizontal}
              onFlipV={commandFlipVertical}
              onPrev={prev}
              onNext={next}
              {...groupToolbarProps}
            />
          </div>

          {/* L4 — loading / error (always topmost) */}
          <div
            data-rip-floor="loading"
            data-rip-loader={showCenterLoader ? 'on' : 'off'}
            data-rip-media-phase={mediaPhase}
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
