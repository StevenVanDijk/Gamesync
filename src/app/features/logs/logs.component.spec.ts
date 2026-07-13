import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { LogsComponent } from './logs.component';
import { LoggingService, LogEntry } from '../../core/services/logging.service';

const ENTRY_INFO: LogEntry = {
  id: 1, timestamp: new Date('2025-01-01T10:00:00Z'), level: 'info', tag: 'Steam', message: 'Sync started',
};
const ENTRY_WARN: LogEntry = {
  id: 2, timestamp: new Date('2025-01-01T10:01:00Z'), level: 'warn', tag: 'Cache', message: 'Stale entry',
};
const ENTRY_ERROR: LogEntry = {
  id: 3, timestamp: new Date('2025-01-01T10:02:00Z'), level: 'error', tag: 'GOG', message: 'Auth failed',
};

describe('LogsComponent (US-013)', () => {
  let fixture: ComponentFixture<LogsComponent>;
  let logger: any;

  async function createComponent(entries: LogEntry[]) {
    logger = {
      entries: signal(entries),
      unseenErrors: signal(0),
      markAllSeen: vi.fn(),
      clear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LogsComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: LoggingService, useValue: logger },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LogsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should call markAllSeen on init (US-013 unseen badge reset)', async () => {
    await createComponent([]);
    expect(logger.markAllSeen).toHaveBeenCalled();
  });

  it('should show empty state when no log entries exist (US-013)', async () => {
    await createComponent([]);
    expect(fixture.nativeElement.textContent).toContain('No log entries yet');
  });

  it('should display all log entries with timestamp, level, tag, and message (US-013)', async () => {
    await createComponent([ENTRY_INFO, ENTRY_WARN, ENTRY_ERROR]);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sync started');
    expect(text).toContain('Stale entry');
    expect(text).toContain('Auth failed');
    expect(text).toContain('Steam');
    expect(text).toContain('Cache');
    expect(text).toContain('GOG');
    expect(text).toContain('info');
    expect(text).toContain('warn');
    expect(text).toContain('error');
  });

  it('should apply level CSS classes for visual distinction (US-013)', async () => {
    await createComponent([ENTRY_INFO, ENTRY_WARN, ENTRY_ERROR]);
    const entries = fixture.nativeElement.querySelectorAll('.log-entry');
    expect(entries.length).toBe(3);
    expect(entries[0].classList.contains('level-info')).toBe(true);
    expect(entries[1].classList.contains('level-warn')).toBe(true);
    expect(entries[2].classList.contains('level-error')).toBe(true);
  });

  it('should show entry count in header (US-013)', async () => {
    await createComponent([ENTRY_INFO, ENTRY_WARN]);
    expect(fixture.nativeElement.textContent).toContain('2 entries');
  });

  it('should show singular "entry" for one log entry (US-013)', async () => {
    await createComponent([ENTRY_INFO]);
    expect(fixture.nativeElement.textContent).toContain('1 entry');
  });

  it('should call clear when the clear button is clicked (US-013)', async () => {
    await createComponent([ENTRY_INFO]);
    const btn = fixture.nativeElement.querySelector('button[matTooltip="Clear all logs"]');
    expect(btn).toBeTruthy();
    btn.click();
    expect(logger.clear).toHaveBeenCalled();
  });

  it('should disable the clear button when there are no entries (US-013)', async () => {
    await createComponent([]);
    const btn = fixture.nativeElement.querySelector('button[matTooltip="Clear all logs"]');
    expect(btn.disabled).toBe(true);
  });

  it('should render the log list with aria-live polite (US-013)', async () => {
    await createComponent([ENTRY_INFO]);
    const list = fixture.nativeElement.querySelector('[role="log"]');
    expect(list).toBeTruthy();
    expect(list.getAttribute('aria-live')).toBe('polite');
  });
});
