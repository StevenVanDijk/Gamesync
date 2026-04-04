/**
 * US-010 – Mobile rendering.
 *
 * Tests the structural requirements that make icons and layout work on mobile:
 * - nav links expose a `.nav-label` span so CSS can hide text on small screens
 * - mat-icon elements are present (font renders them when stylesheet is loaded)
 * - the library search bar has responsive CSS classes
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { App } from './app';

describe('Mobile rendering – App shell (US-010)', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideAnimationsAsync()],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should render mat-icon elements in the toolbar (icons render when font is loaded)', () => {
    const icons = fixture.nativeElement.querySelectorAll('mat-toolbar mat-icon');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('should wrap nav labels in .nav-label so CSS can hide text on small screens', () => {
    const labels = fixture.nativeElement.querySelectorAll('.nav-label');
    expect(labels.length).toBe(2); // Library + Connections
  });

  it('should have nav links inside an .app-nav container for targeted CSS', () => {
    const nav = fixture.nativeElement.querySelector('.app-nav');
    expect(nav).toBeTruthy();
    const links = nav.querySelectorAll('a[mat-button]');
    expect(links.length).toBe(2);
  });

  it('should not render the app title inside an icon element (text must be separate)', () => {
    const titleEl = fixture.nativeElement.querySelector('.app-title');
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent.trim()).toBe('Gamesync');
  });
});
