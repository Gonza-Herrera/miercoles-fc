import { Database } from '../../core/supabase/database.types';

export type AttendanceActivity = 'dinner' | 'football';
export type AttendanceMode = AttendanceActivity | 'both';
export type AttendanceResponse = Database['public']['Enums']['attendance_response'];
export type ActualAttendanceStatus = Database['public']['Enums']['actual_attendance_status'];

export interface AttendanceRecord {
  readonly actualDinner: ActualAttendanceStatus;
  readonly actualFootball: ActualAttendanceStatus;
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly dinnerResponse: AttendanceResponse;
  readonly displayName: string;
  readonly eventId: string;
  readonly footballResponse: AttendanceResponse;
  readonly groupMemberId: string | null;
  readonly isCurrentUser: boolean;
  readonly isGuest: boolean;
  readonly membershipActive: boolean;
  readonly participantId: string | null;
}

export interface MatchAttendanceItemInput {
  readonly groupMemberId?: string | null;
  readonly participantId?: string | null;
  readonly attended: boolean;
}

export interface SavedAttendance {
  readonly dinnerResponse: AttendanceResponse;
  readonly footballResponse: AttendanceResponse;
  readonly groupMemberId: string;
  readonly participantId: string;
}

export type AttendanceOperation =
  | 'CLOSED'
  | 'LOAD'
  | 'NOT_FOUND'
  | 'NOT_OPEN'
  | 'PERMISSION'
  | 'SAVE'
  | 'SETTLEMENT_LOCKED'
  | 'VALIDATION';

export class AttendanceOperationError extends Error {
  constructor(readonly operation: AttendanceOperation) {
    super(operation);
    this.name = 'AttendanceOperationError';
  }
}

export function attendanceResponseLabel(response: AttendanceResponse): string {
  const labels: Readonly<Record<AttendanceResponse, string>> = {
    UNKNOWN: 'Sin responder',
    YES: 'Sí',
    NO: 'No',
  };
  return labels[response];
}
