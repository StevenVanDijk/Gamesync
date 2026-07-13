import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { SettingsService, RecommendationConfig, DEFAULT_RECOMMENDATION_CONFIG } from '../../core/services/settings.service';

describe('SettingsComponent (US-033)', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let settingsSvc: any;

  async function createComponent(settings: RecommendationConfig) {
    settingsSvc = {
      settings: signal(settings),
      update: vi.fn(),
      reset: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: SettingsService, useValue: settingsSvc },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should render the settings page title (US-033)', async () => {
    await createComponent({ ...DEFAULT_RECOMMENDATION_CONFIG });
    expect(fixture.nativeElement.textContent).toContain('Recommendation Settings');
  });

  it('should display the tag-overlap slider with current value (US-033)', async () => {
    await createComponent({ tagWeight: 1.5, scoreWeight: 1.0 });
    expect(fixture.nativeElement.textContent).toContain('Tag overlap influence');
    expect(fixture.nativeElement.textContent).toContain('1.5');
  });

  it('should display the community-score slider with current value (US-033)', async () => {
    await createComponent({ tagWeight: 1.0, scoreWeight: 2.0 });
    expect(fixture.nativeElement.textContent).toContain('Community score influence');
    expect(fixture.nativeElement.textContent).toContain('2.0');
  });

  it('should call update with tagWeight when onTagWeightChange is invoked (US-033)', async () => {
    await createComponent({ ...DEFAULT_RECOMMENDATION_CONFIG });
    fixture.componentInstance.onTagWeightChange(2.5);
    expect(settingsSvc.update).toHaveBeenCalledWith({ tagWeight: 2.5 });
  });

  it('should call update with scoreWeight when onScoreWeightChange is invoked (US-033)', async () => {
    await createComponent({ ...DEFAULT_RECOMMENDATION_CONFIG });
    fixture.componentInstance.onScoreWeightChange(0.5);
    expect(settingsSvc.update).toHaveBeenCalledWith({ scoreWeight: 0.5 });
  });

  it('should call reset when the reset button is clicked (US-033)', async () => {
    await createComponent({ tagWeight: 2.0, scoreWeight: 2.0 });
    const btn = fixture.nativeElement.querySelector('.reset-btn');
    expect(btn).toBeTruthy();
    btn.click();
    expect(settingsSvc.reset).toHaveBeenCalled();
  });

  it('should show "Reset to defaults" button text (US-033)', async () => {
    await createComponent({ ...DEFAULT_RECOMMENDATION_CONFIG });
    const btn = fixture.nativeElement.querySelector('.reset-btn');
    expect(btn.textContent).toContain('Reset to defaults');
  });

  it('should display default value 1.0 for both sliders initially (US-033)', async () => {
    await createComponent({ ...DEFAULT_RECOMMENDATION_CONFIG });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1.0');
  });
});
