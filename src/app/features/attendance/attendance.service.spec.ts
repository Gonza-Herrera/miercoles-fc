import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { AttendanceOperationError } from './attendance.models';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  const createSignedUrl = vi.fn();
  const fromStorage = vi.fn(() => ({ createSignedUrl }));
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    createSignedUrl.mockReset().mockResolvedValue({ data: null, error: null });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPABASE_CLIENT,
          useValue: {
            rpc,
            storage: { from: fromStorage },
          } as unknown as SupabaseClient<Database>,
        },
      ],
    });
  });

  it('loads unanswered members and guests from the secure read model', async () => {
    rpc.mockResolvedValue({
      data: [readRow(), readRow({ display_name: 'Martín', is_guest: true })],
      error: null,
    });

    const attendance = await TestBed.inject(AttendanceService).list('event-id');

    expect(rpc).toHaveBeenCalledWith('get_event_attendance', { p_event_id: 'event-id' });
    expect(attendance[0].footballResponse).toBe('UNKNOWN');
    expect(attendance[1].isGuest).toBe(true);
  });

  it('uses independent narrow RPCs and keeps the other response returned by the database', async () => {
    rpc.mockResolvedValue({ data: participantRow(), error: null });
    const service = TestBed.inject(AttendanceService);

    const football = await service.setFootball('event-id', 'YES');
    const dinner = await service.setDinner('event-id', 'NO');

    expect(rpc).toHaveBeenNthCalledWith(1, 'set_my_football_confirmation', {
      p_event_id: 'event-id',
      p_response: 'YES',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'set_my_dinner_confirmation', {
      p_event_id: 'event-id',
      p_response: 'NO',
    });
    expect(football.dinnerResponse).toBe('NO');
    expect(dinner.footballResponse).toBe('YES');
  });

  it('does not send UNKNOWN as an explicit answer', async () => {
    await expect(
      TestBed.inject(AttendanceService).setFootball('event-id', 'UNKNOWN'),
    ).rejects.toEqual(new AttendanceOperationError('VALIDATION'));
    expect(rpc).not.toHaveBeenCalled();
  });
});

function readRow(overrides: Record<string, unknown> = {}) {
  return {
    avatar_path: null,
    dinner_response: 'UNKNOWN',
    display_name: 'Lucas',
    event_id: 'event-id',
    football_response: 'UNKNOWN',
    group_member_id: 'member-id',
    is_current_user: true,
    is_guest: false,
    membership_active: true,
    participant_id: null,
    ...overrides,
  };
}

function participantRow() {
  return {
    actual_dinner: 'UNSET',
    actual_football: 'UNSET',
    cancelled_at: null,
    created_at: '2026-10-01T10:00:00Z',
    created_by: null,
    dinner_response: 'NO',
    event_id: 'event-id',
    football_response: 'YES',
    group_member_id: 'member-id',
    guest_display_name: null,
    id: 'participant-id',
    updated_at: '2026-10-01T10:00:00Z',
  };
}
