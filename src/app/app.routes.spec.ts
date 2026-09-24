import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';

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

  beforeEach(() => {
    authenticated.set(true);
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AuthService, useValue: authStub }],
    });
  });

  it.each([
    ['/', 'Inicio'],
    ['/match', 'Partido'],
    ['/dinner', 'Cena'],
    ['/payments', 'Pagos'],
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
});
