import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StoreConnectionService } from '../../../core/services/store-connection.service';
import { EpicApiService } from '../../../core/services/epic-api.service';
import { StoreType } from '../../../core/models/store-connection.model';

@Component({
  selector: 'app-add-connection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Add store connection</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Store</mat-label>
          <mat-select formControlName="type">
            <mat-option value="steam">Steam</mat-option>
            <mat-option value="epic">Epic Games</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.get('type')?.value === 'steam') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Label</mat-label>
            <input matInput formControlName="label" placeholder="e.g. My Steam Account" />
            @if (form.get('label')?.hasError('required')) {
              <mat-error>Label is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Steam API Key</mat-label>
            <input matInput formControlName="apiKey" placeholder="32-character hex key" />
            <mat-hint>
              Get yours at
              <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener">
                steamcommunity.com/dev/apikey
              </a>
            </mat-hint>
            @if (form.get('apiKey')?.hasError('required')) {
              <mat-error>API key is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Steam ID (64-bit)</mat-label>
            <input matInput formControlName="steamId" placeholder="e.g. 76561198000000000" />
            <mat-hint>Find yours at steamidfinder.com</mat-hint>
            @if (form.get('steamId')?.hasError('required')) {
              <mat-error>Steam ID is required</mat-error>
            }
            @if (form.get('steamId')?.hasError('pattern')) {
              <mat-error>Must be a numeric Steam 64-bit ID</mat-error>
            }
          </mat-form-field>
        }

        @if (form.get('type')?.value === 'epic') {
          <div class="epic-section">
            <p class="epic-info">
              <mat-icon class="info-icon">info</mat-icon>
              <span>
                Click <strong>Open Epic Login</strong> to sign in to your Epic account.
                After logging in, you will see a page displaying JSON — copy the
                <code>authorizationCode</code> value and paste it below.
              </span>
            </p>

            <button
              type="button"
              mat-stroked-button
              color="accent"
              class="epic-login-btn"
              (click)="openEpicLogin()"
            >
              <mat-icon>open_in_new</mat-icon>
              Open Epic Login
            </button>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Authorization code</mat-label>
            <input
              matInput
              [(ngModel)]="epicCode"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Paste the authorizationCode from Epic here"
            />
          </mat-form-field>

          @if (epicError()) {
            <p class="epic-error">{{ epicError() }}</p>
          }
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>

      @if (form.get('type')?.value === 'epic') {
        <button
          mat-flat-button
          color="accent"
          (click)="connectEpic()"
          [disabled]="epicLoading() || !epicCode.trim()"
        >
          @if (epicLoading()) {
            <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
          } @else {
            Connect with Epic
          }
        </button>
      } @else {
        <button
          mat-flat-button
          color="primary"
          (click)="submit()"
          [disabled]="form.invalid"
        >
          Add connection
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .full-width { width: 100%; }

    .epic-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 4px;
    }
    .epic-info {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: #bbb;
      font-size: 14px;
      margin: 0;
    }
    .info-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px; }
    code {
      background: rgba(255,255,255,0.08);
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 13px;
    }
    .epic-login-btn { align-self: flex-start; }
    .epic-error { color: #f44336; font-size: 13px; margin: 0; }
    .btn-spinner { display: inline-block; }
  `],
})
export class AddConnectionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AddConnectionDialogComponent>);
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly epicApi = inject(EpicApiService);

  epicLoading = signal(false);
  epicError = signal('');
  epicCode = '';

  form = this.fb.group({
    type: ['steam' as StoreType, Validators.required],
    label: ['', Validators.required],
    apiKey: [''],
    steamId: ['', Validators.pattern(/^\d{17}$/)],
  });

  constructor() {
    this.form.get('type')!.valueChanges.subscribe(type => {
      const apiKey = this.form.get('apiKey')!;
      const steamId = this.form.get('steamId')!;
      const label = this.form.get('label')!;
      if (type === 'steam') {
        label.setValidators([Validators.required]);
        apiKey.setValidators([Validators.required]);
        steamId.setValidators([Validators.required, Validators.pattern(/^\d{17}$/)]);
      } else {
        label.clearValidators();
        apiKey.clearValidators();
        steamId.clearValidators();
      }
      label.updateValueAndValidity();
      apiKey.updateValueAndValidity();
      steamId.updateValueAndValidity();
      this.epicCode = '';
      this.epicError.set('');
    });
    this.form.get('type')!.updateValueAndValidity({ emitEvent: true });
  }

  submit(): void {
    if (this.form.invalid) return;
    const { label, apiKey, steamId } = this.form.getRawValue();
    this.connectionSvc.add('steam', label!, { apiKey: apiKey!, steamId: steamId! });
    this.dialogRef.close(true);
  }

  openEpicLogin(): void {
    this.epicApi.getAuthUrl().subscribe({
      next: url => window.open(url, '_blank', 'noopener,noreferrer'),
      error: () => {
        // Fallback: open the known login URL directly
        const redirectApiUrl =
          'https://www.epicgames.com/id/api/redirect' +
          '?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code';
        window.open(
          'https://www.epicgames.com/id/login?redirectUrl=' +
            encodeURIComponent(redirectApiUrl),
          '_blank',
          'noopener,noreferrer',
        );
      },
    });
  }

  connectEpic(): void {
    const code = this.epicCode.trim();
    if (!code) return;
    this.epicLoading.set(true);
    this.epicError.set('');

    this.epicApi.exchangeCode(code).subscribe({
      next: tokens => {
        this.connectionSvc.add('epic', tokens.displayName ?? 'Epic Account', {
          accountId: tokens.accountId,
          displayName: tokens.displayName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
        this.epicLoading.set(false);
        this.dialogRef.close(true);
      },
      error: err => {
        this.epicLoading.set(false);
        const detail = err?.error?.detail ?? err?.error?.error ?? err?.message ?? 'Unknown error';
        this.epicError.set(`Failed to connect: ${detail}`);
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private jsonValidator(control: AbstractControl): Record<string, true> | null {
    return null;
  }
}
