import type { RasterTextureEntry } from './types';

export class TextureCache {
  private budgetBytes: number;
  private readonly entries = new Map<string, RasterTextureEntry>();
  private readonly priorities = new Map<string, number>();
  private readonly gl: WebGL2RenderingContext;
  private protectedKeys = new Set<string>();
  private usedBytes = 0;

  constructor(gl: WebGL2RenderingContext, maxBytes: number) {
    this.gl = gl;
    this.budgetBytes = maxBytes;
  }

  get maxBytes(): number {
    return this.budgetBytes;
  }

  setMaxBytes(maxBytes: number): void {
    this.budgetBytes = Math.max(1, Math.floor(maxBytes));
    this.enforceBudget();
  }

  get(key: string): RasterTextureEntry | undefined {
    const entry = this.entries.get(key);
    if (entry) entry.lastUsedAt = performance.now();
    return entry;
  }

  put(entry: RasterTextureEntry, priority = 0): boolean {
    this.delete(entry.key);
    this.entries.set(entry.key, entry);
    this.priorities.set(entry.key, priority);
    this.usedBytes += entry.estimatedBytes;
    this.enforceBudget();
    return this.entries.get(entry.key) === entry;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  prioritize(entries: ReadonlyMap<string, number>): void {
    this.priorities.clear();
    for (const [key, priority] of entries) {
      if (this.entries.has(key)) this.priorities.set(key, priority);
    }
    this.enforceBudget();
  }

  protect(keys: readonly string[]): void {
    this.protectedKeys = new Set(keys);
    this.enforceBudget();
  }

  retainOnly(keys: readonly string[]): boolean {
    const retained = new Set(keys);
    let changed = false;
    for (const key of [...this.entries.keys()]) {
      if (!retained.has(key)) changed = this.delete(key) || changed;
    }
    return changed;
  }

  delete(key: string, deleteTexture = true): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.priorities.delete(key);
    this.usedBytes -= entry.estimatedBytes;
    if (deleteTexture) this.gl.deleteTexture(entry.texture);
    return true;
  }

  rekey(
    oldKey: string,
    newKey: string,
    patch: Partial<Pick<RasterTextureEntry, 'key' | 'quality'>>,
  ): RasterTextureEntry | undefined {
    const entry = this.entries.get(oldKey);
    if (!entry) return undefined;
    const oldPriority = this.priorities.get(oldKey) ?? 0;
    if (oldKey !== newKey) {
      this.delete(newKey);
      this.entries.delete(oldKey);
      this.priorities.delete(oldKey);
    }
    Object.assign(entry, patch, { key: newKey });
    this.entries.set(newKey, entry);
    this.priorities.set(newKey, oldPriority);
    if (this.protectedKeys.delete(oldKey)) this.protectedKeys.add(newKey);
    return entry;
  }

  clear(deleteTextures = true): void {
    if (deleteTextures) {
      for (const entry of this.entries.values()) this.gl.deleteTexture(entry.texture);
    }
    this.entries.clear();
    this.priorities.clear();
    this.protectedKeys.clear();
    this.usedBytes = 0;
  }

  snapshot(): { count: number; usedBytes: number; maxBytes: number; oversubscribed: boolean } {
    return {
      count: this.entries.size,
      usedBytes: this.usedBytes,
      maxBytes: this.budgetBytes,
      oversubscribed: this.usedBytes > this.budgetBytes,
    };
  }

  residentResourceKeys(): string[] {
    return [...new Set(
      [...this.entries.values()]
        .filter((entry) =>
          entry.quality === 'browse' || entry.quality === 'display' || entry.quality === 'full')
        .map((entry) => entry.resourceKey),
    )];
  }

  residentEntries(): readonly RasterTextureEntry[] {
    return [...this.entries.values()];
  }

  private enforceBudget(): void {
    while (this.usedBytes > this.budgetBytes && this.entries.size > 1) {
      const victim = [...this.entries.values()]
        .filter((entry) => !this.protectedKeys.has(entry.key))
        .sort((a, b) =>
          (this.priorities.get(a.key) ?? 0) - (this.priorities.get(b.key) ?? 0) ||
          a.lastUsedAt - b.lastUsedAt)[0];
      if (!victim) break;
      this.delete(victim.key);
    }
  }
}
