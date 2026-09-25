import { Database } from '../../../../core/supabase/database.types';

export type EventParticipantRow = Database['public']['Tables']['event_participants']['Row'];

export interface GuestParticipantInput {
  readonly displayName: string;
  readonly dines: boolean;
  readonly plays: boolean;
}

export interface GuestParticipant {
  readonly cancelledAt: string | null;
  readonly dinnerResponse: Database['public']['Enums']['attendance_response'];
  readonly displayName: string;
  readonly eventId: string;
  readonly footballResponse: Database['public']['Enums']['attendance_response'];
  readonly id: string;
}

export interface ParticipantMemberIdentity {
  readonly avatarUrl: string | null;
  readonly displayName: string;
}

export interface ParticipantPresentation {
  readonly avatarUrl: string | null;
  readonly cancelled: boolean;
  readonly dines: boolean;
  readonly displayName: string;
  readonly id: string;
  readonly identityLabel: 'Asistente' | 'Invitado';
  readonly isGuest: boolean;
  readonly plays: boolean;
}

export function toParticipantPresentation(
  participant: EventParticipantRow,
  member: ParticipantMemberIdentity | null = null,
): ParticipantPresentation {
  const isGuest = participant.group_member_id === null;

  return {
    avatarUrl: isGuest ? null : (member?.avatarUrl ?? null),
    cancelled: participant.cancelled_at !== null,
    dines: participant.dinner_response === 'YES',
    displayName: isGuest
      ? (participant.guest_display_name ?? 'Invitado')
      : (member?.displayName ?? 'Miembro'),
    id: participant.id,
    identityLabel: isGuest ? 'Invitado' : 'Asistente',
    isGuest,
    plays: participant.football_response === 'YES',
  };
}

export type GuestOperation = 'CLOSED' | 'LOAD' | 'NOT_FOUND' | 'PERMISSION' | 'VALIDATION' | 'SAVE';

export class GuestOperationError extends Error {
  constructor(readonly operation: GuestOperation) {
    super(operation);
    this.name = 'GuestOperationError';
  }
}
