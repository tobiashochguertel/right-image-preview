export interface ImagePreviewNavArrowProps {
    direction: 'left' | 'right';
    /** When true the icon becomes a double-chevron (group jump). */
    isGroupJump?: boolean;
    onClick?: () => void;
    onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerCancel?: (e: React.PointerEvent<HTMLButtonElement>) => void;
    label: string;
    tip: string;
    visible: boolean;
    /** Opacity when `visible` is false. */
    idleOpacity?: number;
}
export declare function ImagePreviewNavArrow({ direction, isGroupJump, onClick, onPointerDown, onPointerUp, onPointerCancel, label, tip, visible, idleOpacity, }: ImagePreviewNavArrowProps): import("react/jsx-runtime").JSX.Element;
