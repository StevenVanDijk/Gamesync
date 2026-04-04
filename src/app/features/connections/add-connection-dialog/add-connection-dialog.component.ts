import { Component, inject } from '@angular/core';
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
          <p class="epic-info">
            <mat-icon class="info-icon">info</mat-icon>
            Click <strong>Connect with Epic</strong> to log in with your Epic account.
            You will be redirected to Epic's login page and back automatically.
          </p>
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
          [disabled]="epicLoading"
        >
          @if (epicLoading) {
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
    .epic-info {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: #bbb;
      font-size: 14px;
      margin: 8px 0;
    }
    .info-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px; }
    .btn-spinner { display: inline-block; }
  `],
})
export class AddConnectionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AddConnectionDialogComponent>);
  private readonly connectionSvc = inject(StoreConnectionService);
  private readonly epicApi = inject(EpicApiService);

  epicLoading = false;

  form = this.fb.group({
    type: ['steam' as StoreType, Validators.required],
    label: ['', Validators.required],
    apiKey: [''],
    steamId: ['', Validators.pattern(/^\d{17}$/)],
  });

  constructor() {
    // Dynamically toggle required validators based on store type
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
    });
    this.form.get('type')!.updateValueAndValidity({ emitEvent: true });
  }

  submit(): void {
    if (this.form.invalid) return;
    const { label, apiKey, steamId } = this.form.getRawValue();
    this.connectionSvc.add('steam', label!, { apiKey: apiKey!, steamId: steamId! });
    this.dialogRef.close(true);
  }

  connectEpic(): void {
    this.epicLoading = true;
    this.epicApi.getAuthUrl().subscribe({
      next: url => {
        // Redirect the entire page to Epic's login
        window.location.href = url;
        // Dialog stays open until redirect completes; close it for cleanliness
        this.dialogRef.close();
      },
      error: () => {
        this.epicLoading = false;
      },
    });
  }

  private jsonValidator(control: AbstractControl): Record<string, true> | null {
    const val = control.value as string;
    if (!val) return null;
    try {
      JSON.parse(val);
      return null;
    } catch {
      return { invalidJson: true };
    }
  }
}
