import { RasterTextureEntry } from './types';
export interface TextureCacheReservation {
    commit(entry: RasterTextureEntry, priority?: number): boolean;
    release(): void;
}
export declare class TextureCache {
    private budgetBytes;
    private readonly entries;
    private readonly priorities;
    private readonly gl;
    private protectedKeys;
    private usedBytes;
    private reservedBytes;
    private readonly activeReservations;
    constructor(gl: WebGL2RenderingContext, maxBytes: number);
    get maxBytes(): number;
    setMaxBytes(maxBytes: number): void;
    get(key: string): RasterTextureEntry | undefined;
    put(entry: RasterTextureEntry, priority?: number): boolean;
    /**
     * 上传前预留逻辑 RGBA8 字节。前台任务可淘汰受保护的旧 LOD，确保新的当前图
     * 不会因为保护集合占满预算而先上传、后超额；后台任务则宁可放弃本次预热。
     */
    reserve(key: string, estimatedBytes: number, allowProtectedEviction: boolean, priority?: number): TextureCacheReservation | null;
    has(key: string): boolean;
    /** 只有 cache 仍持有同一纹理句柄时，舞台 entry 才允许绘制。 */
    isResident(entry: RasterTextureEntry): boolean;
    /** 返回指定资源仍驻留的最清晰 LOD，不得跨资源回退。 */
    bestResident(resourceKey: string): RasterTextureEntry | undefined;
    prioritize(entries: ReadonlyMap<string, number>): void;
    protect(keys: readonly string[]): void;
    retainOnly(keys: readonly string[]): boolean;
    delete(key: string, deleteTexture?: boolean): boolean;
    rekey(oldKey: string, newKey: string, patch: Partial<Pick<RasterTextureEntry, 'key' | 'quality'>>): RasterTextureEntry | undefined;
    clear(deleteTextures?: boolean): void;
    snapshot(): {
        count: number;
        usedBytes: number;
        reservedBytes: number;
        maxBytes: number;
        oversubscribed: boolean;
    };
    residentResourceKeys(): string[];
    residentEntries(): readonly RasterTextureEntry[];
    private enforceBudget;
    private makeRoom;
    private selectVictim;
}
