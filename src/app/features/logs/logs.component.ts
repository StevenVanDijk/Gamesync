import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoggingService, LogEntry } from '../../core/services/logging.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="logs-container">
      <div class="logs-header">
        <h2>Sync Logs</h2>
        <div class="header-actions">
          <span class="entry-count">{{ logger.entries().length }} entr{{ logger.entries().length === 1 ? 'y' : 'ies' }}</span>
          <button
            mat-icon-button
            matTooltip="Clear all logs"
            (click)="logger.clear()"
            [disabled]="logger.entries().length === 0"
          >
            <mat-icon>delete_sweep</mat-icon>
          </button>
        </div>
      </div>

      @if (logger.entries().length === 0) {
        <div class="empty-state">
          <mat-icon>receipt_long</mat-icon>
          <p>No log entries yet. Trigger a sync to see activity here.</p>
        </div>
      } @else {
        <div class="log-list" role="log" aria-live="polite" aria-label="Sync log entries">
          @for (entry of logger.entries(); track entry.id) {
            <div class="log-entry" [class]="'level-' + entry.level">
              <span class="entry-time">{{ entry.timestamp | date:'HH:mm:ss' }}</span>
              <span class="entry-badge" [class]="'badge-' + entry.level">{{ entry.level }}</span>
              <span class="entry-tag">[{{ entry.tag }}]</span>
              <span class="entry-msg">{{ entry.message }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .logs-container {
      padding: 16px;
      max-width: 900px;
      margin: 0 auto;
      font-family: 'Roboto Mono', 'Courier New', monospace;
    }

    .logs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-family: Roboto, sans-serif;
    }

    h2 { margin: 0; }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .entry-count {
      font-size: 12px;
      color: #888;
      font-family: Roboto, sans-serif;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 64px 16px;
      color: #888;
      font-family: Roboto, sans-serif;
    }

    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }

    .log-list {
      display: flex;
      flex-direction: column;
      gap: 1px;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      overflow: hidden;
      background: #1a1a1a;
    }

    .log-entry {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 5px 10px;
      font-size: 13px;
      line-height: 1.5;
      background: #1e1e1e;
      border-left: 3px solid transparent;
      word-break: break-word;
    }

    .log-entry:nth-child(even) { background: #1a1a1a; }

    .level-warn  { border-left-color: #ffa726; }
    .level-error { border-left-color: #ef5350; background: #2a1a1a !important; }

    .entry-time {
      color: #666;
      white-space: nowrap;
      flex-shrink: 0;
      font-size: 11px;
    }

    .entry-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 1px 5px;
      border-radius: 3px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .badge-info  { background: #1565c0; color: #90caf9; }
    .badge-warn  { background: #e65100; color: #ffcc80; }
    .badge-error { background: #b71c1c; color: #ef9a9a; }

    .entry-tag {
      color: #888;
      white-space: nowrap;
      flex-shrink: 0;
      font-size: 12px;
    }

    .entry-msg {
      color: #ddd;
      flex: 1;
    }

    .level-warn  .entry-msg { color: #ffcc80; }
    .level-error .entry-msg { color: #ef9a9a; }

    @media (max-width: 480px) {
      .logs-container { padding: 8px; }
      .log-entry { font-size: 11px; gap: 5px; padding: 4px 8px; }
      .entry-time { display: none; }
    }
  `],
})
export class LogsComponent implements OnInit {
  protected readonly logger = inject(LoggingService);

  ngOnInit(): void {
    this.logger.markAllSeen();
  }
}
