import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';

describe('application routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
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
});
