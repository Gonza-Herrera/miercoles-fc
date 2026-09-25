import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../../../core/supabase/supabase-client';
import {
  EventParticipantRow,
  GuestOperationError,
  GuestParticipant,
  GuestParticipantInput,
} from '../models/participant.models';

@Injectable({ providedIn: 'root' })
export class GuestParticipantService {
  private readonly client = inject(SUPABASE_CLIENT);

  async list(eventId: string): Promise<readonly GuestParticipant[]> {
    const { data, error } = await this.client
      .from('event_participants')
      .select(
        'id, event_id, group_member_id, guest_display_name, football_response, dinner_response, actual_football, actual_dinner, created_at, updated_at, created_by, cancelled_at',
      )
      .eq('event_id', eventId)
      .is('group_member_id', null)
      .order('created_at');

    if (error) throw new GuestOperationError('LOAD');
    return (data ?? []).map((participant) => this.map(participant));
  }

  async add(eventId: string, input: GuestParticipantInput): Promise<GuestParticipant> {
    const { data, error } = await this.client.rpc('add_guest_participant', {
      p_dines: input.dines,
      p_display_name: input.displayName,
      p_event_id: eventId,
      p_plays: input.plays,
    });
    const participant = data?.[0];
    if (error || !participant) throw this.mapError(error);
    return this.map(participant);
  }

  async update(participantId: string, input: GuestParticipantInput): Promise<GuestParticipant> {
    const { data, error } = await this.client.rpc('update_guest_participant', {
      p_dines: input.dines,
      p_display_name: input.displayName,
      p_event_participant_id: participantId,
      p_plays: input.plays,
    });
    const participant = data?.[0];
    if (error || !participant) throw this.mapError(error);
    return this.map(participant);
  }

  async cancel(participantId: string): Promise<GuestParticipant> {
    const { data, error } = await this.client.rpc('cancel_guest_participant', {
      p_event_participant_id: participantId,
    });
    const participant = data?.[0];
    if (error || !participant) throw this.mapError(error);
    return this.map(participant);
  }

  private map(
    participant: Pick<
      EventParticipantRow,
      | 'cancelled_at'
      | 'dinner_response'
      | 'event_id'
      | 'football_response'
      | 'guest_display_name'
      | 'id'
    >,
  ): GuestParticipant {
    return {
      cancelledAt: participant.cancelled_at,
      dinnerResponse: participant.dinner_response,
      displayName: participant.guest_display_name ?? 'Invitado',
      eventId: participant.event_id,
      footballResponse: participant.football_response,
      id: participant.id,
    };
  }

  private mapError(error: { message?: string } | null): GuestOperationError {
    const message = error?.message ?? '';
    if (message.includes('GUEST_ADMIN_REQUIRED') || message.includes('permission denied')) {
      return new GuestOperationError('PERMISSION');
    }
    if (message.includes('GUEST_EVENT_CLOSED')) return new GuestOperationError('CLOSED');
    if (message.includes('GUEST_NAME_INVALID') || message.includes('GUEST_ACTIVITY_REQUIRED')) {
      return new GuestOperationError('VALIDATION');
    }
    if (message.includes('GUEST_NOT_FOUND') || message.includes('GUEST_EVENT_NOT_FOUND')) {
      return new GuestOperationError('NOT_FOUND');
    }
    return new GuestOperationError('SAVE');
  }
}
