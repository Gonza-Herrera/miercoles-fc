import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client';
import { TeamLineup, TeamLineupPlayer, TeamLineupState } from './team-lineup.models';

interface RawPlayer extends Omit<TeamLineupPlayer, 'avatarUrl'> {
  readonly avatarPath: string | null;
}

interface RawLineupState extends Omit<TeamLineupState, 'teams'> {
  readonly teams: readonly (Omit<TeamLineup, 'manager' | 'players'> & {
    readonly manager: null | {
      readonly avatarPath: string | null;
      readonly displayName: string;
      readonly groupMemberId: string;
      readonly nickname: string | null;
    };
    readonly players: readonly RawPlayer[];
  })[];
}

export type TeamLineupOperation = 'CONFLICT' | 'LOAD' | 'PERMISSION' | 'READ_ONLY' | 'SWAP';

export class TeamLineupOperationError extends Error {
  constructor(readonly operation: TeamLineupOperation) {
    super(operation);
    this.name = 'TeamLineupOperationError';
  }
}

@Injectable({ providedIn: 'root' })
export class TeamLineupService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<TeamLineupState> {
    const { data, error } = await this.client.rpc('get_event_team_lineup', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');

    const raw = data as unknown as RawLineupState;
    return {
      ...raw,
      teams: await Promise.all(
        raw.teams.map(async (team) => ({
          ...team,
          manager: team.manager
            ? {
                ...team.manager,
                avatarUrl: await this.signedAvatar(team.manager.avatarPath),
              }
            : null,
          players: await Promise.all(
            team.players.map(async (player) => ({
              avatarUrl: await this.signedAvatar(player.avatarPath),
              displayName: player.displayName,
              eventParticipantId: player.eventParticipantId,
              isGuest: player.isGuest,
              nickname: player.nickname,
            })),
          ),
        })),
      ),
    };
  }

  async swap(eventId: string, firstParticipantId: string, secondParticipantId: string) {
    const { error } = await this.client.rpc('swap_event_team_players', {
      p_event_id: eventId,
      p_first_participant_id: firstParticipantId,
      p_second_participant_id: secondParticipantId,
    });
    if (error) throw this.mapError(error, 'SWAP');
  }

  private async signedAvatar(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await this.client.storage
      .from('group-assets')
      .createSignedUrl(path, 300);
    return error ? null : data.signedUrl;
  }

  private mapError(
    error: { readonly message?: string } | null,
    fallback: 'LOAD' | 'SWAP',
  ): TeamLineupOperationError {
    const message = error?.message ?? '';
    if (message.includes('READ_ONLY')) return new TeamLineupOperationError('READ_ONLY');
    if (message.includes('NOT_FOUND') || message.includes('SAME_TEAM')) {
      return new TeamLineupOperationError('CONFLICT');
    }
    if (
      message.includes('AUTH_REQUIRED') ||
      message.includes('ADMIN_REQUIRED') ||
      message.includes('ACCESS_DENIED') ||
      message.includes('permission denied')
    ) {
      return new TeamLineupOperationError('PERMISSION');
    }
    return new TeamLineupOperationError(fallback);
  }
}
