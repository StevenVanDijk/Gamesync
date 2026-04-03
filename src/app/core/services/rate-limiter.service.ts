import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Queues callables and executes them one-at-a-time with a configurable
 * delay between each, preventing bursts of API requests (e.g. to Steam).
 */
@Injectable({ providedIn: 'root' })
export class RateLimiterService {
  /** Minimum milliseconds between consecutive outbound requests. */
  delayMs = 1_000;

  private queue: Array<() => void> = [];
  private processing = false;

  /**
   * Wrap any Observable factory in the rate-limiter queue.
   * The returned Observable only subscribes to `factory()` once the
   * queue position is reached.
   */
  enqueue<T>(factory: () => Observable<T>): Observable<T> {
    return new Observable<T>(observer => {
      this.queue.push(() => {
        factory().subscribe({
          next: v => observer.next(v),
          error: e => observer.error(e),
          complete: () => observer.complete(),
        });
      });
      if (!this.processing) {
        this.processNext();
      }
    });
  }

  private processNext(): void {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;
    const task = this.queue.shift()!;
    task();
    setTimeout(() => this.processNext(), this.delayMs);
  }

  /** Visible for testing */
  get queueLength(): number {
    return this.queue.length;
  }
}
