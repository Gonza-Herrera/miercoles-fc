import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';
import { Home } from './features/home/home';

describe('application routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('lazy-loads Home at the root route', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/', Home);

    expect(harness.routeNativeElement?.textContent).toContain('Foundation ready.');
  });

  it('redirects unknown routes to Home', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/not-found', Home);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Miércoles FC');
  });
});
