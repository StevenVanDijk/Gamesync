import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StoreConnectionService } from '../../../core/services/store-connection.service';
import { GogApiService } from '../../../core/services/gog-api.service';
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
            <mat-option value="gog">GOG</mat-option>
            <mat-option value="blob">CSV (Azure Blob Storage)</mat-option>
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

        @if (form.get('type')?.value === 'gog') {
          <div class="oauth-section">
            <p class="oauth-info">
              <mat-icon class="info-icon">info</mat-icon>
              <span>
                Click <strong>Open GOG Login</strong> to sign in to your GOG account.
                After logging in, you will be redirected to embed.gog.com. Copy the
                <code>code</code> value from the address bar and paste it below.
              </span>
            </p>

            <button
              type="button"
              mat-stroked-button
              color="accent"
              class="oauth-login-btn"
              (click)="openGogLogin()"
            >
              <mat-icon>open_in_new</mat-icon>
              Open GOG Login
            </button>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Authorization code</mat-label>
            <input
              matInput
              [(ngModel)]="gogCode"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Paste the code from the GOG redirect URL"
            />
          </mat-form-field>

          @if (gogError()) {
            <p class="error-text">{{ gogError() }}</p>
          }
        }

        @if (form.get('type')?.value === 'blob') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Label</mat-label>
            <input matInput formControlName="label" placeholder="e.g. My Game List" />
            @if (form.get('label')?.hasError('required')) {
              <mat-error>Label is required</mat-error>
            }
          </mat-form-field>

          <div class="oauth-section">
            <p class="oauth-info">
              <mat-icon class="info-icon">info</mat-icon>
              <span>
                Paste the <strong>Azure Blob SAS URL</strong> of your CSV file.
                The CSV must have columns: <code>name</code>, <code>source</code>, <code>playtime</code>.
              </span>
            </p>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Blob SAS URL</mat-label>
            <input matInput formControlName="blobUrl"
              placeholder="https://mystorage.blob.core.windows.net/container/games.csv?sv=…" />
            @if (form.get('blobUrl')?.hasError('required')) {
              <mat-error>SAS URL is required</mat-error>
            }
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>

      @if (form.get('type')?.value === 'gog') {
        <button
          mat-flat-button
          color="accent"
          (click)="connectGog()"
          [disabled]="gogLoading() || !gogCode.trim()"
        >
          @if (gogLoading()) {
            <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
          } @else {
            Connect with GOG
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

    .oauth-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 4px;
    }
    .oauth-info {
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
    .oauth-login-btn { align-self: flex-start; }
    .error-text { color: #f44336; font-size: 13px; margin: 0; }
    .btn-spinner { display: inline-block; }
  `],
})
export class AddConnectionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AddConnectionDialogComponent>);
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly gogApi = inject(GogApiService);
  private readonly destroyRef = inject(DestroyRef);

  gogLoading = signal(false);
  gogError = signal('');
  gogCode = '';

  form = this.fb.group({
    type: ['steam' as StoreType, Validators.required],
    label: ['', Validators.required],
    apiKey: [''],
    steamId: ['', Validators.pattern(/^\d{17}$/)],
    blobUrl: [''],
  });

  constructor() {
    this.form.get('type')!.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(type => {
      const apiKey = this.form.get('apiKey')!;
      const steamId = this.form.get('steamId')!;
      const label = this.form.get('label')!;
      const blobUrl = this.form.get('blobUrl')!;

      apiKey.clearValidators();
      steamId.clearValidators();
      label.clearValidators();
      blobUrl.clearValidators();

      if (type === 'steam') {
        label.setValidators([Validators.required]);
        apiKey.setValidators([Validators.required]);
        steamId.setValidators([Validators.required, Validators.pattern(/^\d{17}$/)]);
      } else if (type === 'blob') {
        label.setValidators([Validators.required]);
        blobUrl.setValidators([Validators.required]);
      }

      [label, apiKey, steamId, blobUrl].forEach(c => c.updateValueAndValidity());
      this.gogCode = '';
      this.gogError.set('');
    });
    this.form.get('type')!.updateValueAndValidity({ emitEvent: true });
  }

  submit(): void {
    if (this.form.invalid) return;
    const { type, label, apiKey, steamId, blobUrl } = this.form.getRawValue();

    if (type === 'steam') {
      this.connectionSvc.add('steam', label!, { apiKey: apiKey!, steamId: steamId! });
    } else if (type === 'blob') {
      this.connectionSvc.add('blob', label!, { url: blobUrl! });
    }
    this.dialogRef.close(true);
  }

  openGogLogin(): void {
    this.gogApi.getAuthUrl().subscribe({
      next: url => window.open(url, '_blank', 'noopener,noreferrer'),
      error: () => { this.gogError.set('Failed to fetch GOG login URL. Please try again.'); },
    });
  }

  connectGog(): void {
    const code = this.gogCode.trim();
    if (!code) return;
    this.gogLoading.set(true);
    this.gogError.set('');

    this.gogApi.exchangeCode(code).subscribe({
      next: tokens => {
        this.connectionSvc.add('gog', tokens.username ?? 'GOG Account', {
          userId: tokens.userId,
          username: tokens.username,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
        this.gogLoading.set(false);
        this.dialogRef.close(true);
      },
      error: err => {
        this.gogLoading.set(false);
        const detail = err?.error?.detail ?? err?.error?.error ?? err?.message ?? 'Unknown error';
        this.gogError.set(`Failed to connect: ${detail}`);
      },
    });
  }
}
