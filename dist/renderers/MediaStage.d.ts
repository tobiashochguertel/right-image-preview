import { MediaPresentationPhase } from '../core/media-contract';
import { MediaKind } from '../core/media-kind';
import { MediaSource } from '../core/media-source';
import { TransformState } from '../useImageTransform';
import { WebGLRasterStageProps } from './raster-webgl/WebGLRasterStage';
import { RasterPreloadSource } from './raster-webgl/rasterPreloadPlan';
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
    rasterFullDecodeMaxBytes?: number;
    textureBudgetBytes?: number;
    decodeWorkers?: WebGLRasterStageProps['decodeWorkers'];
    decodeWorkerMax?: number;
    onPreloadStateChange?: WebGLRasterStageProps['onPreloadStateChange'];
    onRasterRuntimeStateChange?: WebGLRasterStageProps['onRuntimeStateChange'];
    onRasterRendererStateChange?: WebGLRasterStageProps['onRendererStateChange'];
    onRasterPreloadPlanChange?: WebGLRasterStageProps['onPreloadPlanChange'];
    alt: string;
    label: string;
    transform: TransformState;
    knownSize?: {
        width: number;
        height: number;
    };
    onDimensions(width: number, height: number): void;
    onPhaseChange(phase: MediaPresentationPhase): void;
    onError(error: Error): void;
    onPresented(): void;
}
export declare function MediaStage(props: MediaStageProps): import("react/jsx-runtime").JSX.Element;
