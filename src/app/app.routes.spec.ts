import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { GroupService } from './features/groups/group.service';
import { InvitationService } from './features/invitations/invitation.service';

describe('application routes', () => {
  const authenticated = signal(true);
  const authStub = {
    displayName: signal('Gonzalo'),
    initialize: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: authenticated,
    profile: signal(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    user: signal({ email: 'gonzalo@example.com' }),
  };
  const invitationStub = {
    listInvitableMembers: vi.fn().mockResolvedValue([]),
    preview: vi.fn().mockResolvedValue({
      expiresAt: '2026-10-01T00:00:00Z',
      groupName: 'Los del Miércoles',
      memberDisplayName: 'Lucas',
      status: 'ACTIVE',
    }),
  };
  const groupStub = { list: vi.fn().mockResolvedValue([]) };

  beforeEach(() => {
    authenticated.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: authStub },
        { provide: GroupService, useValue: groupStub },
        { provide: InvitationService, useValue: invitationStub },
      ],
    });
  });

  it.each([
    ['/', 'Inicio'],
    ['/match', 'Partido'],
    ['/dinner', 'Cena'],
    ['/payments', 'Pagos'],
    ['/invitations', 'Invitar miembros'],
    ['/groups', 'Mis grupos'],
  ])('loads %s inside the application shell', async (url, heading) => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(url);

    expect(harness.routeNativeElement?.querySelector('app-header')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('app-bottom-navigation')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(heading);
  });

  it('keeps the Design System showcase outside primary navigation', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/design-system');

    expect(harness.routeNativeElement?.textContent).toContain('Design system · Showcase');
    expect(harness.routeNativeElement?.querySelector('app-bottom-navigation')).toBeFalsy();
  });

  it('redirects unknown routes to Home', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/not-found');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Inicio');
  });

  it('redirects unauthenticated application routes to auth with a safe return URL', async () => {
    authenticated.set(false);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/payments');

    expect(TestBed.inject(Router).url).toBe('/auth?returnUrl=%2Fpayments');
    expect(harness.routeNativeElement?.textContent).toContain('Enviarme un enlace');
  });

  it('keeps invitation previews public before authentication', async () => {
    authenticated.set(false);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/invite/secure-token');
    await vi.waitFor(() =>
      expect(harness.routeNativeElement?.textContent).toContain('¡Hola Lucas!'),
    );

    expect(TestBed.inject(Router).url).toBe('/invite/secure-token');
    expect(harness.routeNativeElement?.querySelector('app-bottom-navigation')).toBeFalsy();
  });
});
