import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { AttendanceService } from '../attendance/attendance.service';
import { DinnerPlanningService } from '../dinner/dinner-planning.service';
import { DinnerRealityService } from '../dinner/dinner-reality.service';
import { EventClosureService } from '../events/event-closure.service';
import { EventService } from '../events/event.service';
import { TeamLineupService } from '../match/lineup/team-lineup.service';
import { DinnerSettlementService } from '../payments/dinner-settlement.service';
import { MatchSettlementService } from '../payments/match-settlement.service';
import { PaymentService } from '../payments/payment.service';
import { HistoryOperationError } from './history.models';
import { HistoryService } from './history.service';

describe('HistoryService', () => {
  const rpc = vi.fn();
  const eventGet = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    eventGet.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: { rpc } as unknown as SupabaseClient<Database> },
        { provide: EventService, useValue: { get: eventGet } },
        { provide: AttendanceService, useValue: { list: vi.fn() } },
        { provide: EventClosureService, useValue: { get: vi.fn() } },
        { provide: DinnerPlanningService, useValue: { get: vi.fn() } },
        { provide: DinnerRealityService, useValue: { get: vi.fn() } },
        { provide: DinnerSettlementService, useValue: { get: vi.fn() } },
        { provide: TeamLineupService, useValue: { get: vi.fn() } },
        { provide: MatchSettlementService, useValue: { get: vi.fn() } },
        { provide: PaymentService, useValue: { get: vi.fn() } },
      ],
    });
  });

  it('requests a stable keyset page from the focused RPC', async () => {
    rpc.mockResolvedValue({
      data: {
        hasMore: true,
        items: [],
        nextCursor: { eventId: 'event-10', startsAt: '2026-09-01T00:00:00Z' },
      },
      error: null,
    });
    const cursor = { eventId: 'event-0', startsAt: '2026-10-01T00:00:00Z' };

    const page = await TestBed.inject(HistoryService).list('group-1', cursor);

    expect(page.hasMore).toBe(true);
    expect(rpc).toHaveBeenCalledWith('get_group_event_history', {
      p_before_event_id: cursor.eventId,
      p_before_starts_at: cursor.startsAt,
      p_group_id: 'group-1',
      p_limit: 10,
    });
  });

  it('rejects a deep link whose Event belongs to another Group before loading detail sections', async () => {
    eventGet.mockResolvedValue({ groupId: 'group-b', status: 'CLOSED' });

    await expect(TestBed.inject(HistoryService).getDetail('group-a', 'event-1')).rejects.toEqual(
      new HistoryOperationError('NOT_FOUND'),
    );
  });
});
