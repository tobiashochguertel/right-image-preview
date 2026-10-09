import { CSSProperties } from 'react';
import { MediaCapabilities } from '../../core/media-contract';
import { TransformState } from '../../useImageTransform';
export declare const VIDEO_CAPABILITIES: Readonly<MediaCapabilities>;
export declare function videoTransformStyle(transform: TransformState): CSSProperties;
