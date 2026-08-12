/** Fully paintable (createImageBitmap / decode settled) — safe to show without partial JPEG scans. */
const decodeSettled = new WeakSet<HTMLImageElement>();
const decodeInflight = new WeakMap<HTMLImageElement, Array<() => void>>();

function afterDoubleAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Wait until the image has a complete decoded bitmap (not just the first progressive JPEG scan).
 * `img.decode()` alone can resolve too early and the browser then paints a left/top strip for a frame.
 */
async function waitUntilFullyDecoded(img: HTMLImageElement): Promise<void> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(img);
      bmp.close();
      return;
    } catch {
      /* fall through to decode() */
    }
  }
  if (typeof img.decode === 'function') {
    try {
      await img.decode();
    } catch {
      /* still reveal after timeout path */
    }
  }
}

/**
 * Wait until the image is fully decoded (or timeout), then invoke `onReveal`.
 * If this element already fully decoded (e.g. neighbor display slot), invoke on the next microtask —
 * critical when the same DOM node is promoted into the main view without remounting.
 */
export function scheduleRevealAfterDecode(
  img: HTMLImageElement,
  onReveal: () => void,
  timeoutMs: number,
): void {
  if (decodeSettled.has(img)) {
    queueMicrotask(onReveal);
    return;
  }

  const existing = decodeInflight.get(img);
  if (existing) {
    existing.push(onReveal);
    return;
  }

  const callbacks = [onReveal];
  decodeInflight.set(img, callbacks);

  let finished = false;
  const once = () => {
    if (finished) return;
    finished = true;
    decodeSettled.add(img);
    decodeInflight.delete(img);
    for (const cb of callbacks) cb();
  };

  const tid = window.setTimeout(once, timeoutMs);

  void (async () => {
    try {
      await waitUntilFullyDecoded(img);
      // Let the compositor hold the full bitmap before we flip opacity (avoids one-frame strip).
      await afterDoubleAnimationFrame();
    } finally {
      window.clearTimeout(tid);
      once();
    }
  })();
}
