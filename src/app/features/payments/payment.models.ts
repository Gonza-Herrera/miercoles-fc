import { EventStatus } from '../events/event.models';

export type PaymentCategory = 'COURT' | 'DINNER';
export type PaymentStatus = 'PAID' | 'PENDING';

export interface PaymentObligation {
  readonly amountMinor: number;
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly eventParticipantId: string;
  readonly id: string;
  readonly isCurrentUser: boolean | null;
  readonly isGuest: boolean;
  readonly paidAt: string | null;
  readonly status: PaymentStatus;
  readonly updatedAt: string | null;
}

export interface PaymentSummary {
  readonly collectedAmountMinor: number;
  readonly outstandingAmountMinor: number;
  readonly paidCount: number;
  readonly pendingCount: number;
  readonly totalAmountMinor: number;
  readonly totalCount: number;
}

export interface PaymentSection {
  readonly finalized: boolean;
  readonly obligations: readonly PaymentObligation[];
  readonly summary: PaymentSummary;
}

export interface EventPaymentsView {
  readonly canManage: boolean;
  readonly currencyCode: string;
  readonly dinner: PaymentSection;
  readonly eventId: string;
  readonly eventStatus: EventStatus;
  readonly match: PaymentSection;
}

export type PaymentOperation =
  'CLOSED' | 'CONFLICT' | 'LOAD' | 'NOT_FOUND' | 'PERMISSION' | 'UPDATE' | 'WRONG_LIFECYCLE';

export class PaymentOperationError extends Error {
  constructor(readonly operation: PaymentOperation) {
    super(operation);
  }
}
