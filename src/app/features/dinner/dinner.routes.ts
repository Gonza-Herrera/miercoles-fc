import { Routes } from '@angular/router';

export const DINNER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./dinner').then(({ Dinner }) => Dinner),
    title: 'Cena · Miércoles FC',
  },
];
