import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  EventPaymentsView,
  PaymentCategory,
  PaymentObligation,
  PaymentOperation,
  PaymentOperationError,
  PaymentStatus,
} from './payment.models';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly client = inject(SUPABASE_CLIENT);

  async get(eventId: string): Promise<EventPaymentsView> {
    const { data, error } = await this.client.rpc('get_event_payments', {
      p_event_id: eventId,
    });
    if (error || !data) throw this.mapError(error, 'LOAD');
    return this.mapView(data as unknown as EventPaymentsView);
  }

  async setStatus(
    category: PaymentCategory,
    obligationId: string,
    targetStatus: PaymentStatus,
    expectedUpdatedAt: string | null,
  ): Promise<EventPaymentsView> {
    const { data, error } = await this.client.rpc('set_obligation_payment_status', {
      p_category: category,
      p_expected_updated_at: expectedUpdatedAt ?? undefined,
      p_obligation_id: obligationId,
      p_target_status: targetStatus,
    });
    if (error || !data) throw this.mapError(error, 'UPDATE');
    return this.mapView(data as unknown as EventPaymentsView);
  }

  private async mapView(view: EventPaymentsView): Promise<EventPaymentsView> {
    const [match, dinner] = await Promise.all([
      this.signObligations(view.match.obligations),
      this.signObligations(view.dinner.obligations),
    ]);
    return {
      ...view,
      dinner: { ...view.dinner, obligations: dinner },
      match: { ...view.match, obligations: match },
    };
  }

  private signObligations(
    obligations: readonly PaymentObligation[],
  ): Promise<readonly PaymentObligation[]> {
    return Promise.all(
      obligations.map(async (obligation) => ({
        ...obligation,
        avatarUrl: await this.signedAvatar(obligation.avatarUrl),
      })),
    );
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
    fallback: 'LOAD' | 'UPDATE',
  ): PaymentOperationError {
    const message = error?.message ?? '';
    const mappings: readonly [string, PaymentOperation][] = [
      ['PAYMENTS_EVENT_CLOSED', 'CLOSED'],
      ['PAYMENTS_WRONG_LIFECYCLE', 'WRONG_LIFECYCLE'],
      ['PAYMENTS_CONFLICT', 'CONFLICT'],
      ['PAYMENTS_OBLIGATION_NOT_FOUND', 'NOT_FOUND'],
      ['PAYMENTS_EVENT_NOT_FOUND', 'NOT_FOUND'],
      ['PAYMENTS_ADMIN_REQUIRED', 'PERMISSION'],
      ['PAYMENTS_ACCESS_DENIED', 'PERMISSION'],
      ['PAYMENTS_AUTH_REQUIRED', 'PERMISSION'],
      ['permission denied', 'PERMISSION'],
    ];
    return new PaymentOperationError(
      mappings.find(([fragment]) => message.includes(fragment))?.[1] ?? fallback,
    );
  }
}
