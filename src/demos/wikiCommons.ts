/**
 * Wikimedia Commons upload URLs for demo galleries.
 *
 * Commons only materializes some thumbnail widths. Requesting a size that is not
 * in that file’s generated set returns HTTP 400 (the grid `<img>` then shows
 * empty). The imageinfo API snaps 320 → **330**; **120** is in the default thumb
 * limits and is the safe small size. **500** is not reliable for every file
 * (North America Nebula, Starry Night).
 */
export const WIKIMEDIA_COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';

/** Default grid / progressive thumb width (always in Commons `$wgThumbLimits`). */
export const WIKI_MINIMAP_PX = 120;

function encodeWikiFilename(file: string): string {
  // `encodeURIComponent` leaves `()` intact; Commons canonical URLs percent-encode them.
  return encodeURIComponent(file).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

export function wikiThumb(folder: string, file: string, width: number): string {
  const enc = encodeWikiFilename(file);
  return `${WIKIMEDIA_COMMONS}/thumb/${folder}/${enc}/${width}px-${enc}`;
}

export function wikiOriginal(folder: string, file: string): string {
  const enc = encodeWikiFilename(file);
  return `${WIKIMEDIA_COMMONS}/${folder}/${enc}`;
}
