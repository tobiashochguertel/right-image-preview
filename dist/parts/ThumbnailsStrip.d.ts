import { ImageItem, NeighborPreloadStatusMap } from '../types';
export interface ThumbnailStripEntry {
    /** Flat index in the full preview list. */
    flatIndex: number;
    item: ImageItem;
}
export interface ThumbnailsStripProps {
    entries: ThumbnailStripEntry[];
    activeFlatIndex: number;
    controlsVisible?: boolean;
    /** Idle opacity when controls are hidden (0 for minimal chrome, ~0.1 default). */
    idleOpacity?: number;
    /** Neighbor preload status keyed by flat index (progress line under tiles). */
    preloadStatus?: NeighborPreloadStatusMap;
    ariaLabel: string;
    thumbAria: (index: number, total: number) => string;
    onSelect(flatIndex: number): void;
    onUserActivity?(): void;
    onVisibleIndexesChange?(indexes: number[]): void;
}
export declare function ThumbnailsStrip({ entries, activeFlatIndex, controlsVisible, idleOpacity, preloadStatus, ariaLabel, thumbAria, onSelect, onUserActivity, onVisibleIndexesChange, }: ThumbnailsStripProps): import("react/jsx-runtime").JSX.Element | null;
