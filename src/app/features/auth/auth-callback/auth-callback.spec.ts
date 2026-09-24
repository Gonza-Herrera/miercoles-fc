import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthCallback } from './auth-callback';

describe('AuthCallback', () => {
  it('offers a safe retry when no callback session can be established', async () => {
    await TestBed.configureTestingModule({
      imports: [AuthCallback],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            initialize: () => Promise.resolve(),
            isAuthenticated: signal(false),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AuthCallback);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos iniciar sesión');
    expect(fixture.nativeElement.textContent).toContain('El enlace no es válido o ya venció.');
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/auth');
  });
});
