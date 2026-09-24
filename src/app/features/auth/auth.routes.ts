import { Routes } from '@angular/router';

import { guestGuard } from '../../core/auth/auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth-page/auth-page').then(({ AuthPage }) => AuthPage),
  },
  {
    path: 'callback',
    loadComponent: () =>
      import('./auth-callback/auth-callback').then(({ AuthCallback }) => AuthCallback),
  },
];
