import { Routes } from '@angular/router';

export const PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./payments').then(({ Payments }) => Payments),
    title: 'Pagos · Miércoles FC',
  },
];
