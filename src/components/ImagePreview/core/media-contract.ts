import type { MediaKind } from './media-kind';

export interface ViewportPoint {
  x: number;
  y: number;
}

export type ViewerCommand =
  | { type: 'zoom-in'; anchor?: ViewportPoint }
  | { type: 'zoom-out'; anchor?: ViewportPoint }
  | { type: 'set-native'; percent: number; anchor?: ViewportPoint }
  | { type: 'fit' }
  | { type: 'reset' }
  | { type: 'pan-by'; dx: number; dy: number }
  | { type: 'pan-to-natural'; x: number; y: number }
  | { type: 'rotate-cw' }
  | { type: 'rotate-ccw' }
  | { type: 'flip-horizontal' }
  | { type: 'flip-vertical' };

export interface MediaCapabilities {
  zoom: boolean;
  nativeZoom: boolean;
  pan: boolean;
  rotate: boolean;
  flip: boolean;
  minimap: boolean;
}

export interface MediaMinimapGeometry {
  naturalWidth: number;
  naturalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export interface MediaViewState {
  zoomMode?: 'fit' | 'native' | 'custom';
  zoomPercent?: number;
  fitEquivalentNativePercent?: number;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  isPanned?: boolean;
  minimapGeometry?: MediaMinimapGeometry;
}

export type MediaPresentationPhase =
  | 'idle'
  | 'loading'
  | 'preview-ready'
  | 'display-ready'
  | 'restoring'
  | 'unsupported'
  | 'error';

export interface MediaError {
  code:
    | 'invalid-source'
    | 'load-failed'
    | 'decode-failed'
    | 'unsupported-kind'
    | 'webgl2-unavailable'
    | 'renderer-initialization-failed'
    | 'texture-too-large'
    | 'texture-budget-exceeded'
    | 'texture-create-failed'
    | 'texture-upload-failed'
    | 'context-lost'
    | 'context-restore-failed'
    | 'unknown';
  message: string;
  cause?: unknown;
}

export interface MediaPresentationState {
  kind: MediaKind;
  phase: MediaPresentationPhase;
  error?: MediaError;
}

/** Narrow renderer boundary. Navigation deliberately stays in the Viewer Shell. */
export interface MediaController {
  execute(command: ViewerCommand): void;
  getCapabilities(): MediaCapabilities;
  getViewState(): MediaViewState;
}

export const NO_MEDIA_CAPABILITIES: Readonly<MediaCapabilities> = Object.freeze({
  zoom: false,
  nativeZoom: false,
  pan: false,
  rotate: false,
  flip: false,
  minimap: false,
});
