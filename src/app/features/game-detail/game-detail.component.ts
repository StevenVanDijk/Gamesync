import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { GameLibraryService } from '../../core/services/game-library.service';
import { SteamApiService } from '../../core/services/steam-api.service';
import { StoreConnectionService } from '../../core/services/store-connection.service';
import { Game } from '../../core/models/game.model';
import { SteamConnectionConfig } from '../../core/models/store-connection.model';

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatDividerModule,
  ],
  template: `
    <div class="detail-container">
      <button mat-button (click)="back()" class="back-btn">
        <mat-icon>arrow_back</mat-icon> Library
      </button>

      @if (loading()) {
        <div class="loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else if (!game()) {
        <div class="not-found">
          <mat-icon>search_off</mat-icon>
          <p>Game not found.</p>
        </div>
      } @else {
        <div class="detail-hero">
          @if (game()!.metadata?.imageUrl) {
            <img [src]="game()!.metadata!.imageUrl" [alt]="game()!.name" class="hero-image" />
          }
          <div class="hero-info">
            <h1>{{ game()!.name }}</h1>

            @if (game()!.metadata?.yearPublished) {
              <p class="meta-line">
                <mat-icon class="inline-icon">calendar_today</mat-icon>
                {{ game()!.metadata!.yearPublished }}
              </p>
            }

            <p class="meta-line">
              <mat-icon class="inline-icon">schedule</mat-icon>
              {{ game()!.hoursPlayed | number:'1.0-1' }} hours played
            </p>

            @if (game()!.metadata?.communityScore !== undefined) {
              <div class="score-section">
                <span class="score-label">Community score</span>
                <div class="score-bar-row">
                  <mat-progress-bar
                    mode="determinate"
                    [value]="game()?.metadata?.communityScore ?? 0"
                    [color]="scoreColor(game()?.metadata?.communityScore ?? 0)"
                    class="score-bar"
                  ></mat-progress-bar>
                  <span class="score-value">{{ game()?.metadata?.communityScore }}%</span>
                </div>
              </div>
            }

            @if (game()!.metadata?.tags?.length) {
              <div class="tags-section">
                <span class="tags-label">Tags</span>
                <div class="tags">
                  @for (tag of game()!.metadata!.tags!; track tag) {
                    <mat-chip>{{ tag }}</mat-chip>
                  }
                </div>
              </div>
            }

            @if (metadataLoading()) {
              <p class="loading-meta">Fetching metadata…</p>
            }

            @if (!game()!.metadata && !metadataLoading()) {
              @if (isSteam()) {
                <button mat-stroked-button (click)="fetchMetadata()">
                  <mat-icon>download</mat-icon>
                  Load metadata from Steam
                </button>
              } @else {
                <p class="no-metadata-note">No Steam metadata available for this game.</p>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-container { padding: 16px; max-width: 960px; margin: 0 auto; }
    .back-btn { margin-bottom: 16px; }
    .loading, .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 64px 16px;
      color: #888;
    }
    .not-found mat-icon { font-size: 56px; width: 56px; height: 56px; }
    .detail-hero { display: flex; flex-direction: column; gap: 24px; }
    .hero-image {
      width: 100%;
      max-width: 460px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .hero-info { display: flex; flex-direction: column; gap: 12px; }
    h1 { margin: 0; font-size: 28px; }
    .meta-line {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      color: #ccc;
      font-size: 14px;
    }
    .inline-icon { font-size: 16px; width: 16px; height: 16px; }
    .score-section { display: flex; flex-direction: column; gap: 6px; }
    .score-label, .tags-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-bar-row { display: flex; align-items: center; gap: 12px; }
    .score-bar { flex: 1; max-width: 300px; border-radius: 4px; }
    .score-value { font-weight: 700; font-size: 16px; }
    .tags-section { display: flex; flex-direction: column; gap: 6px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .loading-meta { font-size: 13px; color: #888; }
    .no-metadata-note { font-size: 13px; color: #888; margin: 0; }
    @media (min-width: 600px) {
      .detail-hero { flex-direction: row; }
      .hero-image { max-width: 460px; align-self: flex-start; }
    }
  `],
})
export class GameDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly librarySvc = inject(GameLibraryService);
  private readonly steamApi = inject(SteamApiService);
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly game = signal<Game | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly metadataLoading = signal(false);
  protected readonly isSteam = computed(() => {
    const g = this.game();
    if (!g) return false;
    return this.connectionSvc.getById(g.storeId)?.type === 'steam';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.game.set(this.librarySvc.getById(id));
    this.loading.set(false);

    // Auto-fetch metadata if missing and game belongs to Steam
    if (this.game() && !this.game()!.metadata) {
      this.fetchMetadata();
    }
  }

  fetchMetadata(): void {
    const g = this.game();
    if (!g) return;

    const conn = this.connectionSvc.getById(g.storeId);
    if (conn?.type !== 'steam') return;

    this.metadataLoading.set(true);
    this.steamApi.getAppMetadata(g.appId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: metadata => {
        this.librarySvc.updateGameMetadata(g.id, metadata);
        this.game.update(current => current ? { ...current, metadata } : current);
        this.metadataLoading.set(false);
      },
      error: () => this.metadataLoading.set(false),
    });
  }

  scoreColor(score: number): 'primary' | 'accent' | 'warn' {
    if (score >= 70) return 'primary';
    if (score >= 40) return 'accent';
    return 'warn';
  }

  back(): void {
    this.router.navigate(['/library']);
  }
}
