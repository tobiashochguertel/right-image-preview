import { MediaPresentationPhase } from '../../core/media-contract';
export interface UnknownMediaViewerProps {
    label: string;
    pending?: boolean;
    onPhaseChange(phase: MediaPresentationPhase): void;
    onError(error: Error): void;
}
export declare function UnknownMediaViewer({ label, pending, onPhaseChange, onError, }: UnknownMediaViewerProps): import("react/jsx-runtime").JSX.Element;
