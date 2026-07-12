import { TestBed } from '@angular/core/testing';
import { LoggingService } from './logging.service';

describe('LoggingService (US-013)', () => {
  let service: LoggingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggingService);
  });

  it('should start with no entries and no unseen errors', () => {
    expect(service.entries()).toHaveLength(0);
    expect(service.unseenErrors()).toBe(0);
  });

  it('should add an info entry', () => {
    service.info('Tag', 'hello info');
    expect(service.entries()).toHaveLength(1);
    expect(service.entries()[0].level).toBe('info');
    expect(service.entries()[0].tag).toBe('Tag');
    expect(service.entries()[0].message).toBe('hello info');
    expect(service.unseenErrors()).toBe(0);
  });

  it('should add a warn entry', () => {
    service.warn('Tag', 'a warning');
    expect(service.entries()[0].level).toBe('warn');
    expect(service.unseenErrors()).toBe(0);
  });

  it('should add an error entry and increment unseenErrors', () => {
    service.error('Tag', 'something went wrong');
    expect(service.entries()[0].level).toBe('error');
    expect(service.unseenErrors()).toBe(1);
  });

  it('should omit HTTP detail objects and request URLs from error logs (US-035)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const detail = { url: 'https://example.com?token=secret', headers: { Authorization: 'secret' } };

    service.error('HTTP', 'failed at https://example.com?token=secret', detail);

    expect(consoleError).toHaveBeenCalledWith('[HTTP] failed at [redacted-url]');
    expect(consoleError).not.toHaveBeenCalledWith(expect.anything(), detail);
    expect(service.entries()[0].message).toBe('failed at [redacted-url]');
    consoleError.mockRestore();
  });

  it('should accumulate multiple unseen errors', () => {
    service.error('A', 'err 1');
    service.error('B', 'err 2');
    expect(service.unseenErrors()).toBe(2);
  });

  it('should prepend new entries (newest first)', () => {
    service.info('T', 'first');
    service.info('T', 'second');
    expect(service.entries()[0].message).toBe('second');
    expect(service.entries()[1].message).toBe('first');
  });

  it('should reset unseenErrors on markAllSeen', () => {
    service.error('T', 'err');
    service.error('T', 'err2');
    service.markAllSeen();
    expect(service.unseenErrors()).toBe(0);
    expect(service.entries()).toHaveLength(2); // entries stay
  });

  it('should clear all entries and reset unseenErrors', () => {
    service.info('T', 'msg');
    service.error('T', 'err');
    service.clear();
    expect(service.entries()).toHaveLength(0);
    expect(service.unseenErrors()).toBe(0);
  });

  it('should assign unique sequential ids', () => {
    service.info('T', 'a');
    service.info('T', 'b');
    const ids = service.entries().map(e => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('should attach a timestamp close to now', () => {
    const before = Date.now();
    service.info('T', 'ts test');
    const after = Date.now();
    const ts = service.entries()[0].timestamp.getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
