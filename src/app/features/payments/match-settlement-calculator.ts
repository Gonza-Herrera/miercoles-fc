import {
  allocateAmountExactly,
  ExactAllocationParticipant,
} from './exact-allocation';

export type MatchSettlementPlayerInput = ExactAllocationParticipant;

export type MatchSettlementCalculationResult =
  | {
      readonly valid: true;
      readonly actualPlayerCount: number;
      readonly allocations: readonly {
        readonly amountMinor: number;
        readonly eventParticipantId: string;
      }[];
      readonly courtAmountMinor: number;
      readonly displayAverageMinor: number;
    }
  | {
      readonly valid: false;
      readonly reason:
        | 'ATTENDANCE_NOT_RECORDED'
        | 'INVALID_COURT_PRICE'
        | 'INVALID_PARTICIPANTS'
        | 'NO_ACTUAL_PLAYERS';
    };

export function calculateMatchSettlement(input: {
  readonly attendanceRecorded: boolean;
  readonly courtAmountMinor: number;
  readonly players: readonly MatchSettlementPlayerInput[];
}): MatchSettlementCalculationResult {
  if (!input.attendanceRecorded) return { valid: false, reason: 'ATTENDANCE_NOT_RECORDED' };
  if (!Number.isSafeInteger(input.courtAmountMinor) || input.courtAmountMinor < 0) {
    return { valid: false, reason: 'INVALID_COURT_PRICE' };
  }
  if (input.players.length === 0) return { valid: false, reason: 'NO_ACTUAL_PLAYERS' };

  const allocation = allocateAmountExactly(input.courtAmountMinor, input.players);
  if (!allocation.valid) {
    return { valid: false, reason: 'INVALID_PARTICIPANTS' };
  }
  return {
    valid: true,
    actualPlayerCount: input.players.length,
    allocations: allocation.allocations,
    courtAmountMinor: input.courtAmountMinor,
    displayAverageMinor: allocation.displayAverageMinor,
  };
}
