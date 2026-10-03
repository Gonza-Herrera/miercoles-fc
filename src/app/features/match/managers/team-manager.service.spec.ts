import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client';
import { TeamManagerOperationError, TeamManagerService } from './team-manager.service';

describe('TeamManagerService', () => {
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

  it('maps an event-specific Managers configuration', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          event_status: 'OPEN',
          formation_mode: 'MANAGERS',
          manager_avatar_path: null,
          manager_display_name: 'Gazpar',
          manager_group_member_id: 'member-1',
          manager_nickname: 'Gas',
          team_id: 'team-1',
          team_name: 'Equipo A',
          team_position: 1,
        },
        {
          event_status: 'OPEN',
          formation_mode: 'MANAGERS',
          manager_avatar_path: null,
          manager_display_name: null,
          manager_group_member_id: null,
          manager_nickname: null,
          team_id: 'team-2',
          team_name: 'Equipo B',
          team_position: 2,
        },
      ],
      error: null,
    });

    const configuration = await TestBed.inject(TeamManagerService).getConfiguration('event-1');

    expect(configuration.mode).toBe('MANAGERS');
    expect(configuration.teams[0].manager?.displayName).toBe('Gazpar');
    expect(configuration.teams[1].manager).toBeNull();
  });

  it('saves the selected mode with PR14 team count', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await TestBed.inject(TeamManagerService).setMode('event-1', 'MANAGERS', 3);

    expect(rpc).toHaveBeenCalledWith('set_event_team_formation_mode', {
      p_event_id: 'event-1',
      p_mode: 'MANAGERS',
      p_team_count: 3,
    });
  });

  it('saves all manager assignments atomically', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await TestBed.inject(TeamManagerService).saveManagers('event-1', [
      { groupMemberId: 'member-1', teamId: 'team-1' },
      { groupMemberId: 'member-2', teamId: 'team-2' },
    ]);

    expect(rpc).toHaveBeenCalledWith('configure_event_team_managers', {
      p_assignments: [
        { group_member_id: 'member-1', team_id: 'team-1' },
        { group_member_id: 'member-2', team_id: 'team-2' },
      ],
      p_event_id: 'event-1',
    });
  });

  it('maps lifecycle failures without exposing database copy', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'TEAM_EVENT_READ_ONLY' } });

    await expect(
      TestBed.inject(TeamManagerService).setMode('event-1', 'RANDOM', null),
    ).rejects.toEqual(new TeamManagerOperationError('READ_ONLY'));
  });
});
