import { EventStatus } from '../events/event.models';

export type MatchSettlementUnavailableReason =
  'ATTENDANCE_NOT_RECORDED' | 'INVALID_COURT_PRICE' | 'NO_ACTUAL_PLAYERS' | 'WRONG_LIFECYCLE';

export interface MatchSettlementAllocation {
  readonly allocationOrder: number;
  readonly amountMinor: number;
  readonly displayName: string;
  readonly eventParticipantId: string;
  readonly isGuest: boolean;
}

export interface MatchSettlementPreview {
  readonly allocations: readonly MatchSettlementAllocation[];
  readonly displayAverageMinor: number;
  readonly totalAllocatedMinor: number;
}

export interface MatchSettlement {
  readonly actualPlayerCount: number;
  readonly allocations: readonly MatchSettlementAllocation[];
  readonly courtAmountMinor: number;
  readonly currencyCode: string;
  readonly eventId: string;
  readonly finalizedAt: string;
  readonly id: string;
  readonly totalAllocatedMinor: number;
}

export interface MatchSettlementView {
  readonly actualPlayerCount: number;
  readonly attendanceRecorded: boolean;
  readonly canFinalize: boolean;
  readonly courtAmountMinor: number;
  readonly currencyCode: string;
  readonly eventId: string;
  readonly eventStatus: EventStatus;
  readonly preview: MatchSettlementPreview | null;
  readonly settlement: MatchSettlement | null;
  readonly unavailableReason: MatchSettlementUnavailableReason | null;
}

export type MatchSettlementOperation =
  | 'ALREADY_FINALIZED'
  | 'ATTENDANCE_NOT_RECORDED'
  | 'CLOSED'
  | 'CONFLICT'
  | 'FINALIZE'
  | 'INVALID_COURT_PRICE'
  | 'LOAD'
  | 'NOT_FOUND'
  | 'NO_ACTUAL_PLAYERS'
  | 'PERMISSION'
  | 'WRONG_LIFECYCLE';

export class MatchSettlementOperationError extends Error {
  constructor(readonly operation: MatchSettlementOperation) {
    super(operation);
    this.name = 'MatchSettlementOperationError';
  }
}
