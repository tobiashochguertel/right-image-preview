import { LocaleStrings } from '../locale';
import { ImageExif } from '../types';
export type ExifPanelEdge = 'left' | 'right' | 'top' | 'bottom';
export interface ExifInfoPanelProps {
    exif: ImageExif | undefined;
    strings: LocaleStrings;
    onUserActivity?: () => void;
}
/**
 * Edge-snapped EXIF panel: drag via the top handle; release snaps to the nearest edge.
 * z-index stays below close / side arrows so those controls remain clickable.
 */
export declare function ExifInfoPanel({ exif, strings, onUserActivity, }: ExifInfoPanelProps): import("react/jsx-runtime").JSX.Element;
