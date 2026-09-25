import { Routes } from '@angular/router';

export const INVITATION_ROUTES: Routes = [
  {
    path: ':token',
    loadComponent: () =>
      import('./pages/invitation-page/invitation-page').then(
        ({ InvitationPage }) => InvitationPage,
      ),
    title: 'Invitación · Miércoles FC',
  },
];

export const INVITATION_ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/invitation-admin-page/invitation-admin-page').then(
        ({ InvitationAdminPage }) => InvitationAdminPage,
      ),
    title: 'Invitaciones · Miércoles FC',
  },
];
