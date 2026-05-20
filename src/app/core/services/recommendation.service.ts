import { Injectable, inject } from '@angular/core';
import { GameLibraryService } from './game-library.service';
import { SettingsService } from './settings.service';
import { Game } from '../models/game.model';

interface AnchorProfile {
  /** Hours-weighted tag frequencies from anchor games. */
  tagWeights: Map<string, number>;
  /** Sum of all values in tagWeights (used for normalisation). */
  totalTagWeight: number;
  /** Hours of the least-played anchor game — candidates must be below this. */
  minAnchorHours: number;
}

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly librarySvc = inject(GameLibraryService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly visited = new Set<string>();

  /**
   * Returns the next recommended game that hasn't been visited via this feature yet.
   * When all candidates have been visited the cycle resets automatically.
   * Returns null when no qualifying candidates exist.
   */
  next(): Game | null {
    const ranked = this.rank(this.librarySvc.games());

    let unvisited = ranked.filter(g => !this.visited.has(g.id));
    if (unvisited.length === 0 && ranked.length > 0) {
      this.visited.clear();
      unvisited = ranked;
    }

    if (unvisited.length === 0) return null;
    const pick = unvisited[0];
    this.visited.add(pick.id);
    return pick;
  }

  /** Explicitly mark a game as visited so it is skipped in the next cycle. */
  markVisited(id: string): void {
    this.visited.add(id);
  }

  /**
   * Returns a normalised map of tag → weight [0, 1] built from the current
   * anchor games. Used by the detail view to highlight contributing tags.
   */
  getTagProfile(): Map<string, number> {
    const { tagWeights, totalTagWeight } = this.buildProfile(this.librarySvc.games());
    if (totalTagWeight === 0) return new Map();
    const result = new Map<string, number>();
    for (const [tag, w] of tagWeights) {
      result.set(tag, w / totalTagWeight);
    }
    return result;
  }

  /**
   * Scores and ranks games as potential recommendations.
   *
   * Anchor games — top 10% of played games by hours (at least 1, capped at 50) —
   * define a tag preference profile.  Candidates are games with fewer hours than
   * the least-played anchor.
   *
   * Scoring (both factors must be > 0):
   *   score = tagScore^tagWeight × communityFactor^scoreWeight
   *
   * where tagWeight and scoreWeight come from SettingsService (default 1.0 each).
   */
  rank(games: Game[]): Game[] {
    const { tagWeights, totalTagWeight, minAnchorHours } = this.buildProfile(games);
    if (totalTagWeight === 0) return [];

    const { tagWeight, scoreWeight } = this.settingsSvc.settings();
    const candidates = games.filter(g => g.hoursPlayed < minAnchorHours);

    const scored = candidates
      .map(g => {
        const tags = g.metadata?.tags ?? [];
        if (tags.length === 0) return { game: g, score: 0 };
        const tagScore =
          tags.reduce((sum, tag) => sum + (tagWeights.get(tag) ?? 0), 0) / totalTagWeight;
        const communityFactor = (g.metadata?.communityScore ?? 0) / 100;
        if (tagScore <= 0 || communityFactor <= 0) return { game: g, score: 0 };
        return {
          game: g,
          score: Math.pow(tagScore, tagWeight) * Math.pow(communityFactor, scoreWeight),
        };
      })
      .filter(s => s.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.game);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildProfile(games: Game[]): AnchorProfile {
    const playedGames = games
      .filter(g => g.hoursPlayed > 0)
      .sort((a, b) => b.hoursPlayed - a.hoursPlayed);

    if (playedGames.length === 0) {
      return { tagWeights: new Map(), totalTagWeight: 0, minAnchorHours: 0 };
    }

    // Top 10% of played games, at least 1, capped at 50
    const anchorCount = Math.min(Math.max(1, Math.ceil(playedGames.length * 0.10)), 50);
    const anchors = playedGames.slice(0, anchorCount);
    const minAnchorHours = anchors[anchors.length - 1].hoursPlayed;

    const tagWeights = new Map<string, number>();
    for (const g of anchors) {
      for (const tag of (g.metadata?.tags ?? [])) {
        tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + g.hoursPlayed);
      }
    }
    const totalTagWeight = [...tagWeights.values()].reduce((a, b) => a + b, 0);

    return { tagWeights, totalTagWeight, minAnchorHours };
  }
}
