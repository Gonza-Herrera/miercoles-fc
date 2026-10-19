import { EventStatus } from './event.models';

export type ClosureBlocker =
  | 'ATTENDANCE_NOT_RECORDED'
  | 'DINNER_INVALID_NO_DINERS'
  | 'DINNER_SETTLEMENT_REQUIRED'
  | 'MATCH_INVALID_NO_PLAYERS'
  | 'MATCH_SETTLEMENT_REQUIRED'
  | 'WRONG_LIFECYCLE';

export interface ClosureActivitySummary {
  readonly actualCount: number;
  readonly attendanceRecorded: boolean;
  readonly collectedAmountMinor: number;
  readonly occurred: boolean;
  readonly outstandingAmountMinor: number;
  readonly paidCount: number;
  readonly settlementFinalized: boolean;
  readonly totalCount: number;
}

export interface EventClosureSummary {
  readonly blocker: ClosureBlocker | null;
  readonly canClose: boolean;
  readonly canManagePayments: boolean;
  readonly dinner: ClosureActivitySummary & { readonly expenseTotalMinor: number };
  readonly event: {
    readonly closedAt: string | null;
    readonly closedBy: string | null;
    readonly currencyCode: string;
    readonly groupId: string;
    readonly id: string;
    readonly location: string;
    readonly startsAt: string;
    readonly status: EventStatus;
    readonly title: string | null;
  };
  readonly financial: {
    readonly collectedAmountMinor: number;
    readonly collectionComplete: boolean;
    readonly outstandingAmountMinor: number;
    readonly totalAmountMinor: number;
  };
  readonly match: ClosureActivitySummary & { readonly courtAmountMinor: number };
}

export type ClosureOperation =
  ClosureBlocker | 'ALREADY_CLOSED' | 'CONFLICT' | 'LOAD' | 'NOT_FOUND' | 'PERMISSION' | 'UPDATE';

export class ClosureOperationError extends Error {
  constructor(readonly operation: ClosureOperation) {
    super(operation);
    this.name = 'ClosureOperationError';
  }
}
