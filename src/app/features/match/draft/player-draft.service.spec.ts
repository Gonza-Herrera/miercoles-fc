import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client';
import { PlayerDraftOperationError, PlayerDraftService } from './player-draft.service';

describe('PlayerDraftService', () => {
  const rpc = vi.fn();
  const createSignedUrl = vi.fn();
  const removeChannel = vi.fn();
  const on = vi.fn();
  const subscribe = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    createSignedUrl.mockReset().mockResolvedValue({ data: null, error: null });
    removeChannel.mockReset().mockResolvedValue(undefined);
    on.mockReset();
    subscribe.mockReset();

    const channel = { on, subscribe };
    on.mockReturnValue(channel);
    subscribe.mockReturnValue(channel);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPABASE_CLIENT,
          useValue: {
            channel: vi.fn().mockReturnValue(channel),
            removeChannel,
            rpc,
            storage: { from: () => ({ createSignedUrl }) },
          } as unknown as SupabaseClient<Database>,
        },
      ],
    });
  });

  it('loads the complete draft snapshot and signs player avatars', async () => {
    rpc.mockResolvedValue({
      data: rawState(),
      error: null,
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/avatar' },
      error: null,
    });

    const result = await TestBed.inject(PlayerDraftService).get('event-1');

    expect(rpc).toHaveBeenCalledWith('get_event_player_draft', { p_event_id: 'event-1' });
    expect(result.availablePlayers[0].avatarUrl).toBe('https://signed.example/avatar');
    expect(result.teams[0].players).toHaveLength(1);
  });

  it('sends the optimistic version with every selection', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await TestBed.inject(PlayerDraftService).pick('event-1', 'participant-2', 7);

    expect(rpc).toHaveBeenCalledWith('select_draft_player', {
      p_event_id: 'event-1',
      p_event_participant_id: 'participant-2',
      p_expected_version: 7,
    });
  });

  it('maps a concurrent selection to a safe stale-state error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'DRAFT_STALE_STATE' } });

    await expect(
      TestBed.inject(PlayerDraftService).pick('event-1', 'participant-2', 7),
    ).rejects.toEqual(new PlayerDraftOperationError('STALE'));
  });

  it('subscribes to both draft sources and removes the channel on cleanup', () => {
    const service = TestBed.inject(PlayerDraftService);
    const onChange = vi.fn();
    const onStatus = vi.fn();
    const cleanup = service.subscribe('event-1', onChange, onStatus);

    expect(on).toHaveBeenCalledTimes(2);
    expect(on.mock.calls[0][1]).toMatchObject({ table: 'event_drafts' });
    expect(on.mock.calls[1][1]).toMatchObject({ table: 'team_members' });
    expect(on.mock.calls[0][1].filter).toBe('event_id=eq.event-1');

    subscribe.mock.calls[0][0]('SUBSCRIBED');
    expect(onStatus).toHaveBeenLastCalledWith('CONNECTED');
    expect(onChange).toHaveBeenCalledOnce();

    cleanup();

    expect(removeChannel).toHaveBeenCalledOnce();
  });
});

function rawState() {
  return {
    availablePlayers: [
      {
        avatarPath: 'members/group/member/avatar',
        displayName: 'Matías',
        isGuest: false,
        participantId: 'participant-2',
      },
    ],
    canCurrentUserPick: true,
    canStart: false,
    currentManagerName: 'Gazpar',
    currentTeamId: 'team-1',
    currentUserTeamId: 'team-1',
    eventId: 'event-1',
    eventStatus: 'IN_PROGRESS',
    formationMode: 'MANAGERS',
    pickNumber: 1,
    status: 'IN_PROGRESS',
    teams: [
      {
        capacity: 5,
        manager: { displayName: 'Gazpar', groupMemberId: 'member-1', nickname: null },
        players: [
          {
            avatarPath: null,
            displayName: 'Gazpar',
            isGuest: false,
            participantId: 'participant-1',
          },
        ],
        teamId: 'team-1',
        teamName: 'Equipo A',
        teamPosition: 1,
      },
    ],
    version: 7,
  };
}
