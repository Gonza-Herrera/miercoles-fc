import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { DinnerSettlementOperationError } from './dinner-settlement.models';
import { DinnerSettlementService } from './dinner-settlement.service';

describe('DinnerSettlementService', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: { rpc } as unknown as SupabaseClient<Database> }],
    });
  });

  it('loads the server-authoritative Dinner preview', async () => {
    rpc.mockResolvedValue({ data: view(), error: null });
    const result = await TestBed.inject(DinnerSettlementService).get('event-1');
    expect(rpc).toHaveBeenCalledWith('get_dinner_settlement', { p_event_id: 'event-1' });
    expect(result.actualDinerCount).toBe(11);
  });

  it('finalizes without submitting expenses, diner count or participants', async () => {
    rpc.mockResolvedValue({ data: view(), error: null });
    await TestBed.inject(DinnerSettlementService).finalize('event-1');
    expect(rpc).toHaveBeenCalledWith('finalize_dinner_settlement', { p_event_id: 'event-1' });
  });

  it('maps Dinner domain failures without exposing PostgreSQL messages', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'DINNER_SETTLEMENT_NO_EXPENSES detail' } });
    await expect(TestBed.inject(DinnerSettlementService).finalize('event-1')).rejects.toEqual(
      new DinnerSettlementOperationError('NO_DINNER_EXPENSES'),
    );
  });
});

function view() {
  return {
    actualDinerCount: 11,
    attendanceRecorded: true,
    canFinalize: true,
    currencyCode: 'ARS',
    eventId: 'event-1',
    eventStatus: 'SETTLEMENT',
    expenseTotalMinor: 10_000_000,
    preview: { allocations: [], displayAverageMinor: 909_091, totalAllocatedMinor: 10_000_000 },
    settlement: null,
    unavailableReason: null,
  };
}
