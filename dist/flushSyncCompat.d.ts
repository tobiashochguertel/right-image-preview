type FlushSync = (fn: () => void) => void;
/**
 * React 18+ `flushSync`: forces updates inside `fn` before continuing (needed for multi-step wheel zoom).
 * React 17: `flushSync` is missing — run `fn` synchronously; rare edge cases in fast wheel bursts may differ.
 */
export declare const runFlushSync: FlushSync;
export {};
