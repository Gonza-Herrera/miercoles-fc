import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { DinnerRealityOperationError } from './dinner-reality.models';
import { DinnerRealityService } from './dinner-reality.service';

describe('DinnerRealityService', () => {
  const rpc = vi.fn();
  const createSignedUrl = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    createSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: 'signed' }, error: null });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPABASE_CLIENT,
          useValue: {
            rpc,
            storage: { from: () => ({ createSignedUrl }) },
          } as unknown as SupabaseClient<Database>,
        },
      ],
    });
  });

  it('loads the focused reality model and signs member avatars', async () => {
    rpc.mockResolvedValue({ data: rawView(), error: null });

    const result = await TestBed.inject(DinnerRealityService).get('event-1');

    expect(rpc).toHaveBeenCalledWith('get_dinner_reality', { p_event_id: 'event-1' });
    expect(result.participants[0].avatarUrl).toBe('signed');
    expect(result.totalExpenseMinor).toBe(10_000_000);
  });

  it('sends the complete attendance review with optimistic metadata', async () => {
    rpc.mockResolvedValue({ data: rawView(), error: null });
    const service = TestBed.inject(DinnerRealityService);

    await service.saveAttendance(
      'event-1',
      [{ attended: true, groupMemberId: 'member-1', participantId: 'participant-1' }],
      '2026-10-07T23:00:00Z',
    );

    expect(rpc).toHaveBeenCalledWith('record_dinner_attendance', {
      p_attendances: [
        { attended: true, groupMemberId: 'member-1', participantId: 'participant-1' },
      ],
      p_event_id: 'event-1',
      p_expected_recorded_at: '2026-10-07T23:00:00Z',
    });
  });

  it('uses focused expense RPCs and preserves exact minor units', async () => {
    rpc.mockResolvedValue({ data: rawView(), error: null });
    const service = TestBed.inject(DinnerRealityService);

    await service.createExpense('event-1', { amountMinor: 5_000_000, description: 'Carne' });
    await service.updateExpense('event-1', rawView().expenses[0], {
      amountMinor: 5_500_000,
      description: 'Carne premium',
    });
    await service.deleteExpense('event-1', rawView().expenses[0]);

    expect(rpc).toHaveBeenNthCalledWith(1, 'create_dinner_expense', {
      p_amount_minor: 5_000_000,
      p_description: 'Carne',
      p_event_id: 'event-1',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'update_dinner_expense', {
      p_amount_minor: 5_500_000,
      p_description: 'Carne premium',
      p_event_id: 'event-1',
      p_expense_id: 'expense-1',
      p_expected_updated_at: '2026-10-07T23:00:00Z',
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'delete_dinner_expense', {
      p_event_id: 'event-1',
      p_expense_id: 'expense-1',
      p_expected_updated_at: '2026-10-07T23:00:00Z',
    });
  });

  it('maps stale writes without exposing backend errors', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'DINNER_EXPENSE_CONFLICT internal detail' },
    });

    await expect(
      TestBed.inject(DinnerRealityService).updateExpense('event-1', rawView().expenses[0], {
        amountMinor: 1,
        description: 'X',
      }),
    ).rejects.toEqual(new DinnerRealityOperationError('CONFLICT'));
  });
});

function rawView() {
  return {
    actualDinerCount: 1,
    attendanceRecorded: true,
    attendanceRecordedAt: '2026-10-07T23:00:00Z',
    canEdit: true,
    currencyCode: 'ARS',
    eventId: 'event-1',
    eventStatus: 'IN_PROGRESS' as const,
    expenses: [
      {
        amountMinor: 10_000_000,
        createdAt: '2026-10-07T23:00:00Z',
        description: 'Cena',
        eventId: 'event-1',
        id: 'expense-1',
        updatedAt: '2026-10-07T23:00:00Z',
      },
    ],
    participants: [
      {
        actualDinnerAttendance: 'YES' as const,
        avatarPath: 'group/member.webp',
        dinnerConfirmation: 'NO' as const,
        displayName: 'Carla',
        groupMemberId: 'member-1',
        isGuest: false,
        participantId: 'participant-1',
      },
    ],
    totalExpenseMinor: 10_000_000,
  };
}
