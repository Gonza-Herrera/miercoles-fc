import { Injectable, inject } from '@angular/core';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { GeneratedTeam, GeneratedTeamPlayer } from './domain/random-team-generator';

type TeamRpcRow = Database['public']['Functions']['get_event_teams']['Returns'][number];

export class TeamOperationError extends Error {
  constructor(readonly operation: 'LOAD' | 'SAVE' | 'PERMISSION' | 'CLOSED') {
    super(operation);
    this.name = 'TeamOperationError';
  }
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly client = inject(SUPABASE_CLIENT);

  async getTeams(eventId: string): Promise<readonly GeneratedTeam[]> {
    const { data, error } = await this.client.rpc('get_event_teams', {
      p_event_id: eventId,
    });

    if (error) throw this.mapError(error, 'LOAD');
    if (!data || data.length === 0) return [];

    return this.mapTeamsResponse(data);
  }

  async saveTeams(eventId: string, teams: readonly GeneratedTeam[]): Promise<void> {
    const payload = teams.map((team) => ({
      name: team.name,
      position: team.position,
      members: team.players.map((player) => ({
        group_member_id: player.groupMemberId ?? null,
        participant_id: player.participantId ?? null,
      })),
    }));

    const { error } = await this.client.rpc('save_event_teams', {
      p_event_id: eventId,
      p_teams: payload,
    });

    if (error) throw this.mapError(error, 'SAVE');
  }

  private async mapTeamsResponse(rows: readonly TeamRpcRow[]): Promise<readonly GeneratedTeam[]> {
    const teamsMap = new Map<
      string,
      { id: string; name: string; position: number; players: GeneratedTeamPlayer[] }
    >();

    for (const row of rows) {
      if (!teamsMap.has(row.team_id)) {
        teamsMap.set(row.team_id, {
          id: row.team_id,
          name: row.team_name,
          position: row.position,
          players: [],
        });
      }

      const team = teamsMap.get(row.team_id)!;
      const avatarUrl = await this.signedAvatar(row.avatar_path);

      team.players.push({
        avatarUrl,
        displayName: row.display_name,
        groupMemberId: row.group_member_id,
        id: row.participant_id ?? row.group_member_id ?? row.display_name,
        isGuest: row.is_guest,
        participantId: row.participant_id,
      });
    }

    return Array.from(teamsMap.values()).sort((a, b) => a.position - b.position);
  }

  private async signedAvatar(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await this.client.storage
      .from('group-assets')
      .createSignedUrl(path, 300);
    return error ? null : data.signedUrl;
  }

  private mapError(
    error: { message?: string } | null,
    fallback: 'LOAD' | 'SAVE',
  ): TeamOperationError {
    const message = error?.message ?? '';
    if (
      message.includes('TEAM_AUTH_REQUIRED') ||
      message.includes('TEAM_ADMIN_REQUIRED') ||
      message.includes('TEAM_ACCESS_DENIED') ||
      message.includes('permission denied')
    ) {
      return new TeamOperationError('PERMISSION');
    }
    if (message.includes('TEAM_EVENT_CLOSED')) {
      return new TeamOperationError('CLOSED');
    }
    return new TeamOperationError(fallback);
  }
}
