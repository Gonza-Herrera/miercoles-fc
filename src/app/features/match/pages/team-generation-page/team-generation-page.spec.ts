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
import { TeamService } from '../../team.service';
import { TeamGenerationPage } from './team-generation-page';

describe('TeamGenerationPage', () => {
  let saveTeamsMock: ReturnType<typeof vi.fn>;
  let navigateMock: ReturnType<typeof vi.fn>;

  it('loads available players and displays calculated formation plan hint', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees(10), []);

    expect(fixture.nativeElement.textContent).toContain('Armar equipos');
    expect(fixture.nativeElement.textContent).toContain('10 jugadores disponibles');
    expect(fixture.nativeElement.textContent).toContain('Se armarán 2 equipos (5 vs 5)');
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
  ): Promise<ComponentFixture<TeamGenerationPage>> {
    saveTeamsMock = vi.fn().mockResolvedValue(undefined);
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
              members: [],
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
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TeamGenerationPage);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Cargando jugadores convocados…');
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
    actualFootball: 'UNSET',
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
