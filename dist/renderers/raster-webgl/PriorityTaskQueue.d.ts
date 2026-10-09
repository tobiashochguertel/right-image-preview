/** Small bounded queue: current image work overtakes queued neighbor preloads. */
export declare class PriorityTaskQueue {
    private readonly concurrency;
    private readonly reservedPriority;
    private readonly pending;
    private active;
    private activeBackground;
    private sequence;
    private disposed;
    constructor(concurrency?: number, reservedPriority?: number);
    schedule<T>(priority: number, run: () => Promise<T>, tag?: string): Promise<T>;
    cancelPending(tag: string, reason?: unknown): void;
    dispose(): void;
    private drain;
}
