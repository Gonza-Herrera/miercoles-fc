import { Routes } from '@angular/router';

export const EVENT_ROUTES: Routes = [
  {
    path: ':eventId/edit',
    loadComponent: () =>
      import('./pages/event-form-page/event-form-page').then(({ EventFormPage }) => EventFormPage),
  },
  {
    path: ':eventId/match-attendance',
    loadComponent: () =>
      import('../match/pages/match-attendance-page/match-attendance-page').then(
        ({ MatchAttendancePage }) => MatchAttendancePage,
      ),
    title: 'Marcar presentes · Miércoles FC',
  },
  {
    path: ':eventId/team-generation',
    loadComponent: () =>
      import('../match/pages/team-generation-page/team-generation-page').then(
        ({ TeamGenerationPage }) => TeamGenerationPage,
      ),
    title: 'Armar equipos · Miércoles FC',
  },
  {
    path: ':eventId/teams',
    loadComponent: () =>
      import('../match/pages/team-generation-page/team-generation-page').then(
        ({ TeamGenerationPage }) => TeamGenerationPage,
      ),
    title: 'Armar equipos · Miércoles FC',
  },
  {
    path: ':eventId',
    loadComponent: () =>
      import('./pages/event-detail-page/event-detail-page').then(
        ({ EventDetailPage }) => EventDetailPage,
      ),
  },
];
