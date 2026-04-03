import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, beforeEach, afterEach } from 'vitest';
import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService (US-006 – rate limiting)', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(RateLimiterService);
    service.delayMs = 100;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute an enqueued observable and emit its value', () => {
    const results: number[] = [];
    service.enqueue(() => of(42)).subscribe(v => results.push(v));
    vi.advanceTimersByTime(200);
    expect(results).toEqual([42]);
  });

  it('should process queued requests sequentially with delays', () => {
    const order: string[] = [];
    service.enqueue(() => { order.push('first'); return of(1); }).subscribe();
    service.enqueue(() => { order.push('second'); return of(2); }).subscribe();
    service.enqueue(() => { order.push('third'); return of(3); }).subscribe();

    vi.advanceTimersByTime(0);
    expect(order).toEqual(['first']);

    vi.advanceTimersByTime(100);
    expect(order).toEqual(['first', 'second']);

    vi.advanceTimersByTime(100);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('should hold subsequent tasks in queue while processing', () => {
    service.delayMs = 100_000;
    service.enqueue(() => of(1)).subscribe();
    service.enqueue(() => of(2)).subscribe();
    vi.advanceTimersByTime(0);
    // First item dequeued immediately; second still waiting
    expect(service.queueLength).toBe(1);
  });
});
