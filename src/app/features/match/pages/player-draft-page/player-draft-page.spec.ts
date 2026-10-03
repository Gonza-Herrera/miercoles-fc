import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { PlayerDraftState } from '../../draft/player-draft.models';
import { PlayerDraftService } from '../../draft/player-draft.service';
import { PlayerDraftPage } from './player-draft-page';

describe('PlayerDraftPage', () => {
  const get = vi.fn();
  const start = vi.fn();
  const pick = vi.fn();
  const unsubscribe = vi.fn();

  beforeEach(() => {
    get.mockReset();
    start.mockReset().mockResolvedValue(undefined);
    pick.mockReset().mockResolvedValue(undefined);
    unsubscribe.mockReset();
  });

  it('shows the available players and enables picks only for the current DT', async () => {
    const fixture = await setupFixture(state({ canCurrentUserPick: true }));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Sincronizado');
    });

    expect(fixture.nativeElement.textContent).toContain('Turno actual');
    expect(fixture.nativeElement.textContent).toContain('Gazpar');
    expect(fixture.nativeElement.textContent).toContain('Matías');
    expect(fixture.nativeElement.querySelector('.draft-player').disabled).toBe(false);
  });

  it('renders a synchronized read-only view for other members', async () => {
    const fixture = await setupFixture(state({ canCurrentUserPick: false }));

    expect(fixture.nativeElement.textContent).toContain('Esperando la selección');
    expect(fixture.nativeElement.querySelector('.draft-player').disabled).toBe(true);
  });

  it('lets an administrator start a configured draft', async () => {
    const notStarted = state({
      canCurrentUserPick: false,
      canStart: true,
      currentManagerName: null,
      currentTeamId: null,
      status: 'NOT_STARTED',
    });
    get.mockResolvedValueOnce(notStarted).mockResolvedValueOnce(state());
    const fixture = await setupFixture(undefined, false);
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((element) =>
      element.textContent?.includes('Comenzar draft'),
    );

    button?.click();

    await vi.waitFor(() => expect(start).toHaveBeenCalledWith('event-1'));
  });

  it('shows completed rosters without selection controls', async () => {
    const fixture = await setupFixture(
      state({
        availablePlayers: [],
        canCurrentUserPick: false,
        currentManagerName: null,
        currentTeamId: null,
        status: 'COMPLETED',
      }),
    );

    expect(fixture.nativeElement.textContent).toContain('Draft finalizado');
    expect(fixture.nativeElement.textContent).toContain('Todos los jugadores fueron asignados');
    expect(fixture.nativeElement.querySelector('.draft-player')).toBeNull();
  });

  async function setupFixture(
    initialState: PlayerDraftState | undefined,
    configureGet = true,
  ): Promise<ComponentFixture<PlayerDraftPage>> {
    if (configureGet && initialState) get.mockResolvedValue(initialState);

    await TestBed.configureTestingModule({
      imports: [PlayerDraftPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ eventId: 'event-1' }) } },
        },
        {
          provide: PlayerDraftService,
          useValue: {
            get,
            pick,
            start,
            subscribe: (
              _eventId: string,
              _onChange: () => void,
              onStatus: (status: string) => void,
            ) => {
              onStatus('CONNECTED');
              return unsubscribe;
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlayerDraftPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
});

function state(overrides: Partial<PlayerDraftState> = {}): PlayerDraftState {
  return {
    availablePlayers: [
      { avatarUrl: null, displayName: 'Matías', isGuest: false, participantId: 'p-2' },
    ],
    canCurrentUserPick: true,
    canStart: false,
    currentManagerName: 'Gazpar',
    currentTeamId: 'team-1',
    currentUserTeamId: 'team-1',
    eventId: 'event-1',
    eventStatus: 'IN_PROGRESS',
    formationMode: 'MANAGERS',
    pickNumber: 0,
    status: 'IN_PROGRESS',
    teams: [
      {
        capacity: 2,
        manager: { displayName: 'Gazpar', groupMemberId: 'm-1', nickname: null },
        players: [{ avatarUrl: null, displayName: 'Gazpar', isGuest: false, participantId: 'p-1' }],
        teamId: 'team-1',
        teamName: 'Equipo A',
        teamPosition: 1,
      },
    ],
    version: 1,
    ...overrides,
  };
}
