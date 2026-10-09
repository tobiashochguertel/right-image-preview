import { CSSProperties } from 'react';
import { MediaCapabilities } from '../../core/media-contract';
import { TransformState } from '../../useImageTransform';
export declare const SVG_CAPABILITIES: Readonly<MediaCapabilities>;
export declare function svgTransformStyle(transform: TransformState): CSSProperties;
