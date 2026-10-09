import { MediaPresentationPhase } from '../../core/media-contract';
import { MediaSource } from '../../core/media-source';
import { TransformState } from '../../useImageTransform';
import { RasterPipeline, RasterPipelineOptions, RasterRuntimeSnapshot } from './RasterPipeline';
import { RasterDecodeWorkerSetting } from './rasterDecodePolicy';
import { RasterPreloadPlanSnapshot, RasterPreloadSource } from './rasterPreloadPlan';
import { RasterRendererState } from './rasterRendererState';
export interface WebGLRasterStageProps {
    active: boolean;
    resourceKey?: string;
    currentFlatIndex?: number;
    source?: MediaSource;
    previewSource?: MediaSource;
    preloadSources?: readonly RasterPreloadSource[];
    preloadEnabled?: boolean;
    preloadPaused?: boolean;
    fullResolutionPaused?: boolean;
    fullResolutionSettleMs?: number;
    fullDecodeMaxBytes?: number;
    textureBudgetBytes?: number;
    decodeWorkers?: RasterDecodeWorkerSetting;
    decodeWorkerMax?: number;
    onPreloadStateChange?(item: RasterPreloadSource, phase: 'loading' | 'browse-ready' | 'display-ready' | 'evicted' | 'error', targetLod?: 'browse' | 'screen'): void;
    onRuntimeStateChange?(snapshot: RasterRuntimeSnapshot): void;
    onRendererStateChange?(state: RasterRendererState): void;
    onPreloadPlanChange?(snapshot: RasterPreloadPlanSnapshot): void;
    transform: TransformState;
    knownSize?: {
        width: number;
        height: number;
    };
    onDimensions(width: number, height: number): void;
    onPhaseChange(phase: MediaPresentationPhase): void;
    onError(error: Error): void;
    onPresented(): void;
    /** Internal test injection; normal consumers always use the default WebGL pipeline. */
    createPipeline?(canvas: HTMLCanvasElement, budgetBytes: number, options: RasterPipelineOptions): RasterPipeline;
}
export declare function WebGLRasterStage({ active, resourceKey, currentFlatIndex, source, previewSource, preloadSources, preloadEnabled, preloadPaused, fullResolutionPaused, fullResolutionSettleMs, fullDecodeMaxBytes, textureBudgetBytes, decodeWorkers, decodeWorkerMax, onPreloadStateChange, onRuntimeStateChange, onRendererStateChange, onPreloadPlanChange, transform, knownSize, onDimensions, onPhaseChange, onError, onPresented, createPipeline, }: WebGLRasterStageProps): import("react/jsx-runtime").JSX.Element;
