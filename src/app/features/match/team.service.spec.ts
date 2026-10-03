import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { TeamOperationError, TeamService } from './team.service';

describe('TeamService', () => {
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

  it('fetches and maps team structures from RPC', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          actual_football: 'UNSET',
          avatar_path: null,
          display_name: 'Gonzalo',
          event_id: 'event-id',
          football_response: 'YES',
          group_member_id: 'm-1',
          is_guest: false,
          participant_id: 'p-1',
          position: 1,
          team_id: 't-1',
          team_name: 'Equipo A',
        },
        {
          actual_football: 'UNSET',
          avatar_path: null,
          display_name: 'Matías',
          event_id: 'event-id',
          football_response: 'YES',
          group_member_id: 'm-2',
          is_guest: false,
          participant_id: 'p-2',
          position: 2,
          team_id: 't-2',
          team_name: 'Equipo B',
        },
      ],
      error: null,
    });

    const service = TestBed.inject(TeamService);
    const teams = await service.getTeams('event-id');

    expect(rpc).toHaveBeenCalledWith('get_event_teams', { p_event_id: 'event-id' });
    expect(teams.length).toBe(2);
    expect(teams[0].name).toBe('Equipo A');
    expect(teams[0].players[0].displayName).toBe('Gonzalo');
  });

  it('saves teams via save_event_teams RPC', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const service = TestBed.inject(TeamService);

    await service.saveTeams('event-id', [
      {
        id: 't-1',
        name: 'Equipo A',
        position: 1,
        players: [
          {
            avatarUrl: null,
            displayName: 'Gonzalo',
            groupMemberId: 'm-1',
            id: 'p-1',
            isGuest: false,
            participantId: 'p-1',
          },
        ],
      },
    ]);

    expect(rpc).toHaveBeenCalledWith('save_event_teams', {
      p_event_id: 'event-id',
      p_teams: [
        {
          name: 'Equipo A',
          position: 1,
          members: [{ group_member_id: 'm-1', participant_id: 'p-1' }],
        },
      ],
    });
  });

  it('handles permission errors properly', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'TEAM_ADMIN_REQUIRED' } });
    const service = TestBed.inject(TeamService);

    await expect(service.saveTeams('event-id', [])).rejects.toEqual(
      new TeamOperationError('PERMISSION'),
    );
  });
});
