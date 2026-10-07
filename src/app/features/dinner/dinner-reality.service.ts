import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  DinnerAttendanceInput,
  DinnerExpense,
  DinnerExpenseInput,
  DinnerRealityOperation,
  DinnerRealityOperationError,
  DinnerRealityParticipant,
  DinnerRealityView,
} from './dinner-reality.models';

interface RawDinnerRealityView extends Omit<DinnerRealityView, 'participants'> {
  readonly participants: readonly Omit<DinnerRealityParticipant, 'avatarUrl'>[];
}

@Injectable({ providedIn: 'root' })
export class DinnerRealityService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<DinnerRealityView> {
    const { data, error } = await this.client.rpc('get_dinner_reality', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');
    return this.mapView(data as unknown as RawDinnerRealityView);
  }

  async saveAttendance(
    eventId: string,
    attendances: readonly DinnerAttendanceInput[],
    expectedRecordedAt: string | null,
  ): Promise<DinnerRealityView> {
    const { data, error } = await this.client.rpc('record_dinner_attendance', {
      p_attendances: attendances.map((item) => ({
        attended: item.attended,
        groupMemberId: item.groupMemberId,
        participantId: item.participantId,
      })),
      p_event_id: eventId,
      p_expected_recorded_at: expectedRecordedAt ?? undefined,
    });
    if (error || !data) throw this.mapError(error, 'SAVE_ATTENDANCE');
    return this.mapView(data as unknown as RawDinnerRealityView);
  }

  async createExpense(eventId: string, input: DinnerExpenseInput): Promise<DinnerRealityView> {
    const { data, error } = await this.client.rpc('create_dinner_expense', {
      p_amount_minor: input.amountMinor,
      p_description: input.description,
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'SAVE_EXPENSE');
    return this.mapView(data as unknown as RawDinnerRealityView);
  }

  async updateExpense(
    eventId: string,
    expense: DinnerExpense,
    input: DinnerExpenseInput,
  ): Promise<DinnerRealityView> {
    const { data, error } = await this.client.rpc('update_dinner_expense', {
      p_amount_minor: input.amountMinor,
      p_description: input.description,
      p_event_id: eventId,
      p_expense_id: expense.id,
      p_expected_updated_at: expense.updatedAt,
    });
    if (error || !data) throw this.mapError(error, 'SAVE_EXPENSE');
    return this.mapView(data as unknown as RawDinnerRealityView);
  }

  async deleteExpense(eventId: string, expense: DinnerExpense): Promise<DinnerRealityView> {
    const { data, error } = await this.client.rpc('delete_dinner_expense', {
      p_event_id: eventId,
      p_expense_id: expense.id,
      p_expected_updated_at: expense.updatedAt,
    });
    if (error || !data) throw this.mapError(error, 'DELETE');
    return this.mapView(data as unknown as RawDinnerRealityView);
  }

  private async mapView(raw: RawDinnerRealityView): Promise<DinnerRealityView> {
    const participants = await Promise.all(
      raw.participants.map(async (participant) => ({
        ...participant,
        avatarUrl: await this.signedAvatar(participant.avatarPath),
      })),
    );
    return { ...raw, participants };
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
    fallback: 'DELETE' | 'LOAD' | 'SAVE_ATTENDANCE' | 'SAVE_EXPENSE',
  ): DinnerRealityOperationError {
    const message = error?.message ?? '';
    const mappings: readonly [string, DinnerRealityOperation][] = [
      ['DINNER_REALITY_ATTENDANCE_CONFLICT', 'ATTENDANCE_CONFLICT'],
      ['DINNER_REALITY_ATTENDANCE_', 'ATTENDANCE_INVALID'],
      ['DINNER_REALITY_PARTICIPANT_INVALID', 'ATTENDANCE_INVALID'],
      ['DINNER_EXPENSE_CONFLICT', 'CONFLICT'],
      ['DINNER_EXPENSE_NOT_FOUND', 'NOT_FOUND'],
      ['DINNER_REALITY_EVENT_NOT_FOUND', 'NOT_FOUND'],
      ['DINNER_EXPENSE_DESCRIPTION_INVALID', 'VALIDATION'],
      ['DINNER_EXPENSE_AMOUNT_INVALID', 'VALIDATION'],
      ['DINNER_EXPENSE_VERSION_REQUIRED', 'VALIDATION'],
      ['DINNER_REALITY_EVENT_CLOSED', 'READ_ONLY'],
      ['DINNER_REALITY_NOT_STARTED', 'READ_ONLY'],
      ['DINNER_REALITY_ADMIN_REQUIRED', 'PERMISSION'],
      ['DINNER_REALITY_ACCESS_DENIED', 'PERMISSION'],
      ['DINNER_REALITY_AUTH_REQUIRED', 'PERMISSION'],
      ['permission denied', 'PERMISSION'],
    ];
    return new DinnerRealityOperationError(
      mappings.find(([fragment]) => message.includes(fragment))?.[1] ?? fallback,
    );
  }
}
