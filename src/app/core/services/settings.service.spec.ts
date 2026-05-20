import { TestBed } from '@angular/core/testing';
import { SettingsService, DEFAULT_RECOMMENDATION_CONFIG } from './settings.service';

describe('SettingsService (US-033)', () => {
  let svc: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [SettingsService] });
    svc = TestBed.inject(SettingsService);
  });

  it('starts with default values', () => {
    expect(svc.settings().tagWeight).toBe(DEFAULT_RECOMMENDATION_CONFIG.tagWeight);
    expect(svc.settings().scoreWeight).toBe(DEFAULT_RECOMMENDATION_CONFIG.scoreWeight);
  });

  it('update() changes the tagWeight setting', () => {
    svc.update({ tagWeight: 2.5 });
    expect(svc.settings().tagWeight).toBe(2.5);
  });

  it('update() changes the scoreWeight setting', () => {
    svc.update({ scoreWeight: 1.8 });
    expect(svc.settings().scoreWeight).toBe(1.8);
  });

  it('update() preserves unchanged fields', () => {
    svc.update({ tagWeight: 2.0 });
    expect(svc.settings().scoreWeight).toBe(DEFAULT_RECOMMENDATION_CONFIG.scoreWeight);
  });

  it('reset() restores defaults', () => {
    svc.update({ tagWeight: 3.0, scoreWeight: 0.5 });
    svc.reset();
    expect(svc.settings().tagWeight).toBe(DEFAULT_RECOMMENDATION_CONFIG.tagWeight);
    expect(svc.settings().scoreWeight).toBe(DEFAULT_RECOMMENDATION_CONFIG.scoreWeight);
  });

  it('persists settings to localStorage', () => {
    svc.update({ tagWeight: 2.2 });
    const stored = JSON.parse(localStorage.getItem('gamesync_settings') ?? '{}');
    expect(stored.tagWeight).toBeCloseTo(2.2);
  });

  it('loads persisted settings on construction', () => {
    localStorage.setItem('gamesync_settings', JSON.stringify({ tagWeight: 1.7, scoreWeight: 0.9 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [SettingsService] });
    const fresh = TestBed.inject(SettingsService);
    expect(fresh.settings().tagWeight).toBeCloseTo(1.7);
    expect(fresh.settings().scoreWeight).toBeCloseTo(0.9);
  });
});
