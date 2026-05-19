import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { GameDetailComponent } from './game-detail.component';
import { GameLibraryService } from '../../core/services/game-library.service';
import { SteamApiService } from '../../core/services/steam-api.service';
import { StoreConnectionService } from '../../core/services/store-connection.service';
import { RecommendationService } from '../../core/services/recommendation.service';
import { Game, SteamCandidate } from '../../core/models/game.model';

const GAME_WITH_META: Game = {
  id: 'c1_440', appId: '440', storeId: 'c1', name: 'Team Fortress 2', hoursPlayed: 200,
  metadata: {
    communityScore: 95,
    imageUrl: 'https://cdn.example.com/tf2.jpg',
    yearPublished: 2007,
    tags: ['Action', 'FPS'],
  },
};

const GAME_NO_META: Game = {
  id: 'c1_730', appId: '730', storeId: 'c1', name: 'CS2', hoursPlayed: 50,
};

const GOG_GAME_NO_META: Game = {
  id: 'g1_1207659069', appId: '1207659069', storeId: 'g1', name: 'The Witcher 3', hoursPlayed: 5,
};

const STEAM_CANDIDATES: SteamCandidate[] = [
  { appId: '292030', name: 'The Witcher 3: Wild Hunt', imageUrl: 'cap.jpg' },
  { appId: '9999', name: 'The Witcher 3 GOTY', imageUrl: 'cap2.jpg' },
];

const GOG_GAME_WITH_CANDIDATES: Game = {
  ...GOG_GAME_NO_META,
  steamCandidates: STEAM_CANDIDATES,
};

describe('GameDetailComponent (US-004, US-005)', () => {
  let fixture: ComponentFixture<GameDetailComponent>;

  async function createComponent(
    game: Game | undefined,
    storeType: 'steam' | 'gog' = 'steam',
    cachedCandidates: SteamCandidate[] | null = null,
    recGame: Game | null = null,
  ) {
    const gamesSignal = signal<Game[]>(game ? [game] : []);

    const steamApiSpy = {
      getAppMetadata: vi.fn().mockReturnValue(
        of({ communityScore: 88, imageUrl: 'img.jpg', yearPublished: 2012, tags: ['Shooter'] }),
      ),
      getOwnedGames: vi.fn().mockReturnValue(of([])),
      setConfirmedMatch: vi.fn(),
      clearCandidates: vi.fn(),
      getConfirmedMatch: vi.fn().mockReturnValue(null),
      getCachedCandidates: vi.fn().mockReturnValue(cachedCandidates),
    };

    const librarySvc = {
      games: gamesSignal.asReadonly(),
      syncing: signal(false),
      error: signal(null),
      gameCount: signal(0),
      fetchingMetadataIds: signal<ReadonlySet<string>>(new Set()),
      getById: vi.fn().mockReturnValue(game),
      updateGameMetadata: vi.fn((id: string, meta: Game['metadata']) => {
        gamesSignal.update(gs => gs.map(g => g.id === id ? { ...g, metadata: meta } : g));
      }),
      clearGameCandidates: vi.fn((id: string) => {
        gamesSignal.update(gs => gs.map(g => g.id === id ? { ...g, steamCandidates: undefined } : g));
      }),
      syncAll: vi.fn().mockReturnValue(of([])),
      removeByConnection: vi.fn(),
      retrySearch: vi.fn(),
      retryAllUnmatched: vi.fn(),
    };

    const connectionSvc = {
      connections: signal([]),
      connectionCount: signal(0),
      add: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
      getById: vi.fn().mockReturnValue(
        game
          ? { id: game.storeId, type: storeType, label: 'My Store', config: {} }
          : undefined,
      ),
    };

    const recommendationSvc = { next: vi.fn().mockReturnValue(recGame) };

    await TestBed.configureTestingModule({
      imports: [GameDetailComponent],
      providers: [
        provideRouter([{ path: 'library/:id', component: GameDetailComponent }]),
        provideAnimationsAsync(),
        { provide: GameLibraryService, useValue: librarySvc },
        { provide: SteamApiService, useValue: steamApiSpy },
        { provide: StoreConnectionService, useValue: connectionSvc },
        { provide: RecommendationService, useValue: recommendationSvc },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => game?.id ?? 'missing' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { steamApiSpy, librarySvc, connectionSvc };
  }

  it('should display the game name (US-004)', async () => {
    await createComponent(GAME_WITH_META);
    expect(fixture.nativeElement.textContent).toContain('Team Fortress 2');
  });

  it('should display hours played (US-004)', async () => {
    await createComponent(GAME_WITH_META);
    expect(fixture.nativeElement.textContent).toContain('200');
  });

  it('should display community score (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    expect(fixture.nativeElement.textContent).toContain('95%');
  });

  it('should display year published (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    expect(fixture.nativeElement.textContent).toContain('2007');
  });

  it('should display tags (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Action');
    expect(text).toContain('FPS');
  });

  it('should render the hero image (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    const img = fixture.nativeElement.querySelector('img.hero-image') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('tf2.jpg');
  });

  it('should auto-fetch metadata for a Steam game with no metadata (US-005)', async () => {
    const { steamApiSpy } = await createComponent(GAME_NO_META, 'steam');
    expect(steamApiSpy.getAppMetadata).toHaveBeenCalledWith('730');
  });

  it('should show not-found message for unknown game id', async () => {
    await createComponent(undefined);
    expect(fixture.nativeElement.textContent).toContain('Game not found');
  });

  it('should NOT show "Load metadata from Steam" button for GOG game with no metadata (US-021)', async () => {
    await createComponent(GOG_GAME_NO_META, 'gog');
    const btn = fixture.nativeElement.querySelector('button[mat-stroked-button]') as HTMLButtonElement | null;
    expect(btn).toBeNull();
  });

  it('should show "No Steam metadata available" note for GOG game with no metadata (US-021)', async () => {
    await createComponent(GOG_GAME_NO_META, 'gog');
    expect(fixture.nativeElement.textContent).toContain('No Steam metadata available for this game.');
  });

  it('should NOT auto-fetch metadata for GOG game with no metadata (US-021)', async () => {
    const { steamApiSpy } = await createComponent(GOG_GAME_NO_META, 'gog');
    expect(steamApiSpy.getAppMetadata).not.toHaveBeenCalled();
  });

  // ── US-022: candidate picker ─────────────────────────────────────────────

  it('should show Steam candidates when game has steamCandidates (US-022)', async () => {
    await createComponent(GOG_GAME_WITH_CANDIDATES, 'gog');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('The Witcher 3: Wild Hunt');
    expect(text).toContain('The Witcher 3 GOTY');
  });

  it('should NOT show "No Steam metadata available" note when candidates are present (US-022)', async () => {
    await createComponent(GOG_GAME_WITH_CANDIDATES, 'gog');
    expect(fixture.nativeElement.textContent).not.toContain('No Steam metadata available for this game.');
  });

  it('should call confirmSteamMatch and fetch metadata on candidate click (US-022)', async () => {
    const { steamApiSpy, librarySvc } = await createComponent(GOG_GAME_WITH_CANDIDATES, 'gog');

    const candidateButtons = fixture.nativeElement.querySelectorAll('button.candidate-item') as NodeListOf<HTMLButtonElement>;
    expect(candidateButtons.length).toBe(2);

    candidateButtons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(steamApiSpy.setConfirmedMatch).toHaveBeenCalledWith('g1_1207659069', '292030');
    expect(steamApiSpy.clearCandidates).toHaveBeenCalledWith('g1_1207659069');
    expect(librarySvc.clearGameCandidates).toHaveBeenCalledWith('g1_1207659069');
    expect(steamApiSpy.getAppMetadata).toHaveBeenCalledWith('292030');
    expect(librarySvc.updateGameMetadata).toHaveBeenCalledWith('g1_1207659069', expect.objectContaining({ communityScore: 88 }));
  });

  it('should display metadata after candidate is confirmed (US-022)', async () => {
    await createComponent(GOG_GAME_WITH_CANDIDATES, 'gog');

    const candidateButtons = fixture.nativeElement.querySelectorAll('button.candidate-item') as NodeListOf<HTMLButtonElement>;
    candidateButtons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('88%');
    expect(fixture.nativeElement.textContent).not.toContain('The Witcher 3: Wild Hunt');
  });

  // ── US-030: retry Steam search for unmatched games ───────────────────────

  it('should show "No match found on Steam" when cached candidates are empty (US-030)', async () => {
    // Pass [] as cachedCandidates to simulate "searched but nothing found"
    await createComponent(GOG_GAME_NO_META, 'gog', []);
    expect(fixture.nativeElement.textContent).toContain('No match found on Steam');
  });

  it('should show Retry button when noSteamMatch is true (US-030)', async () => {
    await createComponent(GOG_GAME_NO_META, 'gog', []);
    const retryBtn = fixture.nativeElement.querySelector('button[mat-stroked-button]') as HTMLButtonElement | null;
    expect(retryBtn).toBeTruthy();
    expect(retryBtn!.textContent).toContain('Retry Steam search');
  });

  it('should NOT show Retry button when candidates cache is null (never searched) (US-030)', async () => {
    await createComponent(GOG_GAME_NO_META, 'gog', null);
    expect(fixture.nativeElement.textContent).not.toContain('Retry Steam search');
    expect(fixture.nativeElement.textContent).toContain('No Steam metadata available for this game.');
  });

  it('should call librarySvc.retrySearch when Retry button is clicked (US-030)', async () => {
    const { librarySvc } = await createComponent(GOG_GAME_NO_META, 'gog', []);
    const retryBtn = fixture.nativeElement.querySelector('button[mat-stroked-button]') as HTMLButtonElement;
    retryBtn.click();
    expect(librarySvc.retrySearch).toHaveBeenCalledWith(GOG_GAME_NO_META);
  });

  // ── US-031: recommendation button ────────────────────────────────────────

  it('should show a lightbulb recommend button in the detail header (US-031)', async () => {
    await createComponent(GAME_WITH_META);
    const bulbBtn = fixture.nativeElement.querySelector('button[aria-label="Get a game recommendation"]') as HTMLButtonElement | null;
    expect(bulbBtn).toBeTruthy();
  });

  it('should navigate to the recommended game when the lightbulb button is clicked (US-031)', async () => {
    await createComponent(GAME_WITH_META, 'steam', null, GAME_NO_META);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    const bulbBtn = fixture.nativeElement.querySelector('button[aria-label="Get a game recommendation"]') as HTMLButtonElement;
    bulbBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navSpy).toHaveBeenCalledWith(['/library', GAME_NO_META.id]);
  });

  it('should not navigate when there are no recommendations (US-031)', async () => {
    await createComponent(GAME_WITH_META, 'steam', null, null);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');

    const bulbBtn = fixture.nativeElement.querySelector('button[aria-label="Get a game recommendation"]') as HTMLButtonElement;
    bulbBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navSpy).not.toHaveBeenCalled();
  });
});
