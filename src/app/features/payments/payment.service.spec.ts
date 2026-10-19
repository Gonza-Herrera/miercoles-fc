import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  const rpc = vi.fn();
  const createSignedUrl = vi.fn();
  let service: PaymentService;

  beforeEach(() => {
    rpc.mockReset();
    createSignedUrl.mockReset();
    TestBed.configureTestingModule({
      providers: [
        PaymentService,
        {
          provide: SUPABASE_CLIENT,
          useValue: {
            rpc,
            storage: { from: () => ({ createSignedUrl }) },
          },
        },
      ],
    });
    service = TestBed.inject(PaymentService);
  });

  it('loads the authoritative event payment read model', async () => {
    const view = paymentView();
    rpc.mockResolvedValue({ data: view, error: null });
    await expect(service.get('event-1')).resolves.toStrictEqual(view);
    expect(rpc).toHaveBeenCalledWith('get_event_payments', { p_event_id: 'event-1' });
  });

  it('changes one obligation without sending event, amount, recorder or timestamp', async () => {
    const view = paymentView();
    rpc.mockResolvedValue({ data: view, error: null });
    await service.setStatus('COURT', 'item-1', 'PAID', null);
    expect(rpc).toHaveBeenCalledWith('set_obligation_payment_status', {
      p_category: 'COURT',
      p_expected_updated_at: undefined,
      p_obligation_id: 'item-1',
      p_target_status: 'PAID',
    });
  });

  it('passes the optimistic version when reverting a paid obligation', async () => {
    rpc.mockResolvedValue({ data: paymentView(), error: null });
    await service.setStatus('DINNER', 'item-2', 'PENDING', '2026-10-09T20:00:00Z');
    expect(rpc).toHaveBeenCalledWith(
      'set_obligation_payment_status',
      expect.objectContaining({ p_expected_updated_at: '2026-10-09T20:00:00Z' }),
    );
  });

  it('maps lifecycle, authorization and stale-write errors', async () => {
    for (const [message, operation] of [
      ['PAYMENTS_EVENT_CLOSED', 'CLOSED'],
      ['PAYMENTS_ADMIN_REQUIRED', 'PERMISSION'],
      ['PAYMENTS_CONFLICT', 'CONFLICT'],
    ] as const) {
      rpc.mockResolvedValueOnce({ data: null, error: { message } });
      await expect(service.get('event-1')).rejects.toMatchObject({
        operation,
      });
    }
  });

  it('signs private member avatar paths and leaves guests without an image', async () => {
    const view = paymentView('members/member-1/avatar.webp');
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/avatar.webp' },
      error: null,
    });
    rpc.mockResolvedValue({ data: view, error: null });

    const result = await service.get('event-1');

    expect(createSignedUrl).toHaveBeenCalledWith('members/member-1/avatar.webp', 300);
    expect(result.match.obligations[0].avatarUrl).toBe('https://signed.example/avatar.webp');
    expect(result.dinner.obligations[0].avatarUrl).toBeNull();
  });
});

function paymentView(avatarUrl: string | null = null) {
  const obligation = {
    amountMinor: 100,
    avatarUrl,
    displayName: 'Gonzalo',
    eventParticipantId: 'participant-1',
    id: 'item-1',
    isCurrentUser: true,
    isGuest: false,
    paidAt: null,
    status: 'PENDING' as const,
    updatedAt: null,
  };
  const summary = {
    collectedAmountMinor: 0,
    outstandingAmountMinor: 100,
    paidCount: 0,
    pendingCount: 1,
    totalAmountMinor: 100,
    totalCount: 1,
  };
  return {
    canManage: true,
    currencyCode: 'ARS',
    dinner: {
      finalized: true,
      obligations: [{ ...obligation, avatarUrl: null, id: 'dinner-item-1', isGuest: true }],
      summary,
    },
    eventId: 'event-1',
    eventStatus: 'SETTLEMENT' as const,
    match: { finalized: true, obligations: [obligation], summary },
  };
}
