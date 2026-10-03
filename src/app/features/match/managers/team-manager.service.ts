import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client';
import {
  TeamFormationMode,
  TeamManagerAssignment,
  TeamManagerConfiguration,
} from './team-manager.models';

interface TeamManagerRpcRow {
  readonly event_status: TeamManagerConfiguration['eventStatus'];
  readonly formation_mode: TeamFormationMode;
  readonly manager_avatar_path: string | null;
  readonly manager_display_name: string | null;
  readonly manager_group_member_id: string | null;
  readonly manager_nickname: string | null;
  readonly team_id: string | null;
  readonly team_name: string | null;
  readonly team_position: number | null;
}

interface RpcResult<T> {
  readonly data: T | null;
  readonly error: { readonly message?: string } | null;
}

interface TeamManagerRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<RpcResult<readonly TeamManagerRpcRow[] | null>>;
}

export type TeamManagerOperation =
  | 'ACCOUNT_REQUIRED'
  | 'CONFLICT'
  | 'INCOMPLETE'
  | 'LOAD'
  | 'PERMISSION'
  | 'READ_ONLY'
  | 'SAVE_MODE'
  | 'SAVE_MANAGERS';

export class TeamManagerOperationError extends Error {
  constructor(readonly operation: TeamManagerOperation) {
    super(operation);
    this.name = 'TeamManagerOperationError';
  }
}

@Injectable({ providedIn: 'root' })
export class TeamManagerService {
  private readonly client = inject(SUPABASE_CLIENT);

  async getConfiguration(eventId: string): Promise<TeamManagerConfiguration> {
    const { data, error } = await this.rpc('get_event_team_manager_configuration', {
      p_event_id: eventId,
    });
    if (error || !data?.length) throw this.mapError(error, 'LOAD');

    const teams: TeamManagerAssignment[] = [];
    for (const row of data) {
      if (!row.team_id || !row.team_name || row.team_position === null) continue;
      teams.push({
        manager:
          row.manager_group_member_id && row.manager_display_name
            ? {
                avatarUrl: await this.signedAvatar(row.manager_avatar_path),
                displayName: row.manager_display_name,
                groupMemberId: row.manager_group_member_id,
                nickname: row.manager_nickname,
              }
            : null,
        teamId: row.team_id,
        teamName: row.team_name,
        teamPosition: row.team_position,
      });
    }

    return {
      eventStatus: data[0].event_status,
      mode: data[0].formation_mode,
      teams: teams.sort((left, right) => left.teamPosition - right.teamPosition),
    };
  }

  async setMode(eventId: string, mode: TeamFormationMode, teamCount: number | null): Promise<void> {
    const { error } = await this.rpc('set_event_team_formation_mode', {
      p_event_id: eventId,
      p_mode: mode,
      p_team_count: teamCount,
    });
    if (error) throw this.mapError(error, 'SAVE_MODE');
  }

  async saveManagers(
    eventId: string,
    assignments: readonly { readonly groupMemberId: string; readonly teamId: string }[],
  ): Promise<void> {
    const { error } = await this.rpc('configure_event_team_managers', {
      p_assignments: assignments.map((assignment) => ({
        group_member_id: assignment.groupMemberId,
        team_id: assignment.teamId,
      })),
      p_event_id: eventId,
    });
    if (error) throw this.mapError(error, 'SAVE_MANAGERS');
  }

  private rpc(name: string, args: Record<string, unknown>) {
    return (this.client as unknown as TeamManagerRpcClient).rpc(name, args);
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
    fallback: 'LOAD' | 'SAVE_MODE' | 'SAVE_MANAGERS',
  ): TeamManagerOperationError {
    const message = error?.message ?? '';
    if (message.includes('ACCOUNT_REQUIRED'))
      return new TeamManagerOperationError('ACCOUNT_REQUIRED');
    if (message.includes('INCOMPLETE')) return new TeamManagerOperationError('INCOMPLETE');
    if (message.includes('DUPLICATE') || message.includes('23505')) {
      return new TeamManagerOperationError('CONFLICT');
    }
    if (message.includes('READ_ONLY')) return new TeamManagerOperationError('READ_ONLY');
    if (
      message.includes('AUTH_REQUIRED') ||
      message.includes('ADMIN_REQUIRED') ||
      message.includes('ACCESS_DENIED') ||
      message.includes('permission denied')
    ) {
      return new TeamManagerOperationError('PERMISSION');
    }
    return new TeamManagerOperationError(fallback);
  }
}
