import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { DinnerPlanningOperationError } from './dinner-planning.models';
import { DinnerPlanningService } from './dinner-planning.service';

describe('DinnerPlanningService', () => {
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

  it('loads the focused planning read model and signs the owner avatar', async () => {
    rpc.mockResolvedValue({ data: rawView(), error: null });

    const result = await TestBed.inject(DinnerPlanningService).get('event-1');

    expect(rpc).toHaveBeenCalledWith('get_dinner_planning', { p_event_id: 'event-1' });
    expect(result.confirmedDinerCount).toBe(3);
    expect(result.plan?.purchaseOwner?.avatarUrl).toBe('signed');
    expect(result.plan?.plannedPurchases[0].name).toBe('Carne');
  });

  it('saves the whole plan through one atomic RPC and omits draft IDs', async () => {
    rpc.mockResolvedValue({ data: rawView(), error: null });

    await TestBed.inject(DinnerPlanningService).save(
      'event-1',
      {
        menu: 'Asado',
        plannedPurchases: [
          { id: 'purchase-1', name: 'Carne', sortOrder: 0 },
          { id: 'draft-new', name: 'Pan', sortOrder: 1 },
        ],
        purchaseOwnerGroupMemberId: 'member-1',
      },
      '2026-10-03T18:00:00Z',
    );

    expect(rpc).toHaveBeenCalledWith('save_dinner_plan', {
      p_event_id: 'event-1',
      p_expected_updated_at: '2026-10-03T18:00:00Z',
      p_menu: 'Asado',
      p_planned_purchases: [
        { id: 'purchase-1', name: 'Carne', sortOrder: 0 },
        { id: null, name: 'Pan', sortOrder: 1 },
      ],
      p_purchase_owner_group_member_id: 'member-1',
    });
  });

  it('maps an optimistic concurrency failure to product-safe state', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'DINNER_PLAN_CONFLICT' } });

    await expect(
      TestBed.inject(DinnerPlanningService).save(
        'event-1',
        { menu: '', plannedPurchases: [], purchaseOwnerGroupMemberId: null },
        null,
      ),
    ).rejects.toEqual(new DinnerPlanningOperationError('CONFLICT'));
  });
});

function rawView() {
  return {
    canEdit: true,
    confirmedDinerCount: 3,
    eventId: 'event-1',
    eventStatus: 'OPEN',
    plan: {
      eventId: 'event-1',
      id: 'plan-1',
      menu: 'Asado',
      plannedPurchases: [{ id: 'purchase-1', name: 'Carne', sortOrder: 0 }],
      purchaseOwner: {
        active: true,
        avatarPath: 'avatar-path',
        displayName: 'Gonzalo',
        groupMemberId: 'member-1',
        nickname: null,
      },
      updatedAt: '2026-10-03T18:00:00Z',
    },
  };
}
