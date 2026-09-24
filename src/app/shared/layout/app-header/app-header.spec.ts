import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AppHeader } from './app-header';
import { AuthService } from '../../../core/auth/auth.service';

describe('AppHeader', () => {
  it('renders the application identity and demo profile', async () => {
    await TestBed.configureTestingModule({
      imports: [AppHeader],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            displayName: signal('Gonzalo Herrera'),
            profile: signal(null),
            signOut: vi.fn().mockResolvedValue(undefined),
            user: signal({ email: 'gonzalo@example.com' }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('header')).toBeTruthy();
    expect(element.querySelector('.app-header__brand')?.textContent).toContain('Miércoles FC');
    expect(element.querySelector('app-avatar')?.textContent).toContain('GH');
    expect(element.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Cuenta de Gonzalo Herrera',
    );
  });
});
