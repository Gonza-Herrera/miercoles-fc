import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { InvitationService } from '../../invitation.service';
import { InvitationPage } from './invitation-page';

describe('InvitationPage', () => {
  const authenticated = signal(false);
  const accept = vi.fn();
  const preview = vi.fn();

  beforeEach(() => {
    authenticated.set(false);
    accept.mockReset();
    preview.mockReset();
    preview.mockResolvedValue({
      expiresAt: '2026-10-01T00:00:00Z',
      groupName: 'Los del Miércoles',
      memberDisplayName: 'Lucas',
      status: 'ACTIVE',
    });

    TestBed.configureTestingModule({
      imports: [InvitationPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'secure-token' } } },
        },
        {
          provide: AuthService,
          useValue: {
            initialize: vi.fn().mockResolvedValue(undefined),
            isAuthenticated: authenticated,
          },
        },
        { provide: InvitationService, useValue: { accept, preview } },
      ],
    });
  });

  it('renders a valid preview without accepting it automatically', async () => {
    const fixture = TestBed.createComponent(InvitationPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('¡Hola Lucas!');
    expect(fixture.nativeElement.textContent).toContain('Los del Miércoles');
    expect(accept).not.toHaveBeenCalled();
  });

  it('communicates loading while the preview request is pending', () => {
    preview.mockReturnValueOnce(new Promise(() => undefined));
    const fixture = TestBed.createComponent(InvitationPage);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Revisando invitación…');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('renders an invalid invitation without technical details', async () => {
    preview.mockResolvedValueOnce({
      expiresAt: null,
      groupName: null,
      memberDisplayName: null,
      status: 'INVALID',
    });
    const fixture = TestBed.createComponent(InvitationPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No encontramos esta invitación');
    expect(fixture.nativeElement.textContent).not.toContain('Supabase');
  });

  it('renders the expired state safely', async () => {
    preview.mockResolvedValueOnce({
      expiresAt: '2026-09-01T00:00:00Z',
      groupName: 'Los del Miércoles',
      memberDisplayName: 'Lucas',
      status: 'EXPIRED',
    });
    const fixture = TestBed.createComponent(InvitationPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Esta invitación venció');
    expect(fixture.nativeElement.querySelector('button')).toBeFalsy();
  });

  it('offers a retry after an unknown preview failure', async () => {
    preview.mockRejectedValueOnce(new Error('sensitive database details'));
    const fixture = TestBed.createComponent(InvitationPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos abrir la invitación');
    expect(fixture.nativeElement.textContent).toContain('Intentá nuevamente');
    expect(fixture.nativeElement.textContent).not.toContain('sensitive database details');
  });

  it('sends an unauthenticated user through auth with the invitation return path', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/invite/secure-token');
    const fixture = TestBed.createComponent(InvitationPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/auth'], {
      queryParams: { returnUrl: '/invite/secure-token' },
    });
    expect(accept).not.toHaveBeenCalled();
  });

  it('accepts explicitly and displays success for an authenticated user', async () => {
    authenticated.set(true);
    accept.mockResolvedValue({
      groupId: 'group-id',
      groupMemberId: 'member-id',
      groupName: 'Los del Miércoles',
      memberDisplayName: 'Lucas',
      status: 'ACCEPTED_NOW',
    });
    const fixture = TestBed.createComponent(InvitationPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(accept).toHaveBeenCalledWith('secure-token');
    expect(fixture.nativeElement.textContent).toContain('¡Ya estás adentro!');
  });
});
