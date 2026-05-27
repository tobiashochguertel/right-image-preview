/** Avoid duplicate `decode()` / timeout pairs when both `ref` and `onLoad` run for cached images. */
const revealDecodeScheduled = new WeakSet<HTMLImageElement>();

export function scheduleRevealAfterDecode(
  img: HTMLImageElement,
  onReveal: () => void,
  timeoutMs: number,
): void {
  if (revealDecodeScheduled.has(img)) return;
  revealDecodeScheduled.add(img);
  let settled = false;
  const once = () => {
    if (settled) return;
    settled = true;
    onReveal();
  };
  const tid = window.setTimeout(once, timeoutMs);
  if (typeof img.decode === 'function') {
    img
      .decode()
      .then(() => {
        window.clearTimeout(tid);
        once();
      })
      .catch(() => {
        window.clearTimeout(tid);
        once();
      });
  } else {
    window.clearTimeout(tid);
    queueMicrotask(once);
  }
}
