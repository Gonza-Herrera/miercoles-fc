import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { MatchSettlementOperationError } from './match-settlement.models';
import { MatchSettlementService } from './match-settlement.service';

describe('MatchSettlementService', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: { rpc } as unknown as SupabaseClient<Database> },
      ],
    });
  });

  it('loads the server-authoritative preview', async () => {
    rpc.mockResolvedValue({ data: view(), error: null });
    const result = await TestBed.inject(MatchSettlementService).get('event-1');
    expect(rpc).toHaveBeenCalledWith('get_match_settlement', { p_event_id: 'event-1' });
    expect(result.actualPlayerCount).toBe(9);
  });

  it('finalizes without submitting price, player count or participants', async () => {
    rpc.mockResolvedValue({ data: view(), error: null });
    await TestBed.inject(MatchSettlementService).finalize('event-1');
    expect(rpc).toHaveBeenCalledWith('finalize_match_settlement', { p_event_id: 'event-1' });
  });

  it('maps domain failures without exposing PostgreSQL messages', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'MATCH_SETTLEMENT_NO_ACTUAL_PLAYERS detail' },
    });
    await expect(TestBed.inject(MatchSettlementService).finalize('event-1')).rejects.toEqual(
      new MatchSettlementOperationError('NO_ACTUAL_PLAYERS'),
    );
  });
});

function view() {
  return {
    actualPlayerCount: 9,
    attendanceRecorded: true,
    canFinalize: true,
    courtAmountMinor: 5_000_000,
    currencyCode: 'ARS',
    eventId: 'event-1',
    eventStatus: 'SETTLEMENT',
    preview: { allocations: [], displayAverageMinor: 555_556, totalAllocatedMinor: 5_000_000 },
    settlement: null,
    unavailableReason: null,
  };
}
