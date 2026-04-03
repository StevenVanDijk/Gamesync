import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { GameDetailComponent } from './game-detail.component';
import { GameLibraryService } from '../../core/services/game-library.service';
import { SteamApiService } from '../../core/services/steam-api.service';
import { StoreConnectionService } from '../../core/services/store-connection.service';
import { Game } from '../../core/models/game.model';

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

describe('GameDetailComponent (US-004, US-005)', () => {
  let fixture: ComponentFixture<GameDetailComponent>;

  async function createComponent(game: Game | undefined, storeType: 'steam' | 'epic' = 'steam') {
    const steamApiSpy = {
      getAppMetadata: vi.fn().mockReturnValue(
        of({ communityScore: 88, imageUrl: 'img.jpg', yearPublished: 2012, tags: ['Shooter'] }),
      ),
      getOwnedGames: vi.fn().mockReturnValue(of([])),
    };

    const librarySvc = {
      games: signal([]),
      syncing: signal(false),
      error: signal(null),
      gameCount: signal(0),
      getById: vi.fn().mockReturnValue(game),
      updateGameMetadata: vi.fn(),
      syncAll: vi.fn().mockReturnValue(of([])),
      removeByConnection: vi.fn(),
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

    await TestBed.configureTestingModule({
      imports: [GameDetailComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: GameLibraryService, useValue: librarySvc },
        { provide: SteamApiService, useValue: steamApiSpy },
        { provide: StoreConnectionService, useValue: connectionSvc },
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
});
