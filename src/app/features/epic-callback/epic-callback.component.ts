/**
 * Legacy Epic OAuth callback route.
 *
 * The current Epic connection flow uses the launcher client's code-paste approach
 * (see AddConnectionDialogComponent), so this route is no longer part of the
 * main auth flow. It is kept to avoid dead-link errors if a user reaches it.
 */
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-epic-callback',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="callback-container">
      <p>Redirecting to connections…</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      color: #ccc;
    }
  `],
})
export class EpicCallbackComponent implements OnInit {
  private readonly router = inject(Router);
  ngOnInit(): void {
    this.router.navigate(['/connections']);
  }
}
