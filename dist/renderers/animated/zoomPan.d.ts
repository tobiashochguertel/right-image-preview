import { CSSProperties } from 'react';
import { MediaCapabilities } from '../../core/media-contract';
import { TransformState } from '../../useImageTransform';
export declare const ANIMATED_IMAGE_CAPABILITIES: Readonly<MediaCapabilities>;
export declare function animatedTransformStyle(transform: TransformState): CSSProperties;
