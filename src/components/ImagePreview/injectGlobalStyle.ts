/**
 * Inject a CSS rule into a shared <style> tag exactly once per browser session.
 * Safe to call multiple times — subsequent calls for the same `id` are no-ops.
 * SSR-safe: does nothing when `document` is unavailable.
 */
const injected = new Set<string>();

export function injectGlobalStyle(id: string, css: string): void {
  if (typeof document === 'undefined') return;
  if (injected.has(id)) return;
  injected.add(id);
  const style = document.createElement('style');
  style.setAttribute('data-rip', id);
  style.textContent = css;
  document.head.appendChild(style);
}
