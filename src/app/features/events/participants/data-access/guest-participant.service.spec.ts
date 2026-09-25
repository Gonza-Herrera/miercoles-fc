import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../../../core/supabase/supabase-client';
import { GuestOperationError } from '../models/participant.models';
import { GuestParticipantService } from './guest-participant.service';

describe('GuestParticipantService', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPABASE_CLIENT,
          useValue: { rpc } as unknown as SupabaseClient<Database>,
        },
      ],
    });
  });

  it('adds a trimmed guest through the explicit domain RPC', async () => {
    rpc.mockResolvedValue({ data: [row()], error: null });

    const guest = await TestBed.inject(GuestParticipantService).add('event-id', {
      dines: true,
      displayName: 'Martín',
      plays: true,
    });

    expect(guest.displayName).toBe('Martín');
    expect(rpc).toHaveBeenCalledWith('add_guest_participant', {
      p_dines: true,
      p_display_name: 'Martín',
      p_event_id: 'event-id',
      p_plays: true,
    });
  });

  it('maps authorization failures without exposing database messages', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'GUEST_ADMIN_REQUIRED' } });

    await expect(
      TestBed.inject(GuestParticipantService).add('event-id', {
        dines: false,
        displayName: 'Martín',
        plays: true,
      }),
    ).rejects.toEqual(new GuestOperationError('PERMISSION'));
  });

  it('cancels a guest without deleting its participant identity', async () => {
    rpc.mockResolvedValue({
      data: [row({ cancelled_at: '2026-09-25T12:00:00Z' })],
      error: null,
    });

    const guest = await TestBed.inject(GuestParticipantService).cancel('participant-id');

    expect(guest.id).toBe('participant-id');
    expect(guest.cancelledAt).toBe('2026-09-25T12:00:00Z');
    expect(rpc).toHaveBeenCalledWith('cancel_guest_participant', {
      p_event_participant_id: 'participant-id',
    });
  });
});

function row(overrides: Record<string, unknown> = {}) {
  return {
    actual_dinner: 'UNSET',
    actual_football: 'UNSET',
    cancelled_at: null,
    created_at: '2026-09-25T10:00:00Z',
    dinner_response: 'YES',
    event_id: 'event-id',
    football_response: 'YES',
    group_member_id: null,
    guest_display_name: 'Martín',
    id: 'participant-id',
    updated_at: '2026-09-25T10:00:00Z',
    ...overrides,
  };
}
