import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreConnectionService } from '../../core/services/store-connection.service';
import { GameLibraryService } from '../../core/services/game-library.service';
import {
  BlobConnectionConfig,
  GogConnectionConfig,
  SteamConnectionConfig,
  StoreConnection,
  StoreType,
} from '../../core/models/store-connection.model';
import { AddConnectionDialogComponent } from './add-connection-dialog/add-connection-dialog.component';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="connections-container">
      <div class="connections-header">
        <h2>Store Connections</h2>
        <button mat-flat-button color="primary" (click)="openAddDialog()">
          <mat-icon>add</mat-icon>
          Add connection
        </button>
      </div>

      @if (connectionSvc.connections().length === 0) {
        <div class="empty-state">
          <mat-icon>link_off</mat-icon>
          <p>No connections configured. Add one to start building your library.</p>
        </div>
      } @else {
        <div class="connections-list">
          @for (conn of connectionSvc.connections(); track conn.id) {
            <mat-card class="connection-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>{{ storeIcon(conn.type) }}</mat-icon>
                <mat-card-title>{{ conn.label }}</mat-card-title>
                <mat-card-subtitle>{{ storeLabel(conn.type) }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                @if (conn.type === 'steam') {
                  <p class="detail-line">
                    <strong>Steam ID:</strong>
                    {{ steamCfg(conn).steamId }}
                  </p>
                  <p class="detail-line">
                    <strong>API Key:</strong>
                    {{ maskKey(steamCfg(conn).apiKey) }}
                  </p>
                }
                @if (conn.type === 'gog') {
                  <p class="detail-line">
                    <strong>Account:</strong>
                    {{ gogCfg(conn).username }}
                  </p>
                }
                @if (conn.type === 'blob') {
                  <p class="detail-line blob-url">
                    <strong>URL:</strong>
                    {{ blobCfg(conn).url | slice:0:60 }}{{ blobCfg(conn).url.length > 60 ? '…' : '' }}
                  </p>
                }
                @if (conn.lastSyncedAt) {
                  <p class="detail-line synced-at">
                    Last synced: {{ conn.lastSyncedAt | date:'medium' }}
                  </p>
                }
              </mat-card-content>
              <mat-card-actions>
                <button mat-button color="warn" (click)="remove(conn)">
                  <mat-icon>delete</mat-icon>
                  Remove
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .connections-container { padding: 16px; max-width: 800px; margin: 0 auto; }
    .connections-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    h2 { margin: 0; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 64px 16px;
      color: #888;
    }
    .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; }
    .connections-list { display: flex; flex-direction: column; gap: 12px; }
    .connection-card {}
    .detail-line { margin: 4px 0; font-size: 13px; }
    .synced-at { color: #888; }
  `],
})
export class ConnectionsComponent {
  protected readonly connectionSvc = inject(StoreConnectionService);
  private readonly librarySvc = inject(GameLibraryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  openAddDialog(): void {
    const ref = this.dialog.open(AddConnectionDialogComponent, { width: '500px' });
    ref.afterClosed().subscribe((added: boolean) => {
      if (added) {
        this.snackBar.open('Connection added.', 'OK', { duration: 3000 });
      }
    });
  }

  remove(conn: StoreConnection): void {
    this.connectionSvc.remove(conn.id);
    this.librarySvc.removeByConnection(conn.id);
    this.snackBar.open(`"${conn.label}" removed.`, 'Dismiss', { duration: 3000 });
  }

  steamCfg(conn: StoreConnection): SteamConnectionConfig {
    return conn.config as SteamConnectionConfig;
  }

  gogCfg(conn: StoreConnection): GogConnectionConfig {
    return conn.config as GogConnectionConfig;
  }

  blobCfg(conn: StoreConnection): BlobConnectionConfig {
    return conn.config as BlobConnectionConfig;
  }

  maskKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  }

  storeIcon(type: StoreType): string {
    return type === 'steam' ? 'sports_esports' : 'videogame_asset';
  }

  storeLabel(type: StoreType): string {
    if (type === 'steam') return 'Steam';
    if (type === 'gog') return 'GOG';
    return 'CSV (Azure Blob)';
  }
}
