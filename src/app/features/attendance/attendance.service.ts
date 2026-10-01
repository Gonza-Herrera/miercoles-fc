import { Injectable, inject } from '@angular/core';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  AttendanceOperation,
  AttendanceOperationError,
  AttendanceRecord,
  AttendanceResponse,
  SavedAttendance,
} from './attendance.models';

type AttendanceRpcRow = Database['public']['Functions']['get_event_attendance']['Returns'][number];
type ParticipantRow = Database['public']['Tables']['event_participants']['Row'];

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly client = inject(SUPABASE_CLIENT);

  async list(eventId: string): Promise<readonly AttendanceRecord[]> {
    return this.load(eventId, true);
  }

  async listForDashboard(eventId: string): Promise<readonly AttendanceRecord[]> {
    return this.load(eventId, false);
  }

  private async load(
    eventId: string,
    includeSignedAvatars: boolean,
  ): Promise<readonly AttendanceRecord[]> {
    const { data, error } = await this.client.rpc('get_event_attendance', {
      p_event_id: eventId,
    });
    if (error) throw this.mapError(error, 'LOAD');

    return Promise.all((data ?? []).map((row) => this.mapRecord(row, includeSignedAvatars)));
  }

  async setFootball(eventId: string, response: AttendanceResponse): Promise<SavedAttendance> {
    return this.save('set_my_football_confirmation', eventId, response);
  }

  async setDinner(eventId: string, response: AttendanceResponse): Promise<SavedAttendance> {
    return this.save('set_my_dinner_confirmation', eventId, response);
  }

  private async save(
    rpc: 'set_my_dinner_confirmation' | 'set_my_football_confirmation',
    eventId: string,
    response: AttendanceResponse,
  ): Promise<SavedAttendance> {
    if (response === 'UNKNOWN') throw new AttendanceOperationError('VALIDATION');
    const { data, error } = await this.client.rpc(rpc, {
      p_event_id: eventId,
      p_response: response,
    });
    if (error || !data || !data.group_member_id) throw this.mapError(error, 'SAVE');
    return this.mapSaved(data);
  }

  private async mapRecord(
    row: AttendanceRpcRow,
    includeSignedAvatar: boolean,
  ): Promise<AttendanceRecord> {
    return {
      avatarPath: row.avatar_path,
      avatarUrl: includeSignedAvatar ? await this.signedAvatar(row.avatar_path) : null,
      dinnerResponse: row.dinner_response,
      displayName: row.display_name,
      eventId: row.event_id,
      footballResponse: row.football_response,
      groupMemberId: row.group_member_id,
      isCurrentUser: row.is_current_user,
      isGuest: row.is_guest,
      membershipActive: row.membership_active,
      participantId: row.participant_id,
    };
  }

  private mapSaved(row: ParticipantRow): SavedAttendance {
    return {
      dinnerResponse: row.dinner_response,
      footballResponse: row.football_response,
      groupMemberId: row.group_member_id!,
      participantId: row.id,
    };
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
    fallback: AttendanceOperation,
  ): AttendanceOperationError {
    const message = error?.message ?? '';
    if (
      message.includes('ATTENDANCE_AUTH_REQUIRED') ||
      message.includes('ATTENDANCE_ACTIVE_MEMBER_REQUIRED') ||
      message.includes('ATTENDANCE_ACCESS_DENIED') ||
      message.includes('permission denied')
    ) {
      return new AttendanceOperationError('PERMISSION');
    }
    if (message.includes('ATTENDANCE_EVENT_NOT_FOUND')) {
      return new AttendanceOperationError('NOT_FOUND');
    }
    if (message.includes('ATTENDANCE_EVENT_NOT_OPEN')) {
      return new AttendanceOperationError('NOT_OPEN');
    }
    if (message.includes('ATTENDANCE_RESPONSE_INVALID')) {
      return new AttendanceOperationError('VALIDATION');
    }
    return new AttendanceOperationError(fallback);
  }
}
