import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../../../core/supabase/supabase-client';
import {
  DraftPlayer,
  DraftRealtimeStatus,
  DraftTeam,
  PlayerDraftState,
} from './player-draft.models';

interface RawDraftPlayer {
  readonly avatarPath: string | null;
  readonly displayName: string;
  readonly isGuest: boolean;
  readonly participantId: string;
}

interface RawDraftState extends Omit<PlayerDraftState, 'availablePlayers' | 'teams'> {
  readonly availablePlayers: readonly RawDraftPlayer[];
  readonly teams: readonly (Omit<DraftTeam, 'players'> & {
    readonly players: readonly RawDraftPlayer[];
  })[];
}

export type PlayerDraftOperation =
  | 'ALREADY_SELECTED'
  | 'LOAD'
  | 'NOT_CURRENT_MANAGER'
  | 'NOT_READY'
  | 'PERMISSION'
  | 'READ_ONLY'
  | 'SAVE'
  | 'STALE'
  | 'TEAM_FULL';

export class PlayerDraftOperationError extends Error {
  constructor(readonly operation: PlayerDraftOperation) {
    super(operation);
    this.name = 'PlayerDraftOperationError';
  }
}

@Injectable({ providedIn: 'root' })
export class PlayerDraftService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<PlayerDraftState> {
    const { data, error } = await this.client.rpc('get_event_player_draft', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');

    const raw = data as unknown as RawDraftState;
    return {
      ...raw,
      availablePlayers: await Promise.all(
        raw.availablePlayers.map((player) => this.mapPlayer(player)),
      ),
      teams: await Promise.all(
        raw.teams.map(async (team) => ({
          ...team,
          players: await Promise.all(team.players.map((player) => this.mapPlayer(player))),
        })),
      ),
    };
  }

  async start(eventId: string): Promise<void> {
    const { error } = await this.client.rpc('start_event_player_draft', {
      p_event_id: eventId,
    });
    if (error) throw this.mapError(error, 'SAVE');
  }

  async pick(eventId: string, participantId: string, expectedVersion: number): Promise<void> {
    const { error } = await this.client.rpc('select_draft_player', {
      p_event_id: eventId,
      p_event_participant_id: participantId,
      p_expected_version: expectedVersion,
    });
    if (error) throw this.mapError(error, 'SAVE');
  }

  subscribe(
    eventId: string,
    onChange: () => void,
    onStatus: (status: DraftRealtimeStatus) => void,
  ): () => void {
    onStatus('CONNECTING');
    const channel = this.client
      .channel(`player-draft:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', filter: `event_id=eq.${eventId}`, schema: 'public', table: 'event_drafts' },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: '*', filter: `event_id=eq.${eventId}`, schema: 'public', table: 'team_members' },
        onChange,
      )
      .subscribe((status) => {
        onStatus(status === 'SUBSCRIBED' ? 'CONNECTED' : 'DISCONNECTED');
        if (status === 'SUBSCRIBED') onChange();
      });

    return () => {
      void this.client.removeChannel(channel as RealtimeChannel);
    };
  }

  private async mapPlayer(player: RawDraftPlayer): Promise<DraftPlayer> {
    return {
      avatarUrl: await this.signedAvatar(player.avatarPath),
      displayName: player.displayName,
      isGuest: player.isGuest,
      participantId: player.participantId,
    };
  }

  private async signedAvatar(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await this.client.storage
      .from('group-assets')
      .createSignedUrl(path, 300);
    return error ? null : data.signedUrl;
  }

  private mapError(error: { readonly message?: string } | null, fallback: 'LOAD' | 'SAVE') {
    const message = error?.message ?? '';
    if (message.includes('STALE_STATE')) return new PlayerDraftOperationError('STALE');
    if (message.includes('ALREADY_SELECTED') || message.includes('23505')) {
      return new PlayerDraftOperationError('ALREADY_SELECTED');
    }
    if (message.includes('NOT_CURRENT_MANAGER')) {
      return new PlayerDraftOperationError('NOT_CURRENT_MANAGER');
    }
    if (message.includes('TEAM_FULL')) return new PlayerDraftOperationError('TEAM_FULL');
    if (
      message.includes('READ_ONLY') ||
      message.includes('NOT_IN_PROGRESS') ||
      message.includes('MUST_BE_COMPLETED')
    ) {
      return new PlayerDraftOperationError('READ_ONLY');
    }
    if (
      message.includes('REQUIRED') ||
      message.includes('INCOMPLETE') ||
      message.includes('MISMATCH')
    ) {
      return new PlayerDraftOperationError('NOT_READY');
    }
    if (
      message.includes('42501') ||
      message.includes('PERMISSION') ||
      message.includes('ACCESS_DENIED')
    ) {
      return new PlayerDraftOperationError('PERMISSION');
    }
    return new PlayerDraftOperationError(fallback);
  }
}
