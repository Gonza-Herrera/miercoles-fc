import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AttendanceRecord } from '../../../attendance/attendance.models';
import { AttendanceService } from '../../../attendance/attendance.service';
import { GroupMemberRole } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { WeeklyEvent } from '../../../events/event.models';
import { EventService } from '../../../events/event.service';
import { GeneratedTeam } from '../../domain/random-team-generator';
import { TeamManagerConfiguration } from '../../managers/team-manager.models';
import { TeamManagerService } from '../../managers/team-manager.service';
import { TeamService } from '../../team.service';
import { TeamGenerationPage } from './team-generation-page';

describe('TeamGenerationPage', () => {
  let saveTeamsMock: ReturnType<typeof vi.fn>;
  let saveManagersMock: ReturnType<typeof vi.fn>;
  let setModeMock: ReturnType<typeof vi.fn>;
  let navigateMock: ReturnType<typeof vi.fn>;

  it('loads available players and displays calculated formation plan hint', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), []);

    expect(fixture.nativeElement.textContent).toContain('Armar equipos');
    expect(fixture.nativeElement.textContent).toContain('10 jugadores presentes');
    expect(fixture.nativeElement.textContent).toContain('Se requieren 2 equipos (5 / 5)');
  });

  it('invalidates a persisted RANDOM roster when actual attendance changed', async () => {
    const staleTeams = sampleTeams().map((team, index) => ({
      ...team,
      players:
        index === 0
          ? [
              ...team.players,
              {
                avatarUrl: null,
                displayName: 'Jugador retirado',
                groupMemberId: null,
                id: 'removed-player',
                isGuest: true,
                participantId: 'removed-player',
              },
            ]
          : team.players,
    }));
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), staleTeams);

    expect(fixture.nativeElement.textContent).toContain('La asistencia cambió');
    expect(fixture.nativeElement.textContent).toContain('Generar equipos');
    expect(fixture.nativeElement.textContent).not.toContain('6 jugadores');
  });

  it('generates random teams upon clicking "Generar equipos"', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), []);

    const generateBtn = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Generar equipos'),
    );
    generateBtn?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Equipo A');
    expect(fixture.nativeElement.textContent).toContain('Equipo B');
    expect(fixture.nativeElement.textContent).toContain('Volver a sortear');
    expect(fixture.nativeElement.textContent).toContain(
      'Confirmá los equipos para ver la formación en cancha actualizada.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Ver formación en cancha');
  });

  it('offers the pitch view only when the current roster is persisted', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), sampleTeams());

    expect(fixture.nativeElement.textContent).toContain('Ver formación en cancha');
  });

  it('lets an ADMIN switch from RANDOM to MANAGERS using PR14 team count', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), []);
    const managersMode = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Directores Técnicos'),
    );

    managersMode?.click();

    await vi.waitFor(() => {
      expect(setModeMock).toHaveBeenCalledWith('event-id', 'MANAGERS', 2);
    });
  });

  it('renders two manager selectors from the PR14 plan in MANAGERS mode', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), [], managerConfiguration(2));

    expect(fixture.nativeElement.textContent).toContain('Directores técnicos');
    expect(fixture.nativeElement.querySelectorAll('select')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Falta asignar 2 DTs');
  });

  it('renders three manager selectors and prevents duplicate options', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(14), [], managerConfiguration(3));
    const selects = fixture.nativeElement.querySelectorAll(
      'select',
    ) as NodeListOf<HTMLSelectElement>;

    selects[0].value = 'm-1';
    selects[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(selects).toHaveLength(3);
    const duplicateOption = selects[1].querySelector('option[value="m-1"]') as HTMLOptionElement;
    expect(duplicateOption.disabled).toBe(true);
  });

  it('shows Managers mode read-only to a MEMBER', async () => {
    const fixture = await setupFixture(
      'MEMBER',
      sampleAttendees(10),
      [],
      managerConfiguration(2, ['m-1', 'm-2']),
    );

    expect(fixture.nativeElement.textContent).toContain('👔 Directores Técnicos');
    expect(fixture.nativeElement.textContent).toContain('Jugador 1');
    expect(fixture.nativeElement.querySelectorAll('select')).toHaveLength(0);
  });

  it('saves a complete manager configuration atomically', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), [], managerConfiguration(2));
    const selects = fixture.nativeElement.querySelectorAll(
      'select',
    ) as NodeListOf<HTMLSelectElement>;
    selects[0].value = 'm-1';
    selects[0].dispatchEvent(new Event('change'));
    selects[1].value = 'm-2';
    selects[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const saveButton = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Guardar DTs'),
    );
    saveButton?.click();

    await vi.waitFor(() => {
      expect(saveManagersMock).toHaveBeenCalledWith('event-id', [
        { groupMemberId: 'm-1', teamId: 'team-1' },
        { groupMemberId: 'm-2', teamId: 'team-2' },
      ]);
    });
  });

  it('allows manual swap between players when two players are clicked', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), sampleTeams());

    const playerRows = fixture.nativeElement.querySelectorAll(
      '.team-gen__team-player',
    ) as NodeListOf<HTMLElement>;

    // Click player 1 in team A
    playerRows[0].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tocá otro jugador para intercambiar');

    // Click player 1 in team B
    playerRows[5].click();
    fixture.detectChanges();

    // Swap is completed, banner disappears
    expect(fixture.nativeElement.textContent).not.toContain('Tocá otro jugador para intercambiar');
  });

  it('saves teams and navigates back with feedback', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), sampleTeams());

    const confirmBtn = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Confirmar equipos'),
    );
    confirmBtn?.click();
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(saveTeamsMock).toHaveBeenCalledWith('event-id', sampleTeams());
      expect(navigateMock).toHaveBeenCalledWith(['/events', 'event-id'], {
        state: {
          eventFeedback: '¡Equipos armados y guardados con éxito! (2 equipos).',
        },
      });
    });
  });

  async function setupFixture(
    role: GroupMemberRole,
    attendees: readonly AttendanceRecord[],
    existingTeams: readonly GeneratedTeam[],
    managerConfig: TeamManagerConfiguration = managerConfiguration(0, [], 'RANDOM'),
  ): Promise<ComponentFixture<TeamGenerationPage>> {
    saveTeamsMock = vi.fn().mockResolvedValue(undefined);
    saveManagersMock = vi.fn().mockResolvedValue(undefined);
    setModeMock = vi.fn().mockResolvedValue(undefined);
    navigateMock = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [TeamGenerationPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ eventId: 'event-id' }) } },
        },
        {
          provide: Router,
          useValue: { navigate: navigateMock },
        },
        {
          provide: EventService,
          useValue: { get: vi.fn().mockResolvedValue(sampleEvent()) },
        },
        {
          provide: GroupService,
          useValue: {
            get: vi.fn().mockResolvedValue({
              avatarPath: null,
              avatarUrl: null,
              description: null,
              id: 'group-id',
              members: sampleGroupMembers(),
              membership: {
                avatarPath: null,
                avatarUrl: null,
                deactivatedAt: null,
                displayName: 'Gonzalo',
                groupId: 'group-id',
                id: 'm-1',
                invitation: 'LINKED',
                nickname: null,
                profileId: 'profile-id',
                role,
              },
              name: 'Los del Miércoles',
            }),
          },
        },
        {
          provide: AttendanceService,
          useValue: { list: vi.fn().mockResolvedValue(attendees) },
        },
        {
          provide: TeamService,
          useValue: {
            getTeams: vi.fn().mockResolvedValue(existingTeams),
            saveTeams: saveTeamsMock,
          },
        },
        {
          provide: TeamManagerService,
          useValue: {
            getConfiguration: vi.fn().mockResolvedValue(managerConfig),
            saveManagers: saveManagersMock,
            setMode: setModeMock,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TeamGenerationPage);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Cargando configuración…');
    });
    return fixture;
  }
});

function sampleEvent(): WeeklyEvent {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: '2026-10-01T10:00:00Z',
    createdBy: 'profile-id',
    currencyCode: 'ARS',
    groupId: 'group-id',
    id: 'event-id',
    location: 'La Canchita',
    startsAt: '2026-10-08T00:30:00Z',
    status: 'OPEN',
    title: null,
    updatedAt: '2026-10-01T10:00:00Z',
  };
}

function sampleAttendees(count: number): readonly AttendanceRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    actualDinner: 'UNSET',
    actualFootball: 'YES',
    avatarPath: null,
    avatarUrl: null,
    dinnerResponse: 'YES',
    displayName: `Jugador ${i + 1}`,
    eventId: 'event-id',
    footballResponse: 'YES',
    groupMemberId: `m-${i + 1}`,
    isCurrentUser: i === 0,
    isGuest: false,
    membershipActive: true,
    participantId: `p-${i + 1}`,
  }));
}

function sampleGroupMembers() {
  return Array.from({ length: 14 }, (_, index) => ({
    avatarPath: null,
    avatarUrl: null,
    deactivatedAt: null,
    displayName: `Jugador ${index + 1}`,
    groupId: 'group-id',
    id: `m-${index + 1}`,
    invitation: 'LINKED' as const,
    nickname: null,
    profileId: `profile-${index + 1}`,
    role: index === 0 ? ('ADMIN' as const) : ('MEMBER' as const),
  }));
}

function managerConfiguration(
  teamCount: number,
  managers: readonly string[] = [],
  mode: TeamManagerConfiguration['mode'] = 'MANAGERS',
): TeamManagerConfiguration {
  return {
    eventStatus: 'OPEN',
    mode,
    teams: Array.from({ length: teamCount }, (_, index) => ({
      manager: managers[index]
        ? {
            avatarUrl: null,
            displayName: `Jugador ${Number(managers[index].split('-')[1])}`,
            groupMemberId: managers[index],
            nickname: null,
          }
        : null,
      teamId: `team-${index + 1}`,
      teamName: `Equipo ${String.fromCharCode(65 + index)}`,
      teamPosition: index + 1,
    })),
  };
}

function sampleTeams(): readonly GeneratedTeam[] {
  const players = Array.from({ length: 10 }, (_, i) => ({
    avatarUrl: null,
    displayName: `Jugador ${i + 1}`,
    groupMemberId: `m-${i + 1}`,
    id: `p-${i + 1}`,
    isGuest: false,
    participantId: `p-${i + 1}`,
  }));

  return [
    {
      id: 'team-1',
      name: 'Equipo A',
      position: 1,
      players: players.slice(0, 5),
    },
    {
      id: 'team-2',
      name: 'Equipo B',
      position: 2,
      players: players.slice(5, 10),
    },
  ];
}
