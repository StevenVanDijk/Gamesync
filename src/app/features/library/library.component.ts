import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameLibraryService } from '../../core/services/game-library.service';
import { StoreConnectionService } from '../../core/services/store-connection.service';
import { GameCardComponent } from '../../shared/components/game-card/game-card.component';
import { Game } from '../../core/models/game.model';

type ViewMode = 'card' | 'compact' | 'list';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    GameCardComponent,
  ],
  template: `
    <div class="library-container">
      <div class="library-header">
        <div class="search-bar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search games…</mat-label>
            <input matInput [(ngModel)]="searchQuery" placeholder="Title, tag, year…" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="sort-field">
            <mat-label>Sort by</mat-label>
            <mat-select [(ngModel)]="sortKey">
              <mat-option value="name">Name</mat-option>
              <mat-option value="hoursPlayed">Hours played</mat-option>
              <mat-option value="year">Year</mat-option>
              <mat-option value="score">Score</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="action-row">
            <button mat-flat-button color="primary" class="sync-btn" (click)="sync()" [disabled]="librarySvc.syncing()">
              <mat-icon>sync</mat-icon>
              Sync
            </button>

            <div class="view-toggle">
              <button
                mat-icon-button
                [class.active]="viewMode() === 'card'"
                (click)="viewMode.set('card')"
                matTooltip="Card view"
                aria-label="Card view"
              >
                <mat-icon>view_module</mat-icon>
              </button>
              <button
                mat-icon-button
                [class.active]="viewMode() === 'compact'"
                (click)="viewMode.set('compact')"
                matTooltip="Compact view"
                aria-label="Compact view"
              >
                <mat-icon>grid_view</mat-icon>
              </button>
              <button
                mat-icon-button
                [class.active]="viewMode() === 'list'"
                (click)="viewMode.set('list')"
                matTooltip="List view"
                aria-label="List view"
              >
                <mat-icon>view_list</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <p class="game-count">{{ filteredGames().length }} game{{ filteredGames().length === 1 ? '' : 's' }}</p>
      </div>

      @if (librarySvc.syncing()) {
        <div class="loading-state">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Syncing library…</p>
        </div>
      } @else if (librarySvc.error()) {
        <div class="empty-state">
          <mat-icon color="warn">error</mat-icon>
          <p>{{ librarySvc.error() }}</p>
        </div>
      } @else if (filteredGames().length === 0 && connectionSvc.connectionCount() === 0) {
        <div class="empty-state">
          <mat-icon>sports_esports</mat-icon>
          <p>No store connections yet.</p>
          <button mat-flat-button color="accent" (click)="goToConnections()">
            Add a connection
          </button>
        </div>
      } @else if (filteredGames().length === 0) {
        <div class="empty-state">
          <mat-icon>search_off</mat-icon>
          <p>No games match your search.</p>
        </div>
      } @else {
        <div class="game-grid"
             [class.compact-grid]="viewMode() === 'compact'"
             [class.list-grid]="viewMode() === 'list'">
          @for (game of filteredGames(); track game.id) {
            <app-game-card
              [game]="game"
              [compact]="viewMode() === 'compact'"
              [list]="viewMode() === 'list'"
              [metadataLoading]="librarySvc.fetchingMetadataIds().has(game.id)"
              [connectionColor]="connectionColorMap().get(game.storeId) ?? 'transparent'"
              (selected)="openGame($event)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .library-container {
      padding: 12px;
      max-width: 1400px;
      margin: 0 auto;
      overflow-x: hidden;
    }
    .library-header { margin-bottom: 12px; }
    .search-bar {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      flex-wrap: wrap;
      /* prevent form fields from overflowing the container */
      min-width: 0;
    }
    .search-field { flex: 1; min-width: 120px; max-width: 100%; }
    .sort-field { width: 130px; max-width: 100%; }

    .action-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .sync-btn { flex-shrink: 0; }

    .view-toggle {
      display: flex;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px;
      overflow: hidden;
    }
    .view-toggle button { border-radius: 0; }
    .view-toggle button.active {
      background: rgba(255,255,255,0.12);
      color: white;
    }

    .game-count { margin: 0 0 8px; font-size: 13px; color: #aaa; }

    /* ── Grid views ── */
    .game-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .compact-grid {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 6px;
    }

    /* ── List view ── */
    .list-grid {
      display: flex;
      flex-direction: column;
      gap: 2px;
      /* override grid-template-columns from .game-grid */
      grid-template-columns: none;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 64px 16px;
      color: #888;
    }
    .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; }

    @media (max-width: 480px) {
      .library-container { padding: 8px; }
      .search-bar { flex-direction: column; align-items: stretch; }
      .search-field, .sort-field { width: 100%; min-width: 0; }
      .action-row { justify-content: space-between; }
      .sync-btn { flex: 1; }
      .game-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .compact-grid { grid-template-columns: repeat(3, 1fr); gap: 5px; }
      .list-grid { gap: 1px; }
    }
  `],
})
export class LibraryComponent implements OnInit {
  protected readonly librarySvc = inject(GameLibraryService);
  protected readonly connectionSvc = inject(StoreConnectionService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  private static readonly CONNECTION_COLORS = [
    '#5c9cf5', // blue
    '#e05c5c', // red
    '#5cbe8a', // green
    '#d4a84b', // amber
    '#b05ce0', // purple
    '#5cc4d4', // teal
  ];

  searchQuery = signal('');
  sortKey = signal<'name' | 'hoursPlayed' | 'year' | 'score'>('name');
  viewMode = signal<ViewMode>('list');

  /** Stable colour per connection ID, assigned in arrival order. */
  readonly connectionColorMap = computed(() => {
    const map = new Map<string, string>();
    this.connectionSvc.connections().forEach((c, i) => {
      map.set(c.id, LibraryComponent.CONNECTION_COLORS[i % LibraryComponent.CONNECTION_COLORS.length]);
    });
    return map;
  });

  filteredGames = computed(() => {
    const q = this.searchQuery().toLowerCase();
    let games = this.librarySvc.games().filter(g => {
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.metadata?.tags?.some(t => t.toLowerCase().includes(q)) ||
        String(g.metadata?.yearPublished ?? '').includes(q)
      );
    });

    const key = this.sortKey();
    games = [...games].sort((a, b) => {
      if (key === 'hoursPlayed') return b.hoursPlayed - a.hoursPlayed;
      if (key === 'year')
        return (b.metadata?.yearPublished ?? 0) - (a.metadata?.yearPublished ?? 0);
      if (key === 'score')
        return (b.metadata?.communityScore ?? 0) - (a.metadata?.communityScore ?? 0);
      return a.name.localeCompare(b.name);
    });
    return games;
  });

  ngOnInit(): void {
    if (this.librarySvc.games().length === 0) {
      this.sync();
    }
  }

  sync(): void {
    this.librarySvc.syncAll().subscribe({
      error: () => this.snackBar.open('Sync failed. Check your connection settings.', 'Dismiss', { duration: 5000 }),
    });
  }

  openGame(game: Game): void {
    this.router.navigate(['/library', game.id]);
  }

  goToConnections(): void {
    this.router.navigate(['/connections']);
  }
}
