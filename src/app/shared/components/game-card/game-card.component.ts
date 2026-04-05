import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Game } from '../../../core/models/game.model';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatIconModule, MatTooltipModule],
  template: `
    <mat-card class="game-card" [class.compact]="compact()" (click)="selected.emit(game())">
      <div class="card-image-wrapper">
        @if (game().metadata?.imageUrl) {
          <img
            [src]="game().metadata?.imageUrl"
            [alt]="game().name"
            class="card-image"
          />
        } @else {
          <div class="card-image-placeholder">
            <mat-icon>sports_esports</mat-icon>
          </div>
        }
        @if (game().metadata?.communityScore !== undefined) {
          <span
            class="score-badge"
            [class.score-positive]="(game().metadata?.communityScore ?? 0) >= 70"
            [class.score-mixed]="(game().metadata?.communityScore ?? 0) >= 40 && (game().metadata?.communityScore ?? 0) < 70"
            [class.score-negative]="(game().metadata?.communityScore ?? 0) < 40"
            [matTooltip]="'Community score: ' + (game().metadata?.communityScore ?? 0) + '%'"
          >
            {{ game().metadata?.communityScore }}%
          </span>
        }
      </div>
      <mat-card-content>
        <h3 class="game-title" [title]="game().name">{{ game().name }}</h3>
        <p class="hours-played">
          <mat-icon class="inline-icon">schedule</mat-icon>
          {{ game().hoursPlayed | number:'1.0-1' }} hrs
        </p>
        @if (!compact()) {
          @if (game().metadata?.yearPublished) {
            <p class="year">{{ game().metadata?.yearPublished }}</p>
          }
          @if (game().metadata?.tags?.length) {
            <div class="tags">
              @for (tag of (game().metadata?.tags ?? []).slice(0, 3); track tag) {
                <mat-chip class="tag-chip">{{ tag }}</mat-chip>
              }
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .game-card {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .game-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }

    /* ── Card (default) image area ── */
    .card-image-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 460 / 215;
      overflow: hidden;
      background: #1a1a2e;
    }
    .compact .card-image-wrapper {
      aspect-ratio: unset;
      height: 64px;
    }

    .card-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .card-image-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a2e;
      color: #555;
    }
    .card-image-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }
    .compact .card-image-placeholder mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .score-badge {
      position: absolute;
      bottom: 4px;
      right: 4px;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: #fff;
    }
    .score-positive { background: #4caf50; }
    .score-mixed    { background: #ff9800; }
    .score-negative { background: #f44336; }

    mat-card-content { padding-top: 6px; flex: 1; }
    .compact mat-card-content { padding: 4px 8px 6px; }

    .game-title {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .compact .game-title {
      font-size: 12px;
      margin-bottom: 2px;
    }

    .hours-played {
      margin: 0 0 2px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
      color: #aaa;
    }
    .compact .hours-played { font-size: 11px; }

    .year {
      margin: 0 0 4px;
      font-size: 11px;
      color: #888;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .tag-chip {
      font-size: 10px;
      height: 20px;
      min-height: 20px;
    }
    .inline-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      vertical-align: middle;
    }
  `],
})
export class GameCardComponent {
  game = input.required<Game>();
  selected = output<Game>();
  compact = input(false);
}
