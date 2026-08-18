interface PendingTask<T> {
  tag?: string;
  priority: number;
  sequence: number;
  run(): Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

/** Small bounded queue: current image work overtakes queued neighbor preloads. */
export class PriorityTaskQueue {
  private readonly concurrency: number;
  private readonly reservedPriority: number;
  private readonly pending: PendingTask<unknown>[] = [];
  private active = 0;
  private activeBackground = 0;
  private sequence = 0;
  private disposed = false;

  constructor(concurrency = 2, reservedPriority = Number.POSITIVE_INFINITY) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
    this.reservedPriority = reservedPriority;
  }

  schedule<T>(priority: number, run: () => Promise<T>, tag?: string): Promise<T> {
    if (this.disposed) return Promise.reject(new Error('Task queue has been disposed'));
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        tag,
        priority,
        sequence: this.sequence++,
        run,
        resolve,
        reject,
      } as PendingTask<unknown>);
      this.pending.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
      this.drain();
    });
  }

  cancelPending(tag: string): void {
    const error = new Error(`Task queue group was cancelled: ${tag}`);
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      if (this.pending[index].tag !== tag) continue;
      const [task] = this.pending.splice(index, 1);
      task.reject(error);
    }
  }

  dispose(): void {
    this.disposed = true;
    const error = new Error('Task queue has been disposed');
    for (const task of this.pending.splice(0)) task.reject(error);
  }

  private drain(): void {
    while (!this.disposed && this.active < this.concurrency && this.pending.length > 0) {
      const index = this.pending.findIndex((candidate) =>
        candidate.priority >= this.reservedPriority ||
        this.activeBackground < Math.max(1, this.concurrency - 1));
      if (index < 0) break;
      const [task] = this.pending.splice(index, 1);
      const isBackground = task.priority < this.reservedPriority;
      this.active += 1;
      if (isBackground) this.activeBackground += 1;
      void task.run()
        .then(task.resolve, task.reject)
        .finally(() => {
          this.active -= 1;
          if (isBackground) this.activeBackground -= 1;
          this.drain();
        });
    }
  }
}
