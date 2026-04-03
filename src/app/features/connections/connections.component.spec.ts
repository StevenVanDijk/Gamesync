import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ConnectionsComponent } from './connections.component';
import { StoreConnectionService } from '../../core/services/store-connection.service';
import { GameLibraryService } from '../../core/services/game-library.service';
import { StoreConnection } from '../../core/models/store-connection.model';

const STEAM_CONN: StoreConnection = {
  id: 'conn1', type: 'steam', label: 'My Steam',
  config: { apiKey: 'KEY12345678901234567890123456789', steamId: '76561198000000001' },
};

describe('ConnectionsComponent (US-002, US-003, US-008)', () => {
  let fixture: ComponentFixture<ConnectionsComponent>;
  let connectionSvc: any;
  let librarySvc: any;

  async function createComponent(connections: StoreConnection[]) {
    connectionSvc = {
      connections: signal(connections),
      connectionCount: signal(connections.length),
      add: vi.fn(), remove: vi.fn(), update: vi.fn(), getById: vi.fn(),
    };
    librarySvc = {
      games: signal([]), syncing: signal(false), error: signal(null), gameCount: signal(0),
      syncAll: vi.fn().mockReturnValue(of([])),
      removeByConnection: vi.fn(), getById: vi.fn(), updateGameMetadata: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConnectionsComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: StoreConnectionService, useValue: connectionSvc },
        { provide: GameLibraryService, useValue: librarySvc },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectionsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should show empty state when no connections exist (US-008)', async () => {
    await createComponent([]);
    expect(fixture.nativeElement.textContent).toContain('No connections configured');
  });

  it('should display existing connection labels (US-002, US-008)', async () => {
    await createComponent([STEAM_CONN]);
    expect(fixture.nativeElement.textContent).toContain('My Steam');
    expect(fixture.nativeElement.textContent).toContain('Steam');
  });

  it('should render the "Add connection" button (US-002)', async () => {
    await createComponent([]);
    const btn = fixture.nativeElement.querySelector('button[color="primary"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Add connection');
  });

  it('should invoke openAddDialog when Add button is clicked (US-002)', async () => {
    await createComponent([]);
    // Spy directly on the component method to avoid MatDialog overlay infrastructure
    const comp = fixture.componentInstance as any;
    const spy = vi.spyOn(comp, 'openAddDialog').mockImplementation(() => {});
    fixture.nativeElement.querySelector('button[color="primary"]').click();
    expect(spy).toHaveBeenCalled();
  });

  it('should call remove and removeByConnection on delete (US-008)', async () => {
    await createComponent([STEAM_CONN]);
    fixture.nativeElement.querySelector('button[color="warn"]').click();
    expect(connectionSvc.remove).toHaveBeenCalledWith('conn1');
    expect(librarySvc.removeByConnection).toHaveBeenCalledWith('conn1');
  });

  it('should mask the Steam API key (US-002)', async () => {
    await createComponent([STEAM_CONN]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('KEY12345678901234567890123456789');
    expect(text).toContain('KEY1');
  });
});
