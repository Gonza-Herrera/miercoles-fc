import { Routes } from '@angular/router';

export const GROUP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/group-list-page/group-list-page').then(({ GroupListPage }) => GroupListPage),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/group-form-page/group-form-page').then(({ GroupFormPage }) => GroupFormPage),
  },
  {
    path: ':groupId/history',
    loadComponent: () =>
      import('../history/pages/history-page/history-page').then(({ HistoryPage }) => HistoryPage),
    title: 'Historial · Miércoles FC',
  },
  {
    path: ':groupId/history/:eventId',
    loadComponent: () =>
      import('../history/pages/history-detail-page/history-detail-page').then(
        ({ HistoryDetailPage }) => HistoryDetailPage,
      ),
    title: 'Miércoles finalizado · Miércoles FC',
  },
  {
    path: ':groupId',
    loadComponent: () =>
      import('./pages/group-detail-page/group-detail-page').then(
        ({ GroupDetailPage }) => GroupDetailPage,
      ),
  },
  {
    path: ':groupId/settings',
    loadComponent: () =>
      import('./pages/group-form-page/group-form-page').then(({ GroupFormPage }) => GroupFormPage),
  },
  {
    path: ':groupId/events/new',
    loadComponent: () =>
      import('../events/pages/event-form-page/event-form-page').then(
        ({ EventFormPage }) => EventFormPage,
      ),
  },
  {
    path: ':groupId/events',
    loadComponent: () =>
      import('../events/pages/event-list-page/event-list-page').then(
        ({ EventListPage }) => EventListPage,
      ),
  },
  {
    path: ':groupId/members/new',
    loadComponent: () =>
      import('./pages/member-form-page/member-form-page').then(
        ({ MemberFormPage }) => MemberFormPage,
      ),
  },
  {
    path: ':groupId/members/:memberId/edit',
    loadComponent: () =>
      import('./pages/member-form-page/member-form-page').then(
        ({ MemberFormPage }) => MemberFormPage,
      ),
  },
];
