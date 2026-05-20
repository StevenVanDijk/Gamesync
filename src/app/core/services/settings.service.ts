import { Injectable, signal } from '@angular/core';

export interface RecommendationConfig {
  /** Exponent applied to the tag-overlap score. Range [0.1, 3.0], default 1.0. */
  tagWeight: number;
  /** Exponent applied to the community-score factor. Range [0.1, 3.0], default 1.0. */
  scoreWeight: number;
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  tagWeight: 1.0,
  scoreWeight: 1.0,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'gamesync_settings';

  private readonly _settings = signal<RecommendationConfig>(this.load());
  readonly settings = this._settings.asReadonly();

  update(patch: Partial<RecommendationConfig>): void {
    this._settings.update(s => ({ ...s, ...patch }));
    this.save();
  }

  reset(): void {
    this._settings.set({ ...DEFAULT_RECOMMENDATION_CONFIG });
    this.save();
  }

  private load(): RecommendationConfig {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return { ...DEFAULT_RECOMMENDATION_CONFIG, ...JSON.parse(raw) };
    } catch {
      // ignore parse errors
    }
    return { ...DEFAULT_RECOMMENDATION_CONFIG };
  }

  private save(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._settings()));
    } catch {
      // localStorage may be full
    }
  }
}
