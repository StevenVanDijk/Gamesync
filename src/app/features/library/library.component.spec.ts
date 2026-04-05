import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LibraryComponent } from './library.component';
import { GameLibraryService } from '../../core/services/game-library.service';
import { StoreConnectionService } from '../../core/services/store-connection.service';
import { Game } from '../../core/models/game.model';

const GAME_1: Game = { id: 'c1_440', appId: '440', storeId: 'c1', name: 'TF2', hoursPlayed: 200 };
const GAME_2: Game = {
  id: 'c1_730', appId: '730', storeId: 'c1', name: 'CS2', hoursPlayed: 50,
  metadata: { yearPublished: 2023, tags: ['Shooter'] },
};

function makeLibrarySvc(games: Game[]) {
  return {
    games: signal(games),
    syncing: signal(false),
    error: signal<string | null>(null),
    gameCount: signal(games.length),
    fetchingMetadataIds: signal<ReadonlySet<string>>(new Set()),
    syncAll: vi.fn().mockReturnValue(of(games)),
    removeByConnection: vi.fn(),
    getById: vi.fn(),
    updateGameMetadata: vi.fn(),
  };
}

function makeConnectionSvc(count: number) {
  return {
    connections: signal<any[]>([]),
    connectionCount: signal(count),
    add: vi.fn(), remove: vi.fn(), update: vi.fn(), getById: vi.fn(),
  };
}

describe('LibraryComponent (US-001)', () => {
  let fixture: ComponentFixture<LibraryComponent>;
  let component: LibraryComponent;
  let librarySvc: ReturnType<typeof makeLibrarySvc>;

  async function createComponent(games: Game[], connectionCount: number) {
    librarySvc = makeLibrarySvc(games);
    await TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: GameLibraryService, useValue: librarySvc },
        { provide: StoreConnectionService, useValue: makeConnectionSvc(connectionCount) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should display a game card for each game (US-001)', async () => {
    await createComponent([GAME_1, GAME_2], 1);
    const cards = fixture.nativeElement.querySelectorAll('app-game-card');
    expect(cards.length).toBe(2);
  });

  it('should show empty state when no connections exist (US-001)', async () => {
    await createComponent([], 0);
    expect(fixture.nativeElement.textContent).toContain('No store connections yet');
  });

  it('should show the correct game count (US-001)', async () => {
    await createComponent([GAME_1, GAME_2], 1);
    expect(fixture.nativeElement.textContent).toContain('2 games');
  });

  it('should filter games by search query (US-001)', async () => {
    await createComponent([GAME_1, GAME_2], 1);
    // Signals update synchronously; detectChanges reflects the new state immediately
    component.searchQuery.set('tf');
    fixture.detectChanges();
    await fixture.whenStable();
    const cards = fixture.nativeElement.querySelectorAll('app-game-card');
    expect(cards.length).toBe(1);
  });

  it('should call syncAll on init when library is empty (US-001)', async () => {
    await createComponent([], 1);
    expect(librarySvc.syncAll).toHaveBeenCalled();
  });

  it('should show no-results message when search matches nothing (US-001)', async () => {
    await createComponent([GAME_1], 1);
    component.searchQuery.set('xyznotfound');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No games match');
  });

  it('should show singular "game" for count of 1 (US-001)', async () => {
    await createComponent([GAME_1], 1);
    const countEl = fixture.nativeElement.querySelector('.game-count') as HTMLElement;
    expect(countEl.textContent?.trim()).toBe('1 game');
  });

  it('should apply compact-grid class when compact view is selected (US-014)', async () => {
    await createComponent([GAME_1, GAME_2], 1);
    component.viewMode.set('card');
    fixture.detectChanges();
    await fixture.whenStable();
    const grid = fixture.nativeElement.querySelector('.game-grid') as HTMLElement;
    expect(grid.classList.contains('compact-grid')).toBe(false);

    component.viewMode.set('compact');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(grid.classList.contains('compact-grid')).toBe(true);
  });

  it('should pass compact=true to game cards in compact view (US-014)', async () => {
    await createComponent([GAME_1], 1);
    component.viewMode.set('compact');
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.nativeElement.querySelector('app-game-card mat-card') as HTMLElement;
    expect(card.classList.contains('compact')).toBe(true);
  });

  it('should default to list view and apply list-grid class (US-016, US-018)', async () => {
    await createComponent([GAME_1, GAME_2], 1);
    const grid = fixture.nativeElement.querySelector('.game-grid') as HTMLElement;
    expect(grid.classList.contains('list-grid')).toBe(true);
  });

  it('should pass list=true to game cards in list view (US-016)', async () => {
    await createComponent([GAME_1], 1);
    component.viewMode.set('list');
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.nativeElement.querySelector('app-game-card mat-card') as HTMLElement;
    expect(card.classList.contains('list')).toBe(true);
  });
});
