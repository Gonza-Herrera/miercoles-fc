import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { TeamLineupState } from '../../lineup/team-lineup.models';
import { TeamLineupService } from '../../lineup/team-lineup.service';
import { TeamLineupPage } from './team-lineup-page';

describe('TeamLineupPage', () => {
  const get = vi.fn();
  const swap = vi.fn();

  beforeEach(() => {
    get.mockReset();
    swap.mockReset().mockResolvedValue(undefined);
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  });

  it('renders three dynamic tabs and deterministic markers for Team A', async () => {
    const fixture = await setupFixture(lineupState());

    expect(fixture.nativeElement.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.pitch-player')).toHaveLength(5);
    expect(fixture.nativeElement.textContent).toContain('Mati');
  });

  it('keeps tab selection and active lineup synchronized', async () => {
    const fixture = await setupFixture(lineupState());
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>;

    tabs[1].click();
    fixture.detectChanges();

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Diego');
  });

  it('uses the same selected Team state when swiping', async () => {
    const fixture = await setupFixture(lineupState());
    const panel = fixture.nativeElement.querySelector('.lineup-panel') as HTMLElement;
    const touch = (type: string, clientX: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'changedTouches', { value: [{ clientX }] });
      panel.dispatchEvent(event);
    };

    touch('touchstart', 300);
    touch('touchend', 180);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected'),
    ).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Diego');
  });

  it('shows a Manager independently from the same person as a player', async () => {
    const fixture = await setupFixture(lineupState());

    expect(fixture.nativeElement.textContent).toContain('DT · Gazpar');
    expect(fixture.nativeElement.querySelectorAll('.pitch-player')).toHaveLength(5);
    expect(fixture.nativeElement.textContent.match(/Gazpar/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show fake Managers in RANDOM mode', async () => {
    const fixture = await setupFixture(
      lineupState({
        formationMode: 'RANDOM',
        teams: lineupState().teams.map((team) => ({ ...team, manager: null })),
      }),
    );

    expect(fixture.nativeElement.textContent).not.toContain('DT ·');
  });

  it('keeps MEMBER lineups read-only', async () => {
    const fixture = await setupFixture(lineupState({ canEdit: false }));

    expect(
      [...fixture.nativeElement.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('Editar'),
      ),
    ).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.pitch-player[aria-pressed]')).toHaveLength(0);
  });

  it('selects two cross-Team players and confirms an atomic swap', async () => {
    get.mockResolvedValue(lineupState());
    const fixture = await setupFixture(undefined, false);
    const editButton = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Editar'),
    );
    editButton?.click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.pitch-player') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.pitch-player') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Intercambiar jugadores');
    const confirm = [...fixture.nativeElement.querySelectorAll('dialog button')].find((button) =>
      button.textContent?.includes('Intercambiar'),
    );
    confirm?.click();

    await vi.waitFor(() => {
      expect(swap).toHaveBeenCalledWith('event-1', 'participant-a1', 'participant-b1');
    });
  });

  it('shows a no-teams state without rendering an empty pitch', async () => {
    const fixture = await setupFixture(lineupState({ teams: [] }));

    expect(fixture.nativeElement.textContent).toContain('Los equipos todavía no están armados');
    expect(fixture.nativeElement.querySelector('.pitch')).toBeNull();
  });

  async function setupFixture(
    state: TeamLineupState | undefined,
    configureGet = true,
  ): Promise<ComponentFixture<TeamLineupPage>> {
    if (configureGet && state) get.mockResolvedValue(state);
    await TestBed.configureTestingModule({
      imports: [TeamLineupPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ eventId: 'event-1' }) } },
        },
        { provide: TeamLineupService, useValue: { get, swap } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TeamLineupPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
});

function lineupState(overrides: Partial<TeamLineupState> = {}): TeamLineupState {
  const players = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      avatarUrl: null,
      displayName:
        index === 0 && prefix === 'A' ? 'Gazpar Herrera' : `${prefix} Jugador ${index + 1}`,
      eventParticipantId: `participant-${prefix.toLowerCase()}${index + 1}`,
      isGuest: prefix === 'B' && index === 0,
      nickname:
        index === 1 && prefix === 'A' ? 'Mati' : index === 0 && prefix === 'B' ? 'Diego' : null,
    }));
  return {
    canEdit: true,
    eventId: 'event-1',
    eventStatus: 'IN_PROGRESS',
    formationMode: 'MANAGERS',
    isComplete: true,
    teams: [
      {
        manager: {
          avatarUrl: null,
          displayName: 'Gazpar Herrera',
          groupMemberId: 'member-1',
          nickname: 'Gazpar',
        },
        name: 'Equipo A',
        order: 1,
        players: players('A', 5),
        teamId: 'team-1',
      },
      { manager: null, name: 'Equipo B', order: 2, players: players('B', 5), teamId: 'team-2' },
      { manager: null, name: 'Equipo C', order: 3, players: players('C', 4), teamId: 'team-3' },
    ],
    ...overrides,
  };
}
