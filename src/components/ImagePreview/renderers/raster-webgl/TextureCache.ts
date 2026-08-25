import type { RasterTextureEntry } from './types';

export interface TextureCacheReservation {
  commit(entry: RasterTextureEntry, priority?: number): boolean;
  release(): void;
}

interface ActiveTextureReservation {
  bytes: number;
  cancelled: boolean;
}

export class TextureCache {
  private budgetBytes: number;
  private readonly entries = new Map<string, RasterTextureEntry>();
  private readonly priorities = new Map<string, number>();
  private readonly gl: WebGL2RenderingContext;
  private protectedKeys = new Set<string>();
  private usedBytes = 0;
  private reservedBytes = 0;
  private readonly activeReservations = new Set<ActiveTextureReservation>();

  constructor(gl: WebGL2RenderingContext, maxBytes: number) {
    this.gl = gl;
    this.budgetBytes = maxBytes;
  }

  get maxBytes(): number {
    return this.budgetBytes;
  }

  setMaxBytes(maxBytes: number): void {
    // A lower live budget invalidates pending uploads before the new ceiling is
    // applied. texImage2D itself cannot be interrupted, but its result cannot commit.
    for (const reservation of this.activeReservations) reservation.cancelled = true;
    this.activeReservations.clear();
    this.reservedBytes = 0;
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
    if (!this.makeRoom(entry.estimatedBytes, false, priority)) {
      this.gl.deleteTexture(entry.texture);
      return false;
    }
    this.entries.set(entry.key, entry);
    this.priorities.set(entry.key, priority);
    this.usedBytes += entry.estimatedBytes;
    return true;
  }

  /**
   * 上传前预留逻辑 RGBA8 字节。前台任务可淘汰受保护的旧 LOD，确保新的当前图
   * 不会因为保护集合占满预算而先上传、后超额；后台任务则宁可放弃本次预热。
   */
  reserve(
    key: string,
    estimatedBytes: number,
    allowProtectedEviction: boolean,
    priority = 0,
  ): TextureCacheReservation | null {
    const bytes = Math.max(0, Math.floor(estimatedBytes));
    this.delete(key);
    if (!this.makeRoom(bytes, allowProtectedEviction, priority)) return null;
    this.reservedBytes += bytes;
    const activeReservation: ActiveTextureReservation = { bytes, cancelled: false };
    this.activeReservations.add(activeReservation);
    let settled = false;

    const release = () => {
      if (settled) return;
      settled = true;
      if (this.activeReservations.delete(activeReservation)) {
        this.reservedBytes = Math.max(0, this.reservedBytes - bytes);
      }
      this.enforceBudget();
    };

    return {
      commit: (entry, priority = 0) => {
        if (settled) return false;
        settled = true;
        if (this.activeReservations.delete(activeReservation)) {
          this.reservedBytes = Math.max(0, this.reservedBytes - bytes);
        }
        if (
          activeReservation.cancelled ||
          entry.estimatedBytes !== bytes ||
          this.usedBytes + this.reservedBytes + entry.estimatedBytes > this.budgetBytes
        ) {
          this.gl.deleteTexture(entry.texture);
          this.enforceBudget();
          return false;
        }
        this.entries.set(entry.key, entry);
        this.priorities.set(entry.key, priority);
        this.usedBytes += entry.estimatedBytes;
        return true;
      },
      release,
    };
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** 只有 cache 仍持有同一纹理句柄时，舞台 entry 才允许绘制。 */
  isResident(entry: RasterTextureEntry): boolean {
    return this.entries.get(entry.key) === entry;
  }

  /** 返回指定资源仍驻留的最清晰 LOD，不得跨资源回退。 */
  bestResident(resourceKey: string): RasterTextureEntry | undefined {
    for (const quality of ['full', 'display', 'browse', 'preview'] as const) {
      const entry = this.entries.get(`${resourceKey}|${quality}`);
      if (entry) {
        entry.lastUsedAt = performance.now();
        return entry;
      }
    }
    return undefined;
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
    for (const reservation of this.activeReservations) reservation.cancelled = true;
    this.activeReservations.clear();
    this.reservedBytes = 0;
  }

  snapshot(): {
    count: number;
    usedBytes: number;
    reservedBytes: number;
    maxBytes: number;
    oversubscribed: boolean;
  } {
    return {
      count: this.entries.size,
      usedBytes: this.usedBytes,
      reservedBytes: this.reservedBytes,
      maxBytes: this.budgetBytes,
      oversubscribed: this.usedBytes + this.reservedBytes > this.budgetBytes,
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
    while (this.usedBytes + this.reservedBytes > this.budgetBytes && this.entries.size > 0) {
      const victim = this.selectVictim(true);
      if (!victim) break;
      this.delete(victim.key);
    }
  }

  private makeRoom(
    bytes: number,
    allowProtectedEviction: boolean,
    candidatePriority: number,
  ): boolean {
    if (bytes > this.budgetBytes) return false;
    while (this.usedBytes + this.reservedBytes + bytes > this.budgetBytes) {
      const victim = this.selectVictim(allowProtectedEviction);
      if (!victim) return false;
      if (
        !allowProtectedEviction &&
        candidatePriority < (this.priorities.get(victim.key) ?? 0)
      ) {
        return false;
      }
      this.delete(victim.key);
    }
    return true;
  }

  private selectVictim(includeProtected: boolean): RasterTextureEntry | undefined {
    return [...this.entries.values()]
      .filter((entry) => includeProtected || !this.protectedKeys.has(entry.key))
      .sort((a, b) => {
        const aProtected = this.protectedKeys.has(a.key) ? 1 : 0;
        const bProtected = this.protectedKeys.has(b.key) ? 1 : 0;
        return aProtected - bProtected ||
          (this.priorities.get(a.key) ?? 0) - (this.priorities.get(b.key) ?? 0) ||
          a.lastUsedAt - b.lastUsedAt;
      })[0];
  }
}
