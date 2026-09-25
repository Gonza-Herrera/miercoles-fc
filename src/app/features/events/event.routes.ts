import { Routes } from '@angular/router';

export const EVENT_ROUTES: Routes = [
  {
    path: ':eventId/edit',
    loadComponent: () =>
      import('./pages/event-form-page/event-form-page').then(({ EventFormPage }) => EventFormPage),
  },
  {
    path: ':eventId',
    loadComponent: () =>
      import('./pages/event-detail-page/event-detail-page').then(
        ({ EventDetailPage }) => EventDetailPage,
      ),
  },
];
