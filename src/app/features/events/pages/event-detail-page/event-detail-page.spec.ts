import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { GroupMemberRole } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { GuestParticipantService } from '../../participants/data-access/guest-participant.service';
import { EventStatus, WeeklyEvent } from '../../event.models';
import { EventService } from '../../event.service';
import { EventDetailPage } from './event-detail-page';

describe('EventDetailPage', () => {
  it('keeps lifecycle and edit controls hidden from a MEMBER', async () => {
    const fixture = await setup('MEMBER', 'DRAFT');

    expect(fixture.nativeElement.textContent).not.toContain('Abrir miércoles');
    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).toContain('Invitados');
    expect(fixture.nativeElement.textContent).not.toContain('Agregar invitado');
  });

  it('shows an ADMIN only the valid next transition', async () => {
    const fixture = await setup('ADMIN', 'OPEN');

    expect(fixture.nativeElement.textContent).toContain('Iniciar miércoles');
    expect(fixture.nativeElement.textContent).not.toContain('Pasar a liquidación');
    expect(fixture.nativeElement.textContent).toContain('Editar');
    expect(fixture.nativeElement.textContent).toContain('Agregar invitado');
  });

  it('requires confirmation for the final CLOSED transition', async () => {
    const fixture = await setup('ADMIN', 'SETTLEMENT');
    for (const dialog of fixture.nativeElement.querySelectorAll(
      'dialog',
    ) as NodeListOf<HTMLDialogElement>) {
      dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    }
    const close = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.includes('Cerrar miércoles'),
    );

    close?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('¿Cerrar este miércoles?');
    expect(fixture.nativeElement.textContent).toContain('no se podrán editar');
  });
});

async function setup(
  role: GroupMemberRole,
  status: EventStatus,
): Promise<ComponentFixture<EventDetailPage>> {
  const currentEvent = event(status);
  await TestBed.configureTestingModule({
    imports: [EventDetailPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ eventId: 'event-id' }) } },
      },
      {
        provide: EventService,
        useValue: {
          get: vi.fn().mockResolvedValue(currentEvent),
          transition: vi.fn().mockResolvedValue(currentEvent),
        },
      },
      {
        provide: GroupService,
        useValue: {
          get: vi.fn().mockResolvedValue({
            avatarPath: null,
            avatarUrl: null,
            description: null,
            id: 'group-id',
            membership: {
              avatarPath: null,
              avatarUrl: null,
              deactivatedAt: null,
              displayName: 'Lucas',
              groupId: 'group-id',
              id: 'member-id',
              invitation: 'LINKED',
              nickname: null,
              profileId: 'profile-id',
              role,
            },
            members: [],
            name: 'Los del Miércoles',
          }),
        },
      },
      { provide: GuestParticipantService, useValue: { list: vi.fn().mockResolvedValue([]) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(EventDetailPage);
  fixture.detectChanges();
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Detalle del miércoles');
  });
  return fixture;
}

function event(status: EventStatus): WeeklyEvent {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: '2026-10-01T10:00:00Z',
    createdBy: 'profile-id',
    currencyCode: 'ARS',
    groupId: 'group-id',
    id: 'event-id',
    location: 'Cancha Central',
    startsAt: '2026-10-08T00:30:00Z',
    status,
    title: null,
    updatedAt: '2026-10-01T10:00:00Z',
  };
}
