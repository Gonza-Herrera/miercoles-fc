import { Routes } from '@angular/router';

export const DESIGN_SYSTEM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./design-system-showcase').then(({ DesignSystemShowcase }) => DesignSystemShowcase),
    title: 'Design System · Miércoles FC',
  },
];
