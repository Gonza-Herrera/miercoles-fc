export interface MatchSettlementPlayerInput {
  readonly createdAt: string;
  readonly eventParticipantId: string;
}

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

  const ordered = [...input.players].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.eventParticipantId.localeCompare(right.eventParticipantId),
  );
  if (
    ordered.some((player) => !player.eventParticipantId || !player.createdAt) ||
    new Set(ordered.map((player) => player.eventParticipantId)).size !== ordered.length
  ) {
    return { valid: false, reason: 'INVALID_PARTICIPANTS' };
  }

  const baseAmount = Math.floor(input.courtAmountMinor / ordered.length);
  const remainder = input.courtAmountMinor % ordered.length;
  return {
    valid: true,
    actualPlayerCount: ordered.length,
    allocations: ordered.map((player, index) => ({
      amountMinor: baseAmount + (index < remainder ? 1 : 0),
      eventParticipantId: player.eventParticipantId,
    })),
    courtAmountMinor: input.courtAmountMinor,
    displayAverageMinor: baseAmount + (remainder * 2 >= ordered.length ? 1 : 0),
  };
}
