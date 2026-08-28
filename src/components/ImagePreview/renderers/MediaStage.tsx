import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { MediaPresentationPhase } from '../core/media-contract';
import type { MediaKind } from '../core/media-kind';
import type { MediaSource } from '../core/media-source';
import type { TransformState } from '../useImageTransform';
import { AnimatedImageViewer } from './animated/AnimatedImageViewer';
import type { WebGLRasterStageProps } from './raster-webgl/WebGLRasterStage';
import { WebGLRasterStage } from './raster-webgl/WebGLRasterStage';
import type { RasterPreloadSource } from './raster-webgl/rasterPreloadPlan';
import { SvgViewer } from './svg/SvgViewer';
import { UnknownMediaViewer } from './unknown/UnknownMediaViewer';
import { VideoViewer } from './video/VideoViewer';

export interface MediaStageProps {
  resourceKey: string;
  currentFlatIndex?: number;
  kind: MediaKind;
  /** True while an ambiguous source is still being byte-sniffed. */
  kindPending?: boolean;
  source: MediaSource;
  previewSource?: MediaSource;
  preloadSources?: readonly RasterPreloadSource[];
  rasterPreloadEnabled?: boolean;
  /** Foreground interaction owns the frame budget; do not start more neighbor work. */
  rasterPreloadPaused?: boolean;
  rasterFullResolutionPaused?: boolean;
  rasterFullResolutionSettleMs?: number;
  textureBudgetBytes?: number;
  decodeWorkers?: WebGLRasterStageProps['decodeWorkers'];
  decodeWorkerMax?: number;
  onPreloadStateChange?: WebGLRasterStageProps['onPreloadStateChange'];
  onRasterRuntimeStateChange?: WebGLRasterStageProps['onRuntimeStateChange'];
  onRasterPreloadPlanChange?: WebGLRasterStageProps['onPreloadPlanChange'];
  alt: string;
  label: string;
  transform: TransformState;
  knownSize?: { width: number; height: number };
  onDimensions(width: number, height: number): void;
  onPhaseChange(phase: MediaPresentationPhase): void;
  onError(error: Error): void;
  onPresented(): void;
}

export function MediaStage(props: MediaStageProps) {
  const rasterActive = props.kind === 'raster';
  const [videoPlayback, setVideoPlayback] = useState({ resourceKey: '', playing: false });
  const videoPlaying =
    props.kind === 'video' &&
    videoPlayback.resourceKey === props.resourceKey &&
    videoPlayback.playing;
  const callbacksRef = useRef({
    onDimensions: props.onDimensions,
    onPhaseChange: props.onPhaseChange,
    onError: props.onError,
    onPresented: props.onPresented,
  });
  useLayoutEffect(() => {
    callbacksRef.current = {
      onDimensions: props.onDimensions,
      onPhaseChange: props.onPhaseChange,
      onError: props.onError,
      onPresented: props.onPresented,
    };
  });
  const onDimensions = useCallback((width: number, height: number) => {
    callbacksRef.current.onDimensions(width, height);
  }, []);
  const onPhaseChange = useCallback((phase: MediaPresentationPhase) => {
    callbacksRef.current.onPhaseChange(phase);
  }, []);
  const onError = useCallback((error: Error) => {
    callbacksRef.current.onPhaseChange('error');
    callbacksRef.current.onError(error);
  }, []);
  const onUnsupported = useCallback((error: Error) => {
    // `unsupported` remains the renderer phase for diagnostics, while the public error
    // contract still fires so hosts can replace the built-in message with errorFallback.
    callbacksRef.current.onError(error);
  }, []);
  const onPresented = useCallback(() => callbacksRef.current.onPresented(), []);
  const common = {
    transform: props.transform,
    onDimensions,
    onPhaseChange,
    onError,
    onPresented,
  };

  let nativeStage = null;
  switch (props.kind) {
    case 'svg':
      nativeStage = (
        <SvgViewer key={props.resourceKey} source={props.source} alt={props.alt} {...common} />
      );
      break;
    case 'animated-image':
      nativeStage = (
        <AnimatedImageViewer
          key={props.resourceKey}
          source={props.source}
          alt={props.alt}
          {...common}
        />
      );
      break;
    case 'video':
      nativeStage = (
        <VideoViewer
          key={props.resourceKey}
          source={props.source}
          onPlaybackChange={(playing) => {
            setVideoPlayback({ resourceKey: props.resourceKey, playing });
          }}
          {...common}
        />
      );
      break;
    case 'unknown':
      nativeStage = (
        <UnknownMediaViewer
          key={props.resourceKey}
          label={props.label}
          pending={props.kindPending}
          onPhaseChange={onPhaseChange}
          onError={onUnsupported}
        />
      );
      break;
  }

  return (
    <div data-rip-media-stage="" style={{ position: 'absolute', inset: 0 }}>
      <WebGLRasterStage
        active={rasterActive}
        resourceKey={rasterActive ? props.resourceKey : undefined}
        currentFlatIndex={rasterActive ? props.currentFlatIndex : undefined}
        source={rasterActive ? props.source : undefined}
        previewSource={rasterActive ? props.previewSource : undefined}
        preloadSources={props.preloadSources}
        preloadEnabled={props.rasterPreloadEnabled}
        preloadPaused={
          props.rasterPreloadPaused ||
          props.kind === 'animated-image' ||
          (props.kind === 'video' && videoPlaying)
        }
        fullResolutionPaused={props.rasterFullResolutionPaused}
        fullResolutionSettleMs={props.rasterFullResolutionSettleMs}
        textureBudgetBytes={props.textureBudgetBytes}
        decodeWorkers={props.decodeWorkers}
        decodeWorkerMax={props.decodeWorkerMax}
        onPreloadStateChange={props.onPreloadStateChange}
        onRuntimeStateChange={props.onRasterRuntimeStateChange}
        onPreloadPlanChange={props.onRasterPreloadPlanChange}
        knownSize={rasterActive ? props.knownSize : undefined}
        {...common}
      />
      {nativeStage}
    </div>
  );
}
