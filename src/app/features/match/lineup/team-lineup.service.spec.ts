import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client';
import { TeamLineupOperationError, TeamLineupService } from './team-lineup.service';

describe('TeamLineupService', () => {
  const rpc = vi.fn();
  const createSignedUrl = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    createSignedUrl.mockReset().mockResolvedValue({ data: null, error: null });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPABASE_CLIENT,
          useValue: {
            rpc,
            storage: { from: () => ({ createSignedUrl }) },
          } as unknown as SupabaseClient<Database>,
        },
      ],
    });
  });

  it('maps persisted teams, managers, nicknames and guests', async () => {
    rpc.mockResolvedValue({ data: rawState(), error: null });

    const result = await TestBed.inject(TeamLineupService).get('event-1');

    expect(rpc).toHaveBeenCalledWith('get_event_team_lineup', { p_event_id: 'event-1' });
    expect(result.teams[0].manager?.nickname).toBe('Gas');
    expect(result.teams[0].players[0].nickname).toBe('Mati');
    expect(result.teams[1].players[0].isGuest).toBe(true);
  });

  it('sends EventParticipant identities to the atomic swap RPC', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await TestBed.inject(TeamLineupService).swap('event-1', 'participant-1', 'participant-2');

    expect(rpc).toHaveBeenCalledWith('swap_event_team_players', {
      p_event_id: 'event-1',
      p_first_participant_id: 'participant-1',
      p_second_participant_id: 'participant-2',
    });
  });

  it('maps lifecycle failures without exposing database details', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'LINEUP_EVENT_READ_ONLY' } });

    await expect(
      TestBed.inject(TeamLineupService).swap('event-1', 'participant-1', 'participant-2'),
    ).rejects.toEqual(new TeamLineupOperationError('READ_ONLY'));
  });
});

function rawState() {
  return {
    canEdit: true,
    eventId: 'event-1',
    eventStatus: 'IN_PROGRESS',
    formationMode: 'MANAGERS',
    isComplete: true,
    teams: [
      {
        manager: {
          avatarPath: null,
          displayName: 'Gazpar Herrera',
          groupMemberId: 'member-1',
          nickname: 'Gas',
        },
        name: 'Equipo A',
        order: 1,
        players: [
          {
            avatarPath: null,
            displayName: 'Matías Herrera',
            eventParticipantId: 'participant-1',
            isGuest: false,
            nickname: 'Mati',
          },
        ],
        teamId: 'team-1',
      },
      {
        manager: null,
        name: 'Equipo B',
        order: 2,
        players: [
          {
            avatarPath: null,
            displayName: 'Invitado',
            eventParticipantId: 'participant-2',
            isGuest: true,
            nickname: null,
          },
        ],
        teamId: 'team-2',
      },
    ],
  };
}
