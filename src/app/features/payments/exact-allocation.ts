export interface ExactAllocationParticipant {
  readonly createdAt: string;
  readonly eventParticipantId: string;
}

export type ExactAllocationResult =
  | {
      readonly valid: true;
      readonly allocations: readonly {
        readonly amountMinor: number;
        readonly eventParticipantId: string;
      }[];
      readonly displayAverageMinor: number;
    }
  | { readonly valid: false; readonly reason: 'INVALID_PARTICIPANTS' | 'INVALID_TOTAL' };

export function allocateAmountExactly(
  totalMinor: number,
  participants: readonly ExactAllocationParticipant[],
  options: { readonly requirePositiveAllocations?: boolean } = {},
): ExactAllocationResult {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    return { valid: false, reason: 'INVALID_TOTAL' };
  }
  const ordered = [...participants].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.eventParticipantId.localeCompare(right.eventParticipantId),
  );
  if (
    ordered.length === 0 ||
    ordered.some((participant) => !participant.eventParticipantId || !participant.createdAt) ||
    new Set(ordered.map((participant) => participant.eventParticipantId)).size !== ordered.length ||
    (options.requirePositiveAllocations && totalMinor < ordered.length)
  ) {
    return { valid: false, reason: 'INVALID_PARTICIPANTS' };
  }

  const baseAmount = Math.floor(totalMinor / ordered.length);
  const remainder = totalMinor % ordered.length;
  return {
    valid: true,
    allocations: ordered.map((participant, index) => ({
      amountMinor: baseAmount + (index < remainder ? 1 : 0),
      eventParticipantId: participant.eventParticipantId,
    })),
    displayAverageMinor: baseAmount + (remainder * 2 >= ordered.length ? 1 : 0),
  };
}
