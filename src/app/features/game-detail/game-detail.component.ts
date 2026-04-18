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
import { SteamCandidate } from '../../core/models/game.model';

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
            @if (steamStoreUrl()) {
              <a [href]="steamStoreUrl()!" target="_blank" rel="noopener noreferrer" class="hero-image-link">
                <img [src]="game()!.metadata!.imageUrl" [alt]="game()!.name" class="hero-image hero-image--clickable" />
                <div class="hero-image-overlay"><mat-icon>open_in_new</mat-icon></div>
              </a>
            } @else {
              <img [src]="game()!.metadata!.imageUrl" [alt]="game()!.name" class="hero-image" />
            }
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

            @if (game()!.isInstalled !== undefined) {
              <p class="meta-line" [class.installed-yes]="game()!.isInstalled">
                <mat-icon class="inline-icon">{{ game()!.isInstalled ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                {{ game()!.isInstalled ? 'Installed' : 'Not installed' }}
              </p>
            }

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

            @if (!isSteam() && hasCandidates() && !metadataLoading()) {
              <div class="candidates-section">
                <p class="candidates-label">
                  <mat-icon class="inline-icon">search</mat-icon>
                  Select the matching Steam game to load score and metadata:
                </p>
                @for (candidate of game()!.steamCandidates!; track candidate.appId) {
                  <button class="candidate-item" (click)="confirmSteamMatch(candidate)">
                    @if (candidate.imageUrl) {
                      <img [src]="candidate.imageUrl" [alt]="candidate.name" class="candidate-thumb" />
                    }
                    <span>{{ candidate.name }}</span>
                  </button>
                }
              </div>
            }

            @if (!game()!.metadata && !metadataLoading() && !hasCandidates()) {
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
    .hero-image-link {
      display: block;
      position: relative;
      width: 100%;
      max-width: 460px;
      border-radius: 8px;
      overflow: hidden;
      align-self: flex-start;
    }
    .hero-image {
      width: 100%;
      max-width: 460px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      display: block;
    }
    .hero-image--clickable { max-width: 100%; border-radius: 0; }
    .hero-image-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0);
      transition: background 0.2s;
      color: white;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
    }
    .hero-image-overlay mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .hero-image-link:hover .hero-image-overlay {
      opacity: 1;
      background: rgba(0,0,0,0.45);
    }
    .hero-image-link:hover .hero-image--clickable { filter: brightness(0.85); }
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
    .installed-yes { color: #4caf50; }
    .score-section { display: flex; flex-direction: column; gap: 6px; }
    .score-label, .tags-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-bar-row { display: flex; align-items: center; gap: 12px; }
    .score-bar { flex: 1; max-width: 300px; border-radius: 4px; }
    .score-value { font-weight: 700; font-size: 16px; }
    .tags-section { display: flex; flex-direction: column; gap: 6px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .loading-meta { font-size: 13px; color: #888; }
    .no-metadata-note { font-size: 13px; color: #888; margin: 0; }
    .candidates-section { display: flex; flex-direction: column; gap: 8px; }
    .candidates-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #aaa;
      margin: 0;
    }
    .candidate-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      cursor: pointer;
      color: inherit;
      font-size: 14px;
      text-align: left;
      transition: background 0.15s;
    }
    .candidate-item:hover { background: rgba(255,255,255,0.1); }
    .candidate-thumb {
      width: 40px;
      height: 30px;
      object-fit: cover;
      border-radius: 3px;
      flex-shrink: 0;
    }
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

  /** Route param — initialised from snapshot so computed() can use it as a stable dependency. */
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  /** Reactive: auto-updates when the library signal changes (background fetches, candidate updates). */
  protected readonly game = computed(() => this.librarySvc.games().find(g => g.id === this.id));
  protected readonly loading = signal(false);
  protected readonly metadataLoading = signal(false);

  protected readonly isSteam = computed(() =>
    this.connectionSvc.getById(this.game()?.storeId ?? '')?.type === 'steam',
  );

  protected readonly hasCandidates = computed(
    () => (this.game()?.steamCandidates?.length ?? 0) > 0,
  );

  /** Steam store URL when available — for Steam games, or non-Steam games with a confirmed match. */
  protected readonly steamStoreUrl = computed(() => {
    const g = this.game();
    if (!g) return null;
    // Steam game: appId is already the Steam appId
    if (this.isSteam()) return `https://store.steampowered.com/app/${g.appId}/`;
    // Non-Steam game: check for a confirmed Steam match
    const matchedAppId = this.steamApi.getConfirmedMatch(g.id);
    if (matchedAppId) return `https://store.steampowered.com/app/${matchedAppId}/`;
    return null;
  });

  ngOnInit(): void {
    // Auto-fetch Steam metadata if missing (non-Steam is handled by background search)
    if (this.game() && !this.game()!.metadata && this.isSteam()) {
      this.fetchMetadata();
    }
  }

  fetchMetadata(): void {
    const g = this.game();
    if (!g || !this.isSteam()) return;

    this.metadataLoading.set(true);
    this.steamApi.getAppMetadata(g.appId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: metadata => {
        this.librarySvc.updateGameMetadata(g.id, metadata);
        this.metadataLoading.set(false);
      },
      error: () => this.metadataLoading.set(false),
    });
  }

  /** User confirmed a Steam candidate — fetch and apply metadata, store the match permanently. */
  confirmSteamMatch(candidate: SteamCandidate): void {
    const g = this.game();
    if (!g) return;

    this.steamApi.setConfirmedMatch(g.id, candidate.appId);
    this.steamApi.clearCandidates(g.id);
    this.librarySvc.clearGameCandidates(g.id);

    this.metadataLoading.set(true);
    this.steamApi.getAppMetadata(candidate.appId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: metadata => {
        this.librarySvc.updateGameMetadata(g.id, metadata);
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
