import { EventStatus } from '../events/event.models';

export type DinnerSettlementUnavailableReason =
  | 'ATTENDANCE_NOT_RECORDED'
  | 'INVALID_EXPENSE_DATA'
  | 'NO_ACTUAL_DINERS'
  | 'NO_DINNER_EXPENSES'
  | 'WRONG_LIFECYCLE';

export interface DinnerSettlementAllocation {
  readonly allocationOrder: number;
  readonly amountMinor: number;
  readonly displayName: string;
  readonly eventParticipantId: string;
  readonly isGuest: boolean;
}

export interface DinnerSettlementPreview {
  readonly allocations: readonly DinnerSettlementAllocation[];
  readonly displayAverageMinor: number;
  readonly totalAllocatedMinor: number;
}

export interface DinnerSettlement {
  readonly actualDinerCount: number;
  readonly allocations: readonly DinnerSettlementAllocation[];
  readonly currencyCode: string;
  readonly eventId: string;
  readonly expenseTotalMinor: number;
  readonly finalizedAt: string;
  readonly id: string;
  readonly totalAllocatedMinor: number;
}

export interface DinnerSettlementView {
  readonly actualDinerCount: number;
  readonly attendanceRecorded: boolean;
  readonly canFinalize: boolean;
  readonly currencyCode: string;
  readonly eventId: string;
  readonly eventStatus: EventStatus;
  readonly expenseTotalMinor: number;
  readonly preview: DinnerSettlementPreview | null;
  readonly settlement: DinnerSettlement | null;
  readonly unavailableReason: DinnerSettlementUnavailableReason | null;
}

export type DinnerSettlementOperation =
  | 'ALREADY_FINALIZED'
  | 'ATTENDANCE_NOT_RECORDED'
  | 'CLOSED'
  | 'CONFLICT'
  | 'FINALIZE'
  | 'INVALID_EXPENSE_DATA'
  | 'LOAD'
  | 'NOT_FOUND'
  | 'NO_ACTUAL_DINERS'
  | 'NO_DINNER_EXPENSES'
  | 'PERMISSION'
  | 'WRONG_LIFECYCLE';

export class DinnerSettlementOperationError extends Error {
  constructor(readonly operation: DinnerSettlementOperation) {
    super(operation);
    this.name = 'DinnerSettlementOperationError';
  }
}
