import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { App } from './app';

describe('App shell (US-007)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideAnimationsAsync()],
    }).compileComponents();
  });

  it('should create the app component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Gamesync toolbar', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Gamesync');
  });

  it('should contain navigation links for Library, Connections, and Logs', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const links = fixture.nativeElement.querySelectorAll('a[mat-button]');
    const texts = Array.from(links).map((l: any) => l.textContent.trim());
    expect(texts.some((t: string) => t.includes('Library'))).toBe(true);
    expect(texts.some((t: string) => t.includes('Connections'))).toBe(true);
    expect(texts.some((t: string) => t.includes('Logs'))).toBe(true);
  });
});
