import { default as React } from 'react';
export interface DelayedTooltipProps {
    /** Shown after delay; if empty, children render unchanged. */
    content: string;
    /** Hover delay before showing (ms). */
    delayMs?: number;
    /** When true, skip tooltip behavior. */
    disabled?: boolean;
    children: React.ReactElement;
}
/**
 * Hover tooltip with a configurable delay (native `title` shows immediately).
 * Merges hover handlers into the child while leaving the child's ref untouched.
 */
export declare function DelayedTooltip({ content, delayMs, disabled, children, }: DelayedTooltipProps): import("react/jsx-runtime").JSX.Element;
