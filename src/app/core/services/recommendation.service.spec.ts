import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RecommendationService } from './recommendation.service';
import { GameLibraryService } from './game-library.service';
import { SettingsService } from './settings.service';
import { Game } from '../models/game.model';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGame(id: string, hours: number, tags: string[] = [], score?: number): Game {
  return {
    id,
    appId: id,
    storeId: 's1',
    name: id,
    hoursPlayed: hours,
    metadata: tags.length > 0 || score !== undefined
      ? { tags, communityScore: score }
      : undefined,
  };
}

function makeService(
  games: Game[],
  tagWeight = 1.0,
  scoreWeight = 1.0,
): RecommendationService {
  const gamesSignal = signal(games);
  const settingsSignal = signal({ tagWeight, scoreWeight });
  TestBed.configureTestingModule({
    providers: [
      RecommendationService,
      { provide: GameLibraryService, useValue: { games: gamesSignal.asReadonly() } },
      { provide: SettingsService, useValue: { settings: settingsSignal.asReadonly() } },
    ],
  });
  return TestBed.inject(RecommendationService);
}

// ── rank() ─────────────────────────────────────────────────────────────────

describe('RecommendationService.rank() (US-031)', () => {
  it('returns empty when library has fewer than 2 played games', () => {
    const svc = makeService([]);
    expect(svc.rank([])).toEqual([]);
    expect(svc.rank([makeGame('a', 100, ['Strategy'])])).toEqual([]);
  });

  it('returns empty when no games have been played', () => {
    const svc = makeService([]);
    const games = [
      makeGame('a', 0, ['Strategy'], 80),
      makeGame('b', 0, ['Strategy'], 90),
    ];
    expect(svc.rank(games)).toEqual([]);
  });

  it('excludes games with no matching tags', () => {
    const svc = makeService([]);
    const games = [
      makeGame('rimworld', 2000, ['Simulation', 'Strategy']),
      makeGame('noTags', 0, [], 80),
      makeGame('noOverlap', 0, ['Puzzle'], 85),
    ];
    const result = svc.rank(games);
    expect(result.every(g => g.id !== 'noTags')).toBe(true);
    expect(result.every(g => g.id !== 'noOverlap')).toBe(true);
  });

  it('excludes games with zero community score', () => {
    const svc = makeService([]);
    const games = [
      makeGame('rimworld', 2000, ['Strategy']),
      makeGame('noScore', 0, ['Strategy'], 0),
    ];
    expect(svc.rank(games)).toEqual([]);
  });

  it('ranks a higher community score above a lower one with identical tags', () => {
    const svc = makeService([]);
    const games = [
      makeGame('rimworld', 2000, ['Simulation', 'Strategy']),
      makeGame('frozenheim', 0, ['Simulation', 'Strategy'], 70),
      makeGame('frostpunk', 0, ['Simulation', 'Strategy'], 92),
    ];
    const result = svc.rank(games);
    expect(result[0].id).toBe('frostpunk');
    expect(result[1].id).toBe('frozenheim');
  });

  it('ranks a game with more matching tags above one with fewer (same community score)', () => {
    const svc = makeService([]);
    const games = [
      makeGame('rimworld', 2000, ['Simulation', 'Strategy', 'Colony']),
      makeGame('singleTag', 0, ['Strategy'], 80),
      makeGame('twoTags', 0, ['Simulation', 'Strategy'], 80),
    ];
    const result = svc.rank(games);
    expect(result[0].id).toBe('twoTags');
  });

  it('does not include the anchor game itself as a candidate', () => {
    const svc = makeService([]);
    const anchor = makeGame('rimworld', 2000, ['Simulation', 'Strategy'], 95);
    const candidate = makeGame('frozenheim', 0, ['Simulation', 'Strategy'], 80);
    const result = svc.rank([anchor, candidate]);
    expect(result.every(g => g.id !== 'rimworld')).toBe(true);
  });

  it('uses at most 10% of played games as anchors (capped at 50)', () => {
    // 10 played games → ceil(10 * 0.10) = 1 anchor = only the top game
    const games = [
      makeGame('top', 1000, ['Strategy']),
      ...Array.from({ length: 9 }, (_, i) => makeGame(`p${i}`, 100 - i * 5, ['Action'])),
      makeGame('candidate', 0, ['Strategy'], 80),
    ];
    const svc = makeService(games);
    const result = svc.rank(games);
    // candidate has the anchor's tag → should be recommended
    expect(result.some(g => g.id === 'candidate')).toBe(true);
  });

  it('considers multiple anchor games when 10% gives ≥ 2', () => {
    // 20 played games → ceil(20 * 0.10) = 2 anchors
    const played = [
      makeGame('a1', 2000, ['Strategy', 'Simulation']),
      makeGame('a2', 1500, ['RPG', 'Strategy']),
      ...Array.from({ length: 18 }, (_, i) => makeGame(`p${i}`, i + 1, ['Other'])),
    ];
    const games = [...played, makeGame('candidate', 0, ['Strategy', 'RPG'], 85)];
    const svc = makeService(games);
    const result = svc.rank(games);
    // candidate has Strategy (from a1) and RPG (from a2) — both anchors contribute
    expect(result.some(g => g.id === 'candidate')).toBe(true);
  });

  it('default weights rank a game with full tag match above a partial match with higher score', () => {
    const games = [
      makeGame('anchor', 2000, ['Strategy', 'Sim']),
      makeGame('highTag', 0, ['Strategy', 'Sim'], 60),   // tag match = 1.0, score = 0.60
      makeGame('highScore', 0, ['Strategy'], 90),         // tag match = 0.5, score = 0.90
    ];
    // tagScore=1.0 * communityFactor=0.60 = 0.60 vs tagScore=0.5 * communityFactor=0.90 = 0.45
    const svc = makeService(games);
    expect(svc.rank(games)[0].id).toBe('highTag');
  });

  it('elevated tagWeight further boosts games with stronger tag overlap', () => {
    const games = [
      makeGame('anchor', 2000, ['Strategy', 'Sim']),
      makeGame('highTag', 0, ['Strategy', 'Sim'], 60),
      makeGame('highScore', 0, ['Strategy'], 90),
    ];
    // tagWeight=2: highTag = 1.0^2 * 0.60 = 0.60, highScore = 0.5^2 * 0.90 = 0.225
    const svc = makeService(games, 2.0, 1.0);
    expect(svc.rank(games)[0].id).toBe('highTag');
  });

  it('higher scoreWeight boosts high-community-score games', () => {
    const games = [
      makeGame('anchor', 2000, ['Strategy']),
      makeGame('lowScore', 0, ['Strategy'], 50),
      makeGame('highScore', 0, ['Strategy'], 90),
    ];
    const svc = makeService(games, 1.0, 2.0);
    // With scoreWeight=2: lowScore=1*0.25=0.25, highScore=1*0.81=0.81
    expect(svc.rank(games)[0].id).toBe('highScore');
  });
});

// ── getTagProfile() ─────────────────────────────────────────────────────────

describe('RecommendationService.getTagProfile() (US-032)', () => {
  it('returns empty map when library has no played games', () => {
    const svc = makeService([makeGame('a', 0, ['Strategy'])]);
    expect(svc.getTagProfile().size).toBe(0);
  });

  it('returns normalised weights for anchor game tags', () => {
    const games = [
      makeGame('rimworld', 2000, ['Simulation', 'Strategy']),
      makeGame('frozenheim', 0, ['Simulation', 'Strategy'], 70),
    ];
    const svc = makeService(games);
    const profile = svc.getTagProfile();
    expect(profile.has('Simulation')).toBe(true);
    expect(profile.has('Strategy')).toBe(true);
    // Both tags have equal weight from the same anchor → 0.5 each
    expect(profile.get('Simulation')).toBeCloseTo(0.5);
    expect(profile.get('Strategy')).toBeCloseTo(0.5);
  });

  it('does not include tags not present in anchor games', () => {
    const games = [
      makeGame('anchor', 500, ['Strategy']),
      makeGame('candidate', 0, ['RPG'], 80),
    ];
    const svc = makeService(games);
    const profile = svc.getTagProfile();
    expect(profile.has('RPG')).toBe(false);
  });
});

// ── markVisited() ────────────────────────────────────────────────────────────

describe('RecommendationService.markVisited() (US-031)', () => {
  it('prevents the marked game from being recommended next', () => {
    const games = [
      makeGame('anchor', 2000, ['Strategy']),
      makeGame('g1', 0, ['Strategy'], 90),
      makeGame('g2', 0, ['Strategy'], 80),
    ];
    const svc = makeService(games);
    svc.markVisited('g1'); // pre-mark g1 so it's skipped
    const pick = svc.next();
    expect(pick?.id).toBe('g2');
  });
});

// ── next() ─────────────────────────────────────────────────────────────────

describe('RecommendationService.next() (US-031)', () => {
  it('returns null when no recommendations exist', () => {
    const svc = makeService([makeGame('a', 0), makeGame('b', 0)]);
    expect(svc.next()).toBeNull();
  });

  it('returns the top-ranked candidate on first call', () => {
    const svc = makeService([
      makeGame('rimworld', 2000, ['Simulation', 'Strategy']),
      makeGame('frostpunk', 0, ['Simulation', 'Strategy'], 92),
      makeGame('frozenheim', 0, ['Simulation', 'Strategy'], 70),
    ]);
    expect(svc.next()?.id).toBe('frostpunk');
  });

  it('returns a different game on the second call', () => {
    const games = [
      makeGame('rimworld', 2000, ['Simulation', 'Strategy']),
      makeGame('frostpunk', 0, ['Simulation', 'Strategy'], 92),
      makeGame('frozenheim', 0, ['Simulation', 'Strategy'], 70),
    ];
    const svc = makeService(games);
    const first = svc.next();
    const second = svc.next();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.id).not.toBe(second!.id);
  });

  it('resets the cycle after all candidates have been visited', () => {
    const games = [
      makeGame('rimworld', 2000, ['Simulation', 'Strategy']),
      makeGame('frostpunk', 0, ['Simulation', 'Strategy'], 92),
    ];
    const svc = makeService(games);
    const first = svc.next()!;
    const second = svc.next()!; // exhausts list, resets
    expect(second.id).toBe(first.id);
  });

  it('marks each returned game as visited so it is not immediately repeated', () => {
    const games = [
      makeGame('rimworld', 2000, ['Strategy']),
      makeGame('g1', 0, ['Strategy'], 90),
      makeGame('g2', 0, ['Strategy'], 80),
      makeGame('g3', 0, ['Strategy'], 70),
    ];
    const svc = makeService(games);
    const seen = new Set([svc.next()!.id, svc.next()!.id, svc.next()!.id]);
    expect(seen.size).toBe(3);
  });

  it('does not return the game pre-marked with markVisited until reset', () => {
    const games = [
      makeGame('anchor', 2000, ['Strategy']),
      makeGame('top', 0, ['Strategy'], 95),
      makeGame('mid', 0, ['Strategy'], 80),
    ];
    const svc = makeService(games);
    svc.markVisited('top');
    expect(svc.next()?.id).toBe('mid');
  });
});
