import { Injectable, inject } from '@angular/core';
import { GameLibraryService } from './game-library.service';
import { Game } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly librarySvc = inject(GameLibraryService);
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

  /**
   * Scores and ranks games as potential recommendations.
   *
   * Anchor games (top 25% by hours played, at least 1) define a tag preference
   * profile where each tag is weighted by hours played across anchor games.
   *
   * Candidates are all games with fewer hours than the least-played anchor.
   * Each candidate is scored as: (average normalised tag weight) × (communityScore / 100).
   * Games with no matching tags or zero community score are excluded (score = 0).
   */
  rank(games: Game[]): Game[] {
    const playedGames = games
      .filter(g => g.hoursPlayed > 0)
      .sort((a, b) => b.hoursPlayed - a.hoursPlayed);

    if (playedGames.length === 0) return [];

    const anchorCount = Math.max(1, Math.ceil(playedGames.length * 0.25));
    const anchors = playedGames.slice(0, anchorCount);
    const minAnchorHours = anchors[anchors.length - 1].hoursPlayed;

    // Build tag profile from anchor games, weighted by hours played
    const tagWeights = new Map<string, number>();
    for (const g of anchors) {
      for (const tag of (g.metadata?.tags ?? [])) {
        tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + g.hoursPlayed);
      }
    }

    if (tagWeights.size === 0) return [];

    // Total weight across all tags: used to normalise tag overlap scores
    const totalTagWeight = [...tagWeights.values()].reduce((a, b) => a + b, 0);
    const candidates = games.filter(g => g.hoursPlayed < minAnchorHours);

    const scored = candidates
      .map(g => {
        const tags = g.metadata?.tags ?? [];
        if (tags.length === 0) return { game: g, score: 0 };
        // Sum of anchor-weighted tag hits, normalised to [0, 1]
        const tagScore =
          tags.reduce((sum, tag) => sum + (tagWeights.get(tag) ?? 0), 0) / totalTagWeight;
        const communityFactor = (g.metadata?.communityScore ?? 0) / 100;
        return { game: g, score: tagScore * communityFactor };
      })
      .filter(s => s.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.game);
  }
}
