import { TestBed } from '@angular/core/testing';
import { CacheService } from './cache.service';

describe('CacheService (US-006 – caching)', () => {
  let service: CacheService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CacheService);
  });

  afterEach(() => localStorage.clear());

  it('should store and retrieve a value before TTL expires', () => {
    service.set('key1', { foo: 'bar' }, 60_000);
    expect(service.get<{ foo: string }>('key1')).toEqual({ foo: 'bar' });
  });

  it('should return null for a missing key', () => {
    expect(service.get('missing')).toBeNull();
  });

  it('should return null and evict an entry after TTL expires', () => {
    service.set('expired', 'value', -1);
    expect(service.get('expired')).toBeNull();
    expect(localStorage.getItem('gamesync_cache_expired')).toBeNull();
  });

  it('should delete a specific entry', () => {
    service.set('key2', 42, 60_000);
    service.delete('key2');
    expect(service.get('key2')).toBeNull();
  });

  it('should clear all cache entries', () => {
    service.set('a', 1, 60_000);
    service.set('b', 2, 60_000);
    service.clear();
    expect(service.get('a')).toBeNull();
    expect(service.get('b')).toBeNull();
  });

  it('should not affect non-cache localStorage keys when clearing', () => {
    localStorage.setItem('other_key', 'untouched');
    service.set('c', 3, 60_000);
    service.clear();
    expect(localStorage.getItem('other_key')).toBe('untouched');
  });
});
