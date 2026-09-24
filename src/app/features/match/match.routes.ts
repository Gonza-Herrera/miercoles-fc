import { Routes } from '@angular/router';

export const MATCH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./match').then(({ Match }) => Match),
    title: 'Partido · Miércoles FC',
  },
];
