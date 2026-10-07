import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  MatchSettlementOperation,
  MatchSettlementOperationError,
  MatchSettlementView,
} from './match-settlement.models';

@Injectable({ providedIn: 'root' })
export class MatchSettlementService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<MatchSettlementView> {
    const { data, error } = await this.client.rpc('get_match_settlement', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');
    return data as unknown as MatchSettlementView;
  }

  async finalize(eventId: string): Promise<MatchSettlementView> {
    const { data, error } = await this.client.rpc('finalize_match_settlement', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'FINALIZE');
    return data as unknown as MatchSettlementView;
  }

  private mapError(
    error: { readonly message?: string } | null,
    fallback: 'FINALIZE' | 'LOAD',
  ): MatchSettlementOperationError {
    const message = error?.message ?? '';
    const mappings: readonly [string, MatchSettlementOperation][] = [
      ['MATCH_SETTLEMENT_ATTENDANCE_NOT_RECORDED', 'ATTENDANCE_NOT_RECORDED'],
      ['MATCH_SETTLEMENT_NO_ACTUAL_PLAYERS', 'NO_ACTUAL_PLAYERS'],
      ['MATCH_SETTLEMENT_COURT_PRICE_INVALID', 'INVALID_COURT_PRICE'],
      ['MATCH_SETTLEMENT_EVENT_CLOSED', 'CLOSED'],
      ['MATCH_SETTLEMENT_WRONG_LIFECYCLE', 'WRONG_LIFECYCLE'],
      ['MATCH_SETTLEMENT_EVENT_NOT_FOUND', 'NOT_FOUND'],
      ['MATCH_SETTLEMENT_SOURCE_LOCKED', 'ALREADY_FINALIZED'],
      ['MATCH_SETTLEMENT_ADMIN_REQUIRED', 'PERMISSION'],
      ['MATCH_SETTLEMENT_ACCESS_DENIED', 'PERMISSION'],
      ['MATCH_SETTLEMENT_AUTH_REQUIRED', 'PERMISSION'],
      ['MATCH_SETTLEMENT_ALLOCATION_INVALID', 'CONFLICT'],
      ['permission denied', 'PERMISSION'],
    ];
    return new MatchSettlementOperationError(
      mappings.find(([fragment]) => message.includes(fragment))?.[1] ?? fallback,
    );
  }
}
