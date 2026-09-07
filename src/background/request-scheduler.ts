import { abortable, abortReason } from "../translation/async";
import { TranslationError } from "../translation/errors";

type Job = {
  key: string;
  signal: AbortSignal;
  start: () => void;
  reject: (error: unknown) => void;
  abort: () => void;
};

export class RequestScheduler {
  private active = 0;
  private readonly activeByKey = new Map<string, number>();
  private readonly nextStart = new Map<string, number>();
  private readonly cooldown = new Map<string, number>();
  private readonly queue: Job[] = [];
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly maxConcurrent = 6,
    private readonly perService = 2,
    private readonly intervalMs = 250,
    private readonly maxQueued = 100
  ) {}

  schedule<T>(key: string, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    if (signal.aborted) return Promise.reject(abortReason(signal));
    const blocked = this.blocked(key);
    if (blocked) return Promise.reject(blocked);
    if (this.queue.length >= this.maxQueued)
      return Promise.reject(new TranslationError("Translation queue is full", "rate-limit", 1000));
    return new Promise((resolve, reject) => {
      const job: Job = {
        key,
        signal,
        reject,
        abort: () => {
          const index = this.queue.indexOf(job);
          if (index >= 0) this.queue.splice(index, 1);
          reject(abortReason(signal));
          this.pump();
        },
        start: () => {
          signal.removeEventListener("abort", job.abort);
          this.active++;
          this.activeByKey.set(key, (this.activeByKey.get(key) ?? 0) + 1);
          this.nextStart.set(key, Date.now() + this.intervalMs);
          void abortable(operation, signal)
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.activeByKey.set(key, (this.activeByKey.get(key) ?? 1) - 1);
              this.pump();
            });
        }
      };
      signal.addEventListener("abort", job.abort, { once: true });
      this.queue.push(job);
      this.pump();
    });
  }

  defer(key: string, ms: number): void {
    this.cooldown.set(key, Math.max(this.cooldown.get(key) ?? 0, Date.now() + ms));
    this.pump();
  }

  private blocked(key: string): TranslationError | undefined {
    const ms = (this.cooldown.get(key) ?? 0) - Date.now();
    return ms > 0 ? new TranslationError("Service rate limit", "rate-limit", ms) : undefined;
  }

  private pump(): void {
    clearTimeout(this.timer);
    let next = Infinity;
    for (let index = 0; index < this.queue.length;) {
      const job = this.queue[index];
      const blocked = this.blocked(job.key);
      if (blocked || job.signal.aborted) {
        this.queue.splice(index, 1);
        job.signal.removeEventListener("abort", job.abort);
        job.reject(blocked ?? abortReason(job.signal));
        continue;
      }
      if (
        this.active >= this.maxConcurrent ||
        (this.activeByKey.get(job.key) ?? 0) >= this.perService
      ) {
        index++;
        continue;
      }
      const delay = (this.nextStart.get(job.key) ?? 0) - Date.now();
      if (delay > 0) {
        next = Math.min(next, delay);
        index++;
        continue;
      }
      this.queue.splice(index, 1);
      job.start();
    }
    if (Number.isFinite(next)) this.timer = setTimeout(() => this.pump(), next);
  }
}

export const requestScheduler = new RequestScheduler();
