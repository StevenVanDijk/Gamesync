import { Injectable, signal } from '@angular/core';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  tag: string;
  message: string;
}

const MAX_ENTRIES = 10_000;

@Injectable({ providedIn: 'root' })
export class LoggingService {
  private counter = 0;
  private readonly _entries = signal<LogEntry[]>([]);
  private readonly _unseenErrors = signal(0);

  readonly entries = this._entries.asReadonly();
  /** Count of error entries added since the user last viewed the Logs screen. */
  readonly unseenErrors = this._unseenErrors.asReadonly();

  info(tag: string, message: string): void {
    console.log(`[${tag}] ${message}`);
    this.push('info', tag, message);
  }

  warn(tag: string, message: string): void {
    console.warn(`[${tag}] ${message}`);
    this.push('warn', tag, message);
  }

  error(tag: string, message: string, detail?: unknown): void {
    if (detail !== undefined) {
      console.error(`[${tag}] ${message}`, detail);
    } else {
      console.error(`[${tag}] ${message}`);
    }
    this.push('error', tag, message);
    this._unseenErrors.update(n => n + 1);
  }

  /** Call when the user opens the Logs screen to reset the unseen badge. */
  markAllSeen(): void {
    this._unseenErrors.set(0);
  }

  clear(): void {
    this._entries.set([]);
    this._unseenErrors.set(0);
  }

  private push(level: LogLevel, tag: string, message: string): void {
    const entry: LogEntry = {
      id: ++this.counter,
      timestamp: new Date(),
      level,
      tag,
      message,
    };
    this._entries.update(list => {
      const updated = [entry, ...list];
      return updated.length > MAX_ENTRIES ? updated.slice(0, MAX_ENTRIES) : updated;
    });
  }
}
