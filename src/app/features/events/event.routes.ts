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
    path: ':eventId/draft',
    loadComponent: () =>
      import('../match/pages/player-draft-page/player-draft-page').then(
        ({ PlayerDraftPage }) => PlayerDraftPage,
      ),
    title: 'Draft de jugadores · Miércoles FC',
  },
  {
    path: ':eventId/lineup',
    loadComponent: () =>
      import('../match/pages/team-lineup-page/team-lineup-page').then(
        ({ TeamLineupPage }) => TeamLineupPage,
      ),
    title: 'Formación de equipos · Miércoles FC',
  },
  {
    path: ':eventId',
    loadComponent: () =>
      import('./pages/event-detail-page/event-detail-page').then(
        ({ EventDetailPage }) => EventDetailPage,
      ),
  },
];
