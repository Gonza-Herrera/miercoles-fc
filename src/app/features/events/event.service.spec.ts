import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { EventOperationError } from './event.models';
import { EventService } from './event.service';

describe('EventService', () => {
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

  it('creates a draft through the event RPC with local time and exact minor units', async () => {
    rpc.mockResolvedValue({ data: row(), error: null });

    const created = await TestBed.inject(EventService).create('group-id', {
      courtPrice: '50.000',
      date: '2026-10-07',
      location: 'Cancha Central',
      time: '21:30',
    });

    expect(created.status).toBe('DRAFT');
    expect(rpc).toHaveBeenCalledWith('create_event', {
      p_court_price_minor: 5_000_000,
      p_group_id: 'group-id',
      p_location: 'Cancha Central',
      p_starts_at: expect.any(String),
    });
  });

  it('maps an invalid lifecycle transition to a domain conflict', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'EVENT_TRANSITION_INVALID' } });

    await expect(TestBed.inject(EventService).transition('event-id', 'CLOSED')).rejects.toEqual(
      new EventOperationError('TRANSITION'),
    );
  });
});

function row() {
  return {
    court_price_minor: 5_000_000,
    created_at: '2026-10-01T10:00:00Z',
    created_by: 'profile-id',
    currency_code: 'ARS',
    group_id: 'group-id',
    id: 'event-id',
    location: 'Cancha Central',
    starts_at: '2026-10-08T00:30:00Z',
    status: 'DRAFT',
    title: null,
    updated_at: '2026-10-01T10:00:00Z',
  } as const;
}
