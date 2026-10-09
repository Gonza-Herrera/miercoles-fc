import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  DinnerSettlementOperation,
  DinnerSettlementOperationError,
  DinnerSettlementView,
} from './dinner-settlement.models';

@Injectable({ providedIn: 'root' })
export class DinnerSettlementService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<DinnerSettlementView> {
    const { data, error } = await this.client.rpc('get_dinner_settlement', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');
    return data as unknown as DinnerSettlementView;
  }

  async finalize(eventId: string): Promise<DinnerSettlementView> {
    const { data, error } = await this.client.rpc('finalize_dinner_settlement', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'FINALIZE');
    return data as unknown as DinnerSettlementView;
  }

  private mapError(
    error: { readonly message?: string } | null,
    fallback: 'FINALIZE' | 'LOAD',
  ): DinnerSettlementOperationError {
    const message = error?.message ?? '';
    const mappings: readonly [string, DinnerSettlementOperation][] = [
      ['DINNER_SETTLEMENT_ATTENDANCE_NOT_RECORDED', 'ATTENDANCE_NOT_RECORDED'],
      ['DINNER_SETTLEMENT_NO_ACTUAL_DINERS', 'NO_ACTUAL_DINERS'],
      ['DINNER_SETTLEMENT_NO_EXPENSES', 'NO_DINNER_EXPENSES'],
      ['DINNER_SETTLEMENT_EXPENSE_DATA_INVALID', 'INVALID_EXPENSE_DATA'],
      ['DINNER_SETTLEMENT_EVENT_CLOSED', 'CLOSED'],
      ['DINNER_SETTLEMENT_WRONG_LIFECYCLE', 'WRONG_LIFECYCLE'],
      ['DINNER_SETTLEMENT_EVENT_NOT_FOUND', 'NOT_FOUND'],
      ['DINNER_SETTLEMENT_SOURCE_LOCKED', 'ALREADY_FINALIZED'],
      ['DINNER_SETTLEMENT_ADMIN_REQUIRED', 'PERMISSION'],
      ['DINNER_SETTLEMENT_ACCESS_DENIED', 'PERMISSION'],
      ['DINNER_SETTLEMENT_AUTH_REQUIRED', 'PERMISSION'],
      ['DINNER_SETTLEMENT_ALLOCATION_INVALID', 'CONFLICT'],
      ['permission denied', 'PERMISSION'],
    ];
    return new DinnerSettlementOperationError(
      mappings.find(([fragment]) => message.includes(fragment))?.[1] ?? fallback,
    );
  }
}
