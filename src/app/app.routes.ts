import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'library', pathMatch: 'full' },
  {
    path: 'library',
    loadComponent: () =>
      import('./features/library/library.component').then(m => m.LibraryComponent),
  },
  {
    path: 'library/:id',
    loadComponent: () =>
      import('./features/game-detail/game-detail.component').then(
        m => m.GameDetailComponent,
      ),
  },
  {
    path: 'connections',
    loadComponent: () =>
      import('./features/connections/connections.component').then(
        m => m.ConnectionsComponent,
      ),
  },
  {
    path: 'logs',
    loadComponent: () =>
      import('./features/logs/logs.component').then(m => m.LogsComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
  { path: '**', redirectTo: 'library' },
];
