import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SettingsService, DEFAULT_RECOMMENDATION_CONFIG } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatSliderModule,
    MatTooltipModule,
  ],
  template: `
    <div class="settings-container">
      <h2 class="settings-title">
        <mat-icon>tune</mat-icon>
        Recommendation Settings
      </h2>

      <p class="settings-intro">
        Adjust how tag similarity and community score influence which games are recommended.
        Higher values give that factor more influence on the ranking.
      </p>

      <mat-divider class="divider" />

      <section class="setting-row">
        <div class="setting-label-group">
          <span class="setting-name">
            <mat-icon class="setting-icon">label</mat-icon>
            Tag overlap influence
          </span>
          <span class="setting-value">{{ settingsSvc.settings().tagWeight | number:'1.1-1' }}×</span>
        </div>
        <p class="setting-description">
          How strongly a game's tag similarity with your most-played titles boosts its score.
          Increase to favour games that share more genres with your favourites.
        </p>
        <mat-slider min="0.1" max="3" step="0.1" class="setting-slider"
          [matTooltip]="'Tag influence: ' + (settingsSvc.settings().tagWeight | number:'1.1-1') + '×'"
        >
          <input matSliderThumb
            [value]="settingsSvc.settings().tagWeight"
            (valueChange)="onTagWeightChange($event)"
          />
        </mat-slider>
        <div class="slider-legend">
          <span>Less</span>
          <span>Default (1.0×)</span>
          <span>More</span>
        </div>
      </section>

      <mat-divider class="divider" />

      <section class="setting-row">
        <div class="setting-label-group">
          <span class="setting-name">
            <mat-icon class="setting-icon">thumb_up</mat-icon>
            Community score influence
          </span>
          <span class="setting-value">{{ settingsSvc.settings().scoreWeight | number:'1.1-1' }}×</span>
        </div>
        <p class="setting-description">
          How strongly a game's community review score boosts its recommendation rank.
          Increase to always favour highly-rated games regardless of tag match.
        </p>
        <mat-slider min="0.1" max="3" step="0.1" class="setting-slider"
          [matTooltip]="'Score influence: ' + (settingsSvc.settings().scoreWeight | number:'1.1-1') + '×'"
        >
          <input matSliderThumb
            [value]="settingsSvc.settings().scoreWeight"
            (valueChange)="onScoreWeightChange($event)"
          />
        </mat-slider>
        <div class="slider-legend">
          <span>Less</span>
          <span>Default (1.0×)</span>
          <span>More</span>
        </div>
      </section>

      <mat-divider class="divider" />

      <div class="actions">
        <button mat-stroked-button (click)="reset()" class="reset-btn">
          <mat-icon>restart_alt</mat-icon>
          Reset to defaults
        </button>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .settings-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: 500;
    }
    .settings-intro {
      margin: 0 0 20px;
      color: #aaa;
      font-size: 14px;
      line-height: 1.5;
    }
    .divider { margin: 20px 0; }
    .setting-row { display: flex; flex-direction: column; gap: 8px; }
    .setting-label-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .setting-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 500;
    }
    .setting-icon { font-size: 18px; width: 18px; height: 18px; color: #aaa; }
    .setting-value {
      font-size: 18px;
      font-weight: 700;
      color: #ffd54f;
      min-width: 40px;
      text-align: right;
    }
    .setting-description {
      margin: 0;
      font-size: 13px;
      color: #888;
      line-height: 1.5;
    }
    .setting-slider { width: 100%; }
    .slider-legend {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #555;
      padding: 0 4px;
    }
    .actions { display: flex; justify-content: flex-start; }
    .reset-btn { font-size: 13px; }
  `],
})
export class SettingsComponent {
  protected readonly settingsSvc = inject(SettingsService);
  protected readonly defaults = DEFAULT_RECOMMENDATION_CONFIG;

  onTagWeightChange(value: number): void {
    this.settingsSvc.update({ tagWeight: value });
  }

  onScoreWeightChange(value: number): void {
    this.settingsSvc.update({ scoreWeight: value });
  }

  reset(): void {
    this.settingsSvc.reset();
  }
}
