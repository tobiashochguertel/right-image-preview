/**
 * SVG `<polyline points="…">` for side navigation (viewBox 0 0 24 24).
 * Names document intent so the JSX does not rely on raw coordinate strings.
 */

/** One chevron pointing left — previous image in current folder. */
export const NAV_ARROW_POLY_PREV_SINGLE = '15,18 9,12 15,6';

/** One chevron pointing right — next image in current folder. */
export const NAV_ARROW_POLY_NEXT_SINGLE = '9,18 15,12 9,6';

/** Double-chevron left — outer stroke (jump to previous group). */
export const NAV_ARROW_POLY_PREV_GROUP_OUTER = '19,18 13,12 19,6';

/** Double-chevron left — inner stroke. */
export const NAV_ARROW_POLY_PREV_GROUP_INNER = '11,18 5,12 11,6';

/** Double-chevron right — outer stroke (jump to next group). */
export const NAV_ARROW_POLY_NEXT_GROUP_OUTER = '5,18 11,12 5,6';

/** Double-chevron right — inner stroke. */
export const NAV_ARROW_POLY_NEXT_GROUP_INNER = '13,18 19,12 13,6';
