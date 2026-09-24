import { Component } from '@angular/core';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { AppShell } from './app-shell';
import { AuthService } from '../../../core/auth/auth.service';

@Component({ template: '<h1>Contenido enrutado</h1>' })
class TestPage {}

describe('AppShell', () => {
  it('composes header, routed content, and bottom navigation', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            displayName: signal('Gonzalo'),
            profile: signal(null),
            signOut: vi.fn().mockResolvedValue(undefined),
            user: signal({ email: 'gonzalo@example.com' }),
          },
        },
        provideRouter([
          {
            path: '',
            component: AppShell,
            children: [{ path: '', component: TestPage }],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/');

    expect(harness.routeNativeElement?.querySelector('header')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('main h1')?.textContent).toContain(
      'Contenido enrutado',
    );
    expect(harness.routeNativeElement?.querySelector('nav')).toBeTruthy();
  });
});
