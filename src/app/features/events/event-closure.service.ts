import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  ClosureOperation,
  ClosureOperationError,
  EventClosureSummary,
} from './event-closure.models';

@Injectable({ providedIn: 'root' })
export class EventClosureService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<EventClosureSummary> {
    const { data, error } = await this.client.rpc('get_event_closure_summary', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');
    return data as unknown as EventClosureSummary;
  }

  async close(eventId: string): Promise<EventClosureSummary> {
    const { data, error } = await this.client.rpc('close_event', { p_event_id: eventId });
    if (error || !data) throw this.mapError(error, 'UPDATE');
    return data as unknown as EventClosureSummary;
  }

  private mapError(
    error: { readonly message?: string } | null,
    fallback: 'LOAD' | 'UPDATE',
  ): ClosureOperationError {
    const message = error?.message ?? '';
    const mappings: readonly [string, ClosureOperation][] = [
      ['EVENT_CLOSURE_ATTENDANCE_NOT_RECORDED', 'ATTENDANCE_NOT_RECORDED'],
      ['EVENT_CLOSURE_MATCH_INVALID_NO_PLAYERS', 'MATCH_INVALID_NO_PLAYERS'],
      ['EVENT_CLOSURE_MATCH_SETTLEMENT_REQUIRED', 'MATCH_SETTLEMENT_REQUIRED'],
      ['EVENT_CLOSURE_DINNER_INVALID_NO_DINERS', 'DINNER_INVALID_NO_DINERS'],
      ['EVENT_CLOSURE_DINNER_SETTLEMENT_REQUIRED', 'DINNER_SETTLEMENT_REQUIRED'],
      ['EVENT_CLOSURE_WRONG_LIFECYCLE', 'WRONG_LIFECYCLE'],
      ['EVENT_CLOSURE_EVENT_NOT_FOUND', 'NOT_FOUND'],
      ['EVENT_CLOSURE_ADMIN_REQUIRED', 'PERMISSION'],
      ['EVENT_CLOSURE_ACCESS_DENIED', 'PERMISSION'],
      ['EVENT_CLOSURE_AUTH_REQUIRED', 'PERMISSION'],
      ['EVENT_CLOSED', 'ALREADY_CLOSED'],
      ['could not serialize', 'CONFLICT'],
      ['deadlock detected', 'CONFLICT'],
      ['permission denied', 'PERMISSION'],
    ];
    return new ClosureOperationError(
      mappings.find(([fragment]) => message.includes(fragment))?.[1] ?? fallback,
    );
  }
}
