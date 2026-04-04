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
import { StoreConnectionService } from '../../../core/services/store-connection.service';
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

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Label</mat-label>
          <input matInput formControlName="label" placeholder="e.g. My Steam Account" />
          @if (form.get('label')?.hasError('required')) {
            <mat-error>Label is required</mat-error>
          }
        </mat-form-field>

        @if (form.get('type')?.value === 'steam') {
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
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Games JSON</mat-label>
            <textarea
              matInput
              formControlName="gamesJson"
              rows="6"
              placeholder='[{"appId":"fortnite","name":"Fortnite","hoursPlayed":12.5}]'
            ></textarea>
            <mat-hint>
              Epic does not have a public API. Paste a JSON array of your games manually.
            </mat-hint>
            @if (form.get('gamesJson')?.hasError('invalidJson')) {
              <mat-error>Invalid JSON</mat-error>
            }
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        (click)="submit()"
        [disabled]="form.invalid"
      >
        Add connection
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .full-width { width: 100%; }
  `],
})
export class AddConnectionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AddConnectionDialogComponent>);
  private readonly connectionSvc = inject(StoreConnectionService);

  form = this.fb.group({
    type: ['steam' as StoreType, Validators.required],
    label: ['', Validators.required],
    apiKey: [''],
    steamId: ['', Validators.pattern(/^\d{17}$/)],
    gamesJson: ['', this.jsonValidator],
  });

  constructor() {
    // Dynamically toggle required validators based on store type
    this.form.get('type')!.valueChanges.subscribe(type => {
      const apiKey = this.form.get('apiKey')!;
      const steamId = this.form.get('steamId')!;
      if (type === 'steam') {
        apiKey.setValidators([Validators.required]);
        steamId.setValidators([Validators.required, Validators.pattern(/^\d{17}$/)]);
      } else {
        apiKey.clearValidators();
        steamId.clearValidators();
      }
      apiKey.updateValueAndValidity();
      steamId.updateValueAndValidity();
    });
    // Trigger initial validation
    this.form.get('type')!.updateValueAndValidity({ emitEvent: true });
  }

  submit(): void {
    if (this.form.invalid) return;
    const { type, label, apiKey, steamId, gamesJson } = this.form.getRawValue();

    const config =
      type === 'steam'
        ? { apiKey: apiKey!, steamId: steamId! }
        : { gamesJson: gamesJson || undefined };

    this.connectionSvc.add(type as StoreType, label!, config);
    this.dialogRef.close(true);
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
