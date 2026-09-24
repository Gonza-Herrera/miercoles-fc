import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'design-system',
    loadChildren: () =>
      import('./features/design-system/design-system.routes').then(
        ({ DESIGN_SYSTEM_ROUTES }) => DESIGN_SYSTEM_ROUTES,
      ),
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(({ AUTH_ROUTES }) => AUTH_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/app-shell/app-shell').then(({ AppShell }) => AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () =>
          import('./features/home/home.routes').then(({ HOME_ROUTES }) => HOME_ROUTES),
      },
      {
        path: 'match',
        loadChildren: () =>
          import('./features/match/match.routes').then(({ MATCH_ROUTES }) => MATCH_ROUTES),
      },
      {
        path: 'dinner',
        loadChildren: () =>
          import('./features/dinner/dinner.routes').then(({ DINNER_ROUTES }) => DINNER_ROUTES),
      },
      {
        path: 'payments',
        loadChildren: () =>
          import('./features/payments/payments.routes').then(
            ({ PAYMENTS_ROUTES }) => PAYMENTS_ROUTES,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
