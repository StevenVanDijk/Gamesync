import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import { GameCardComponent } from './game-card.component';
import { Game } from '../../../core/models/game.model';

const GAME_BASIC: Game = {
  id: 'c1_440', appId: '440', storeId: 'c1', name: 'Team Fortress 2', hoursPlayed: 200,
};

const GAME_WITH_META: Game = {
  id: 'c1_730', appId: '730', storeId: 'c1', name: 'CS2', hoursPlayed: 50,
  metadata: {
    communityScore: 88,
    imageUrl: 'https://cdn.example.com/cs2.jpg',
    yearPublished: 2023,
    tags: ['Shooter', 'FPS', 'Competitive'],
  },
};

const GAME_INSTALLED: Game = {
  id: 'c1_440', appId: '440', storeId: 'c1', name: 'TF2', hoursPlayed: 10,
  isInstalled: true,
};

const GAME_NOT_INSTALLED: Game = {
  id: 'c1_440', appId: '440', storeId: 'c1', name: 'TF2', hoursPlayed: 10,
  isInstalled: false,
};

describe('GameCardComponent', () => {
  let fixture: ComponentFixture<GameCardComponent>;

  async function createComponent(
    game: Game,
    opts: { compact?: boolean; list?: boolean; metadataLoading?: boolean; connectionColor?: string } = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [GameCardComponent],
      providers: [provideAnimationsAsync()],
    }).compileComponents();

    fixture = TestBed.createComponent(GameCardComponent);
    fixture.componentRef.setInput('game', game);
    if (opts.compact !== undefined) fixture.componentRef.setInput('compact', opts.compact);
    if (opts.list !== undefined) fixture.componentRef.setInput('list', opts.list);
    if (opts.metadataLoading !== undefined) fixture.componentRef.setInput('metadataLoading', opts.metadataLoading);
    if (opts.connectionColor !== undefined) fixture.componentRef.setInput('connectionColor', opts.connectionColor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ── Card view (default) ──

  it('should display the game name (US-001)', async () => {
    await createComponent(GAME_BASIC);
    expect(fixture.nativeElement.textContent).toContain('Team Fortress 2');
  });

  it('should display hours played (US-001)', async () => {
    await createComponent(GAME_BASIC);
    expect(fixture.nativeElement.textContent).toContain('200');
    expect(fixture.nativeElement.textContent).toContain('hrs');
  });

  it('should show cover image when metadata imageUrl is present (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    const img = fixture.nativeElement.querySelector('img.card-image');
    expect(img).toBeTruthy();
    expect(img.src).toContain('cs2.jpg');
  });

  it('should show placeholder icon when no imageUrl (US-005)', async () => {
    await createComponent(GAME_BASIC);
    const placeholder = fixture.nativeElement.querySelector('.card-image-placeholder');
    expect(placeholder).toBeTruthy();
  });

  it('should display community score badge when metadata has communityScore (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    const badge = fixture.nativeElement.querySelector('.score-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('88');
  });

  it('should apply score-positive class for scores >= 70 (US-018)', async () => {
    await createComponent(GAME_WITH_META);
    const badge = fixture.nativeElement.querySelector('.score-badge');
    expect(badge.classList.contains('score-positive')).toBe(true);
  });

  it('should apply score-mixed class for scores 40-69 (US-018)', async () => {
    await createComponent({ ...GAME_WITH_META, metadata: { ...GAME_WITH_META.metadata!, communityScore: 55 } });
    const badge = fixture.nativeElement.querySelector('.score-badge');
    expect(badge.classList.contains('score-mixed')).toBe(true);
  });

  it('should apply score-negative class for scores < 40 (US-018)', async () => {
    await createComponent({ ...GAME_WITH_META, metadata: { ...GAME_WITH_META.metadata!, communityScore: 25 } });
    const badge = fixture.nativeElement.querySelector('.score-badge');
    expect(badge.classList.contains('score-negative')).toBe(true);
  });

  it('should render score badge with no number when communityScore is absent (US-018)', async () => {
    await createComponent(GAME_BASIC);
    const badge = fixture.nativeElement.querySelector('.score-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('%');
  });

  it('should display year published in card view (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    expect(fixture.nativeElement.textContent).toContain('2023');
  });

  it('should display up to 3 tags in card view (US-005)', async () => {
    await createComponent(GAME_WITH_META);
    const chips = fixture.nativeElement.querySelectorAll('.tag-chip');
    expect(chips.length).toBe(3);
  });

  it('should emit selected event when card is clicked (US-001)', async () => {
    await createComponent(GAME_BASIC);
    const spy = vi.fn();
    fixture.componentInstance.selected.subscribe(spy);
    fixture.nativeElement.querySelector('mat-card').click();
    expect(spy).toHaveBeenCalledWith(GAME_BASIC);
  });

  // ── Compact view (US-014) ──

  it('should apply compact class when compact input is true (US-014)', async () => {
    await createComponent(GAME_WITH_META, { compact: true });
    const card = fixture.nativeElement.querySelector('.game-card');
    expect(card.classList.contains('compact')).toBe(true);
  });

  it('should not show tags in compact view (US-014)', async () => {
    await createComponent(GAME_WITH_META, { compact: true });
    const chips = fixture.nativeElement.querySelectorAll('.tag-chip');
    expect(chips.length).toBe(0);
  });

  it('should not show year in compact view (US-014)', async () => {
    await createComponent(GAME_WITH_META, { compact: true });
    const yearEl = fixture.nativeElement.querySelector('.year');
    expect(yearEl).toBeFalsy();
  });

  // ── List view (US-016, US-018, US-019) ──

  it('should apply list class when list input is true (US-016)', async () => {
    await createComponent(GAME_BASIC, { list: true });
    const card = fixture.nativeElement.querySelector('.game-card');
    expect(card.classList.contains('list')).toBe(true);
  });

  it('should render list row with game name in list view (US-016)', async () => {
    await createComponent(GAME_BASIC, { list: true });
    const nameEl = fixture.nativeElement.querySelector('.list-name');
    expect(nameEl).toBeTruthy();
    expect(nameEl.textContent).toContain('Team Fortress 2');
  });

  it('should render hours played in list view (US-016)', async () => {
    await createComponent(GAME_BASIC, { list: true });
    const hoursEl = fixture.nativeElement.querySelector('.list-hours');
    expect(hoursEl).toBeTruthy();
    expect(hoursEl.textContent).toContain('200');
  });

  it('should render connection color accent bar in list view (US-019)', async () => {
    await createComponent(GAME_BASIC, { list: true, connectionColor: '#ff0000' });
    const accent = fixture.nativeElement.querySelector('.list-accent');
    expect(accent).toBeTruthy();
    expect(accent.style.background).toContain('rgb(255, 0, 0)');
  });

  it('should default connection color to transparent (US-019)', async () => {
    await createComponent(GAME_BASIC, { list: true });
    const accent = fixture.nativeElement.querySelector('.list-accent');
    expect(accent).toBeTruthy();
  });

  it('should show score badge in list view when communityScore is present (US-018)', async () => {
    await createComponent(GAME_WITH_META, { list: true });
    const badge = fixture.nativeElement.querySelector('.list-score-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('88');
  });

  it('should show score cell in list view when communityScore is absent and not loading (US-018)', async () => {
    await createComponent(GAME_BASIC, { list: true, metadataLoading: false });
    const scoreContainer = fixture.nativeElement.querySelector('.list-score');
    expect(scoreContainer).toBeTruthy();
    // The template renders the score cell; without a score it shows the badge template with no number
    expect(scoreContainer.textContent).toContain('%');
  });

  it('should show spinner in list view when metadataLoading is true (US-018)', async () => {
    await createComponent(GAME_BASIC, { list: true, metadataLoading: true });
    const spinner = fixture.nativeElement.querySelector('.list-score mat-spinner');
    expect(spinner).toBeTruthy();
  });

  it('should show thumbnail image in list view when imageUrl is present (US-016)', async () => {
    await createComponent(GAME_WITH_META, { list: true });
    const img = fixture.nativeElement.querySelector('img.list-img');
    expect(img).toBeTruthy();
    expect(img.src).toContain('cs2.jpg');
  });

  // ── Installation status (US-029) ──

  it('should show installed icon when isInstalled is true in list view (US-029)', async () => {
    await createComponent(GAME_INSTALLED, { list: true });
    const icon = fixture.nativeElement.querySelector('.list-installed-icon.installed');
    expect(icon).toBeTruthy();
  });

  it('should show not-installed icon when isInstalled is false in list view (US-029)', async () => {
    await createComponent(GAME_NOT_INSTALLED, { list: true });
    const icon = fixture.nativeElement.querySelector('.list-installed-icon:not(.installed)');
    expect(icon).toBeTruthy();
  });

  it('should not show installed icon when isInstalled is absent (US-029)', async () => {
    await createComponent(GAME_BASIC, { list: true });
    const icon = fixture.nativeElement.querySelector('.list-installed-icon');
    expect(icon).toBeFalsy();
  });

  it('should show installed indicator in card view when isInstalled is true (US-029)', async () => {
    await createComponent(GAME_INSTALLED);
    const installedEl = fixture.nativeElement.querySelector('.card-installed--yes');
    expect(installedEl).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Installed');
  });

  it('should show not-installed indicator in card view when isInstalled is false (US-029)', async () => {
    await createComponent(GAME_NOT_INSTALLED);
    const installedEl = fixture.nativeElement.querySelector('.card-installed:not(.card-installed--yes)');
    expect(installedEl).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Not installed');
  });

  // ── Recommendation button (US-031) ──

  it('should render a recommend button in card view (US-031)', async () => {
    await createComponent(GAME_BASIC);
    const btn = fixture.nativeElement.querySelector('.recommend-btn');
    expect(btn).toBeTruthy();
  });

  it('should render a recommend button in list view (US-031)', async () => {
    await createComponent(GAME_BASIC, { list: true });
    const btn = fixture.nativeElement.querySelector('.recommend-btn');
    expect(btn).toBeTruthy();
  });

  it('should render a recommend button in compact view (US-031)', async () => {
    await createComponent(GAME_BASIC, { compact: true });
    const btn = fixture.nativeElement.querySelector('.recommend-btn');
    expect(btn).toBeTruthy();
  });

  it('should emit recommend event and stop propagation when recommend button is clicked (US-031)', async () => {
    await createComponent(GAME_BASIC);
    const spy = vi.fn();
    fixture.componentInstance.recommend.subscribe(spy);
    const cardSpy = vi.fn();
    fixture.componentInstance.selected.subscribe(cardSpy);
    const btn = fixture.nativeElement.querySelector('.recommend-btn');
    btn.click();
    expect(spy).toHaveBeenCalled();
    expect(cardSpy).not.toHaveBeenCalled();
  });
});
