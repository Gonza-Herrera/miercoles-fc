import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { ClosureOperationError } from './event-closure.models';
import { EventClosureService } from './event-closure.service';

describe('EventClosureService', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: { rpc } as unknown as SupabaseClient<Database> },
      ],
    });
  });

  it('loads the focused closure summary', async () => {
    rpc.mockResolvedValue({ data: summary(), error: null });

    const result = await TestBed.inject(EventClosureService).get('event-1');

    expect(result.financial.outstandingAmountMinor).toBe(3_838_383);
    expect(rpc).toHaveBeenCalledWith('get_event_closure_summary', { p_event_id: 'event-1' });
  });

  it('closes through the dedicated atomic RPC', async () => {
    rpc.mockResolvedValue({ data: summary('CLOSED'), error: null });

    const result = await TestBed.inject(EventClosureService).close('event-1');

    expect(result.event.status).toBe('CLOSED');
    expect(rpc).toHaveBeenCalledWith('close_event', { p_event_id: 'event-1' });
  });

  it('maps a missing Dinner settlement to an actionable domain error', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'EVENT_CLOSURE_DINNER_SETTLEMENT_REQUIRED' },
    });

    await expect(TestBed.inject(EventClosureService).close('event-1')).rejects.toEqual(
      new ClosureOperationError('DINNER_SETTLEMENT_REQUIRED'),
    );
  });
});

function summary(status: 'SETTLEMENT' | 'CLOSED' = 'SETTLEMENT') {
  return {
    blocker: null,
    canClose: status === 'SETTLEMENT',
    canManagePayments: true,
    dinner: {
      actualCount: 11,
      attendanceRecorded: true,
      collectedAmountMinor: 7_272_728,
      expenseTotalMinor: 10_000_000,
      occurred: true,
      outstandingAmountMinor: 2_727_272,
      paidCount: 8,
      settlementFinalized: true,
      totalCount: 11,
    },
    event: {
      closedAt: status === 'CLOSED' ? '2026-10-19T17:00:00Z' : null,
      closedBy: status === 'CLOSED' ? 'admin-1' : null,
      currencyCode: 'ARS',
      groupId: 'group-1',
      id: 'event-1',
      location: 'Cancha',
      startsAt: '2026-10-21T00:00:00Z',
      status,
      title: null,
    },
    financial: {
      collectedAmountMinor: 11_161_617,
      collectionComplete: false,
      outstandingAmountMinor: 3_838_383,
      totalAmountMinor: 15_000_000,
    },
    match: {
      actualCount: 9,
      attendanceRecorded: true,
      collectedAmountMinor: 3_888_889,
      courtAmountMinor: 5_000_000,
      occurred: true,
      outstandingAmountMinor: 1_111_111,
      paidCount: 7,
      settlementFinalized: true,
      totalCount: 9,
    },
  } as const;
}
