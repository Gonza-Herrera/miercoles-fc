import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  DinnerPlanDraft,
  DinnerPlanningOperation,
  DinnerPlanningOperationError,
  DinnerPlanningView,
} from './dinner-planning.models';

interface RawDinnerPlanningView extends Omit<DinnerPlanningView, 'plan'> {
  readonly plan:
    | null
    | (Omit<NonNullable<DinnerPlanningView['plan']>, 'purchaseOwner'> & {
        readonly purchaseOwner: null | Omit<
          NonNullable<NonNullable<DinnerPlanningView['plan']>['purchaseOwner']>,
          'avatarUrl'
        >;
      });
}

@Injectable({ providedIn: 'root' })
export class DinnerPlanningService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<DinnerPlanningView> {
    const { data, error } = await this.client.rpc('get_dinner_planning', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');
    return this.mapView(data as unknown as RawDinnerPlanningView);
  }

  async save(
    eventId: string,
    draft: DinnerPlanDraft,
    expectedUpdatedAt: string | null,
  ): Promise<DinnerPlanningView> {
    const { data, error } = await this.client.rpc('save_dinner_plan', {
      p_event_id: eventId,
      p_expected_updated_at: expectedUpdatedAt ?? undefined,
      p_menu: draft.menu,
      p_planned_purchases: draft.plannedPurchases.map((item, index) => ({
        id: item.id.startsWith('draft-') ? null : item.id,
        name: item.name,
        sortOrder: index,
      })),
      // PostgreSQL accepts NULL here to explicitly remove the optional owner.
      // The generated PostgREST signature does not encode nullable arguments.
      p_purchase_owner_group_member_id: draft.purchaseOwnerGroupMemberId as string,
    });
    if (error || !data) throw this.mapError(error, 'SAVE');
    return this.mapView(data as unknown as RawDinnerPlanningView);
  }

  private async mapView(raw: RawDinnerPlanningView): Promise<DinnerPlanningView> {
    const owner = raw.plan?.purchaseOwner;
    return {
      ...raw,
      plan: raw.plan
        ? {
            ...raw.plan,
            purchaseOwner: owner
              ? { ...owner, avatarUrl: await this.signedAvatar(owner.avatarPath) }
              : null,
          }
        : null,
    };
  }

  private async signedAvatar(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await this.client.storage
      .from('group-assets')
      .createSignedUrl(path, 300);
    return error ? null : data.signedUrl;
  }

  private mapError(
    error: { readonly message?: string } | null,
    fallback: 'LOAD' | 'SAVE',
  ): DinnerPlanningOperationError {
    const message = error?.message ?? '';
    const mappings: readonly [string, DinnerPlanningOperation][] = [
      ['DINNER_PLAN_CONFLICT', 'CONFLICT'],
      ['DINNER_PLAN_EVENT_NOT_FOUND', 'NOT_FOUND'],
      ['DINNER_PLAN_OWNER_INVALID', 'OWNER_INVALID'],
      ['DINNER_PLAN_READ_ONLY', 'READ_ONLY'],
      ['DINNER_PLAN_MENU_INVALID', 'VALIDATION'],
      ['DINNER_PLAN_PURCHASE', 'VALIDATION'],
      ['DINNER_PLAN_ADMIN_REQUIRED', 'PERMISSION'],
      ['DINNER_PLAN_ACCESS_DENIED', 'PERMISSION'],
      ['DINNER_PLAN_AUTH_REQUIRED', 'PERMISSION'],
      ['permission denied', 'PERMISSION'],
    ];
    return new DinnerPlanningOperationError(
      mappings.find(([fragment]) => message.includes(fragment))?.[1] ?? fallback,
    );
  }
}
