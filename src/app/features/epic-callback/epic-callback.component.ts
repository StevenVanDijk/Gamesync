/**
 * Handles the Epic Games OAuth redirect.
 *
 * Epic redirects to this route after the user authorises the app:
 *   /epic-callback?code=<auth_code>
 *
 * The component exchanges the code for tokens via the backend, saves the
 * connection, then navigates to /connections.
 */
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { EpicApiService } from '../../core/services/epic-api.service';
import { StoreConnectionService } from '../../core/services/store-connection.service';

@Component({
  selector: 'app-epic-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule],
  template: `
    <div class="callback-container">
      @if (state === 'loading') {
        <mat-spinner diameter="48"></mat-spinner>
        <p>Connecting your Epic account…</p>
      } @else if (state === 'success') {
        <p class="success-msg">Epic account connected!</p>
        <p>Redirecting to connections…</p>
      } @else {
        <p class="error-msg">Failed to connect Epic account.</p>
        <p class="error-detail">{{ errorDetail }}</p>
        <button mat-flat-button color="primary" (click)="retry()">Try again</button>
      }
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 60vh;
      color: #ccc;
    }
    .success-msg { color: #4caf50; font-size: 20px; }
    .error-msg { color: #f44336; font-size: 20px; }
    .error-detail { font-size: 13px; color: #aaa; }
  `],
})
export class EpicCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly epicApi = inject(EpicApiService);
  private readonly connectionSvc = inject(StoreConnectionService);

  state: 'loading' | 'success' | 'error' = 'loading';
  errorDetail = '';

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.state = 'error';
      this.errorDetail = 'No authorization code received from Epic.';
      return;
    }

    this.epicApi.exchangeCode(code).subscribe({
      next: tokens => {
        this.connectionSvc.add('epic', tokens.displayName ?? 'Epic Account', {
          accountId: tokens.accountId,
          displayName: tokens.displayName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
        this.state = 'success';
        setTimeout(() => this.router.navigate(['/connections']), 1500);
      },
      error: err => {
        this.state = 'error';
        this.errorDetail = err?.message ?? 'Unknown error';
      },
    });
  }

  retry(): void {
    this.router.navigate(['/connections']);
  }
}
