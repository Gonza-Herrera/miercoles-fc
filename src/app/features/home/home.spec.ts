import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AttendanceService } from '../attendance/attendance.service';
import { DinnerPlanningService } from '../dinner/dinner-planning.service';
import { EventStatus, WeeklyEvent } from '../events/event.models';
import { EventService } from '../events/event.service';
import { GroupMemberRole } from '../groups/group.models';
import { GroupService } from '../groups/group.service';
import { Home } from './home';

describe('Home', () => {
  const attendance = vi.fn();
  const current = vi.fn();
  const getGroup = vi.fn();
  const getDinnerPlanning = vi.fn();
  const listGroups = vi.fn();

  beforeEach(() => {
    attendance
      .mockReset()
      .mockResolvedValue([
        attendee('Lucas', 'YES', 'NO'),
        attendee('Carla', 'NO', 'YES'),
        attendee('Gonzalo', 'YES', 'YES'),
        attendee('Martín', 'YES', 'YES', true),
      ]);
    current.mockReset().mockResolvedValue(event('OPEN'));
    getDinnerPlanning.mockReset().mockResolvedValue({ plan: null });
    getGroup.mockReset().mockResolvedValue(group('ADMIN'));
    listGroups
      .mockReset()
      .mockResolvedValue([{ id: 'group-id', name: 'Los del Miércoles', role: 'ADMIN' }]);
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: AttendanceService, useValue: { listForDashboard: attendance } },
        { provide: DinnerPlanningService, useValue: { get: getDinnerPlanning } },
        { provide: EventService, useValue: { current } },
        { provide: GroupService, useValue: { get: getGroup, list: listGroups } },
      ],
    });
  });

  it('renders the current Event dashboard with independent real counts and navigation', async () => {
    const fixture = await createFixture();
    const text = fixture.nativeElement.textContent;
    const links = [...fixture.nativeElement.querySelectorAll('a')].map((link: HTMLAnchorElement) =>
      link.getAttribute('href'),
    );

    expect(text).toContain('Miércoles');
    expect(text).toContain('30 de septiembre');
    expect(text).toContain('21:00');
    expect(text).toContain('La Canchita');
    expect(text).toContain('Abierto');
    expect(text.match(/3 confirmados/g)).toHaveLength(2);
    expect(text).toContain('50.000');
    expect(text).toContain('Estimado por jugador');
    expect(links).toContain('/match');
    expect(links).toContain('/dinner');
    expect(text).toContain('Menú por definir');
    expect(text).not.toContain('Asado');
  });

  it('renders the persisted PR19 menu without changing the PR11 count', async () => {
    getDinnerPlanning.mockResolvedValue({ plan: { menu: 'Asado' } });
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Asado');
    expect(fixture.nativeElement.textContent).toContain('3 confirmados');
  });

  it('shows the safe zero-confirmation estimate state', async () => {
    attendance.mockResolvedValue([attendee('Diego', 'UNKNOWN', 'UNKNOWN')]);
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Esperando confirmaciones');
    expect(fixture.nativeElement.textContent).not.toContain('Infinity');
    expect(fixture.nativeElement.textContent).not.toContain('NaN');
  });

  it('keeps Event truth visible when attendance loading fails', async () => {
    attendance.mockRejectedValue(new Error('private backend detail'));
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('La Canchita');
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las confirmaciones.');
    expect(fixture.nativeElement.textContent).not.toContain('private backend detail');
  });

  it('renders the member empty current-event state without an ADMIN create action', async () => {
    current.mockResolvedValue(null);
    getGroup.mockResolvedValue(group('MEMBER'));
    const fixture = await createFixture();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Inicio');
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay un miércoles programado.');
    expect(fixture.nativeElement.textContent).not.toContain('Crear próximo miércoles');
  });

  it('offers an ADMIN the create action when no current Event exists', async () => {
    current.mockResolvedValue(null);
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('No hay un miércoles programado.');
    expect(fixture.nativeElement.textContent).toContain('Crear próximo miércoles');
  });

  async function createFixture() {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Preparando tu miércoles…');
    });
    return fixture;
  }
});

function event(status: EventStatus): WeeklyEvent {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: '2026-09-20T12:00:00Z',
    createdBy: 'profile-id',
    currencyCode: 'ARS',
    groupId: 'group-id',
    id: 'event-id',
    location: 'La Canchita',
    startsAt: '2026-09-30T21:00:00-03:00',
    status,
    title: null,
    updatedAt: '2026-09-20T12:00:00Z',
  };
}

function group(role: GroupMemberRole) {
  return {
    avatarPath: null,
    avatarUrl: null,
    description: null,
    id: 'group-id',
    membership: {
      avatarPath: null,
      avatarUrl: null,
      deactivatedAt: null,
      displayName: 'Gonzalo',
      groupId: 'group-id',
      id: 'member-id',
      invitation: 'LINKED',
      nickname: null,
      profileId: 'profile-id',
      role,
    },
    members: [],
    name: 'Los del Miércoles',
  };
}

function attendee(
  displayName: string,
  footballResponse: 'NO' | 'UNKNOWN' | 'YES',
  dinnerResponse: 'NO' | 'UNKNOWN' | 'YES',
  isGuest = false,
) {
  return {
    avatarPath: null,
    avatarUrl: null,
    dinnerResponse,
    displayName,
    eventId: 'event-id',
    footballResponse,
    groupMemberId: isGuest ? null : `${displayName}-id`,
    isCurrentUser: displayName === 'Gonzalo',
    isGuest,
    membershipActive: true,
    participantId: `${displayName}-participant-id`,
  };
}
