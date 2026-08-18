import type { MediaPresentationPhase } from '../core/media-contract';
import type { TransformState } from '../useImageTransform';

export interface MediaStageTransformProps {
  transform: TransformState;
  onDimensions(width: number, height: number): void;
  onPhaseChange(phase: MediaPresentationPhase): void;
  onError(error: Error): void;
  onPresented(): void;
}
