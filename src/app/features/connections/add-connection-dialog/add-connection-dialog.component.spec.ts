import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AddConnectionDialogComponent } from './add-connection-dialog.component';
import { StoreConnectionService } from '../../../core/services/store-connection.service';
import { GogApiService } from '../../../core/services/gog-api.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

describe('AddConnectionDialogComponent (US-002, US-023, US-028)', () => {
  let fixture: ComponentFixture<AddConnectionDialogComponent>;
  let component: AddConnectionDialogComponent;
  let connectionSvc: any;
  let gogApi: any;
  let dialogRef: any;

  async function createComponent() {
    connectionSvc = {
      connections: signal([]),
      connectionCount: signal(0),
      add: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
      getById: vi.fn(),
    };
    gogApi = {
      getAuthUrl: vi.fn().mockReturnValue(of('https://auth.gog.com/auth?client_id=xxx')),
      exchangeCode: vi.fn().mockReturnValue(of({
        userId: 'gog-user-123',
        username: 'Gamer123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 9999999999999,
      })),
    };
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddConnectionDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: StoreConnectionService, useValue: connectionSvc },
        { provide: GogApiService, useValue: gogApi },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: null },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddConnectionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ── Form structure ──

  it('should create with form defaulting to steam type (US-002)', async () => {
    await createComponent();
    expect(component.form.get('type')!.value).toBe('steam');
  });

  it('should render store type dropdown defaulting to steam (US-002, US-023, US-028)', async () => {
    await createComponent();
    const select = fixture.nativeElement.querySelector('mat-select');
    expect(select).toBeTruthy();
    // mat-option elements live in the overlay panel, not in the DOM until opened.
    // Verify the form control defaults to steam and the selected label is shown.
    expect(component.form.get('type')!.value).toBe('steam');
    expect(fixture.nativeElement.textContent).toContain('Steam');
  });

  // ── Steam connection (US-002) ──

  it('should show steam fields (label, apiKey, steamId) when type is steam (US-002)', async () => {
    await createComponent();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Steam API Key');
    expect(text).toContain('Steam ID');
  });

  it('should require label, apiKey, and steamId for steam connections (US-002)', async () => {
    await createComponent();
    expect(component.form.get('label')!.hasError('required')).toBe(true);
    expect(component.form.get('apiKey')!.hasError('required')).toBe(true);
    expect(component.form.get('steamId')!.hasError('required')).toBe(true);
  });

  it('should validate steamId as 17-digit numeric pattern (US-002)', async () => {
    await createComponent();
    component.form.get('steamId')!.setValue('123');
    expect(component.form.get('steamId')!.hasError('pattern')).toBe(true);
    component.form.get('steamId')!.setValue('76561198000000000');
    expect(component.form.get('steamId')!.hasError('pattern')).toBe(false);
  });

  it('should call connectionSvc.add with steam config on submit and close dialog (US-002)', async () => {
    await createComponent();
    component.form.patchValue({
      type: 'steam',
      label: 'My Steam',
      apiKey: 'KEY12345678901234567890123456789',
      steamId: '76561198000000000',
    });
    component.submit();
    expect(connectionSvc.add).toHaveBeenCalledWith('steam', 'My Steam', {
      apiKey: 'KEY12345678901234567890123456789',
      steamId: '76561198000000000',
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should not call add when form is invalid (US-002)', async () => {
    await createComponent();
    component.form.patchValue({ type: 'steam', label: '', apiKey: '', steamId: '' });
    component.submit();
    expect(connectionSvc.add).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  // ── Blob connection (US-028) ──

  it('should show blob fields (label, blobUrl) when type is blob (US-028)', async () => {
    await createComponent();
    component.form.get('type')!.setValue('blob');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Blob SAS URL');
    expect(text).toContain('Label');
  });

  it('should require label and blobUrl for blob connections (US-028)', async () => {
    await createComponent();
    component.form.get('type')!.setValue('blob');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.form.get('label')!.hasError('required')).toBe(true);
    expect(component.form.get('blobUrl')!.hasError('required')).toBe(true);
  });

  it('should call connectionSvc.add with blob config on submit (US-028)', async () => {
    await createComponent();
    component.form.get('type')!.setValue('blob');
    fixture.detectChanges();
    await fixture.whenStable();
    component.form.patchValue({
      type: 'blob',
      label: 'My CSV',
      blobUrl: 'https://mystorage.blob.core.windows.net/container/games.csv?sv=...',
    });
    component.submit();
    expect(connectionSvc.add).toHaveBeenCalledWith('blob', 'My CSV', {
      url: 'https://mystorage.blob.core.windows.net/container/games.csv?sv=...',
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  // ── GOG connection (US-023) ──

  it('should show GOG OAuth section when type is gog (US-023)', async () => {
    await createComponent();
    component.form.get('type')!.setValue('gog');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Open GOG Login');
    expect(text).toContain('Authorization code');
  });

  it('should call gogApi.getAuthUrl and open window when Open GOG Login is clicked (US-023)', async () => {
    await createComponent();
    component.form.get('type')!.setValue('gog');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const windowSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    component.openGogLogin();
    expect(gogApi.getAuthUrl).toHaveBeenCalled();
    expect(windowSpy).toHaveBeenCalledWith(
      'https://auth.gog.com/auth?client_id=xxx',
      '_blank',
      'noopener,noreferrer',
    );
    windowSpy.mockRestore();
  });

  it('should set gogError when getAuthUrl fails (US-023)', async () => {
    await createComponent();
    gogApi.getAuthUrl.mockReturnValue(throwError(() => new Error('Network error')));
    component.openGogLogin();
    expect(component.gogError()).toContain('Failed to fetch GOG login URL');
  });

  it('should call exchangeCode and connectionSvc.add on successful GOG connect (US-023)', async () => {
    await createComponent();
    component.form.get('type')!.setValue('gog');
    component.gogCode = 'test-auth-code';
    component.connectGog();
    expect(gogApi.exchangeCode).toHaveBeenCalledWith('test-auth-code');
    expect(connectionSvc.add).toHaveBeenCalledWith('gog', 'Gamer123', {
      userId: 'gog-user-123',
      username: 'Gamer123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 9999999999999,
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
    expect(component.gogLoading()).toBe(false);
  });

  it('should not call exchangeCode when gogCode is empty (US-023)', async () => {
    await createComponent();
    component.gogCode = '   ';
    component.connectGog();
    expect(gogApi.exchangeCode).not.toHaveBeenCalled();
  });

  it('should set gogError and stop loading when exchangeCode fails (US-023)', async () => {
    await createComponent();
    gogApi.exchangeCode.mockReturnValue(throwError(() => ({ error: { detail: 'Invalid code' } })));
    component.gogCode = 'bad-code';
    component.connectGog();
    expect(component.gogLoading()).toBe(false);
    expect(component.gogError()).toContain('Failed to connect: Invalid code');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('should use "GOG Account" as fallback username when tokens.username is absent (US-023)', async () => {
    await createComponent();
    gogApi.exchangeCode.mockReturnValue(of({
      userId: 'u1', username: undefined, accessToken: 'a', refreshToken: 'r', expiresAt: 1,
    }));
    component.gogCode = 'code';
    component.connectGog();
    expect(connectionSvc.add).toHaveBeenCalledWith('gog', 'GOG Account', expect.any(Object));
  });

  // ── Dynamic validation ──

  it('should clear validators for steam fields when switching to blob (US-002, US-028)', async () => {
    await createComponent();
    // Start as steam — apiKey and steamId should be required
    expect(component.form.get('apiKey')!.hasError('required')).toBe(true);
    expect(component.form.get('steamId')!.hasError('required')).toBe(true);
    // Switch to blob
    component.form.get('type')!.setValue('blob');
    fixture.detectChanges();
    await fixture.whenStable();
    // apiKey and steamId should no longer be required
    expect(component.form.get('apiKey')!.validator).toBeNull();
    expect(component.form.get('steamId')!.validator).toBeNull();
    // blobUrl should now be required
    expect(component.form.get('blobUrl')!.hasError('required')).toBe(true);
  });

  it('should reset gogCode and gogError when switching store type (US-023)', async () => {
    await createComponent();
    component.gogCode = 'some-code';
    component.gogError.set('some error');
    component.form.get('type')!.setValue('gog');
    expect(component.gogCode).toBe('');
    expect(component.gogError()).toBe('');
  });
});
