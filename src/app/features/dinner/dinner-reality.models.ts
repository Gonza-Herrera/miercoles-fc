import { Database } from '../../core/supabase/database.types';
import { EventStatus } from '../events/event.models';

export type AttendanceResponse = Database['public']['Enums']['attendance_response'];
export type ActualAttendance = Database['public']['Enums']['actual_attendance_status'];

export interface DinnerRealityParticipant {
  readonly actualDinnerAttendance: ActualAttendance;
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly dinnerConfirmation: AttendanceResponse;
  readonly displayName: string;
  readonly groupMemberId: string | null;
  readonly isGuest: boolean;
  readonly participantId: string | null;
}

export interface DinnerExpense {
  readonly amountMinor: number;
  readonly createdAt: string;
  readonly description: string;
  readonly eventId: string;
  readonly id: string;
  readonly updatedAt: string;
}

export interface DinnerRealityView {
  readonly actualDinerCount: number;
  readonly attendanceRecorded: boolean;
  readonly attendanceRecordedAt: string | null;
  readonly canEdit: boolean;
  readonly currencyCode: string;
  readonly eventId: string;
  readonly eventStatus: EventStatus;
  readonly expenses: readonly DinnerExpense[];
  readonly participants: readonly DinnerRealityParticipant[];
  readonly totalExpenseMinor: number;
}

export interface DinnerAttendanceInput {
  readonly attended: boolean;
  readonly groupMemberId: string | null;
  readonly participantId: string | null;
}

export interface DinnerExpenseInput {
  readonly amountMinor: number;
  readonly description: string;
}

export type DinnerRealityOperation =
  | 'ATTENDANCE_CONFLICT'
  | 'ATTENDANCE_INVALID'
  | 'CONFLICT'
  | 'DELETE'
  | 'LOAD'
  | 'NOT_FOUND'
  | 'PERMISSION'
  | 'READ_ONLY'
  | 'SAVE_ATTENDANCE'
  | 'SAVE_EXPENSE'
  | 'VALIDATION';

export class DinnerRealityOperationError extends Error {
  constructor(readonly operation: DinnerRealityOperation) {
    super(operation);
    this.name = 'DinnerRealityOperationError';
  }
}

export function dinnerParticipantKey(
  participant: Pick<DinnerRealityParticipant, 'groupMemberId' | 'participantId'>,
): string {
  return participant.groupMemberId
    ? `member:${participant.groupMemberId}`
    : `guest:${participant.participantId ?? ''}`;
}

export function dinnerExpenseTotal(expenses: readonly DinnerExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amountMinor, 0);
}
