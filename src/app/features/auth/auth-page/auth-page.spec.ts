import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthPage } from './auth-page';

describe('AuthPage', () => {
  const requestMagicLink = vi.fn().mockResolvedValue(undefined);
  const signInWithGoogle = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    requestMagicLink.mockClear();
    signInWithGoogle.mockClear();

    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { requestMagicLink, signInWithGoogle },
        },
      ],
    }).compileComponents();
  });

  it('renders the Spanish passwordless experience', () => {
    const fixture = TestBed.createComponent(AuthPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Miércoles FC');
    expect(element.textContent).toContain('Enviarme un enlace');
    expect(element.textContent).toContain('Continuar con Google');
    expect(element.textContent).toContain('No necesitás recordar una contraseña.');
    expect(element.querySelector('input[type="password"]')).toBeNull();
  });

  it('validates email before requesting a link', () => {
    const fixture = TestBed.createComponent(AuthPage);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(requestMagicLink).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Ingresá un correo válido.');
  });

  it('shows confirmation without navigating after sending a Magic Link', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'gonzalo@example.com';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(requestMagicLink).toHaveBeenCalledWith('gonzalo@example.com', '/');
    expect(fixture.nativeElement.textContent).toContain('Revisá tu correo');
    expect(fixture.nativeElement.textContent).toContain('gonzalo@example.com');
  });
});
