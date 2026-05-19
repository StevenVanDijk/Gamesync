import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RecommendationService } from './recommendation.service';
import { GameLibraryService } from './game-library.service';
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

function makeService(games: Game[]): RecommendationService {
  const gamesSignal = signal(games);
  TestBed.configureTestingModule({
    providers: [
      RecommendationService,
      {
        provide: GameLibraryService,
        useValue: { games: gamesSignal.asReadonly() },
      },
    ],
  });
  return TestBed.inject(RecommendationService);
}

// ── rank() ─────────────────────────────────────────────────────────────────

describe('RecommendationService.rank() (US-031)', () => {
  it('returns empty when library has fewer than 2 games', () => {
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
      makeGame('frozenheim', 0, [], 80),         // no tags
      makeGame('city', 0, ['Puzzle'], 85),        // no overlap
    ];
    const result = svc.rank(games);
    expect(result.every(g => g.id !== 'frozenheim')).toBe(true);
    expect(result.every(g => g.id !== 'city')).toBe(true);
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

  it('ranks a game with more matching tags above one with fewer (same score)', () => {
    const svc = makeService([]);
    const games = [
      makeGame('rimworld', 2000, ['Simulation', 'Strategy', 'Colony']),
      makeGame('singleTag', 0, ['Strategy'], 80),
      makeGame('twoTags', 0, ['Simulation', 'Strategy'], 80),
    ];
    const result = svc.rank(games);
    // twoTags has higher average tag weight (both tags present vs only one)
    expect(result[0].id).toBe('twoTags');
  });

  it('does not include the anchor game itself as a candidate', () => {
    const svc = makeService([]);
    const anchor = makeGame('rimworld', 2000, ['Simulation', 'Strategy'], 95);
    const candidate = makeGame('frozenheim', 0, ['Simulation', 'Strategy'], 80);
    const result = svc.rank([anchor, candidate]);
    expect(result.every(g => g.id !== 'rimworld')).toBe(true);
  });

  it('considers multiple anchor games for the tag profile', () => {
    const svc = makeService([]);
    // Two anchor games (top 25% of 8 = 2 anchors)
    const games = [
      makeGame('a1', 2000, ['Strategy', 'Simulation']),
      makeGame('a2', 1500, ['RPG', 'Strategy']),
      makeGame('b1', 50, ['RPG'], 5),   // not enough hours to be anchor
      makeGame('b2', 40, ['RPG'], 6),
      makeGame('b3', 30, ['RPG'], 7),
      makeGame('b4', 20, ['RPG'], 8),
      makeGame('b5', 10, ['RPG'], 9),
      makeGame('candidate', 0, ['Strategy', 'RPG'], 85),
    ];
    const result = svc.rank(games);
    // candidate has Strategy (from both anchors) and RPG (from a2) — should be recommended
    expect(result.some(g => g.id === 'candidate')).toBe(true);
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
    // Second call exhausts the list and resets
    const second = svc.next()!;
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
    const seen = new Set<string>();
    seen.add(svc.next()!.id);
    seen.add(svc.next()!.id);
    seen.add(svc.next()!.id);
    // All three candidates visited without repetition
    expect(seen.size).toBe(3);
  });
});
