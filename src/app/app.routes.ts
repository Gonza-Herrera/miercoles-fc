import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/home/home.routes').then(({ HOME_ROUTES }) => HOME_ROUTES),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
