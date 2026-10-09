import { allocateAmountExactly, ExactAllocationParticipant } from './exact-allocation';

export type DinnerSettlementDinerInput = ExactAllocationParticipant;

export type DinnerSettlementCalculationResult =
  | {
      readonly valid: true;
      readonly actualDinerCount: number;
      readonly allocations: readonly {
        readonly amountMinor: number;
        readonly eventParticipantId: string;
      }[];
      readonly displayAverageMinor: number;
      readonly expenseTotalMinor: number;
    }
  | {
      readonly valid: false;
      readonly reason:
        | 'ATTENDANCE_NOT_RECORDED'
        | 'INVALID_EXPENSE_DATA'
        | 'INVALID_PARTICIPANTS'
        | 'NO_ACTUAL_DINERS'
        | 'NO_DINNER_EXPENSES';
    };

export function calculateDinnerSettlement(input: {
  readonly attendanceRecorded: boolean;
  readonly diners: readonly DinnerSettlementDinerInput[];
  readonly expenseTotalMinor: number;
}): DinnerSettlementCalculationResult {
  if (!input.attendanceRecorded) return { valid: false, reason: 'ATTENDANCE_NOT_RECORDED' };
  if (!Number.isSafeInteger(input.expenseTotalMinor) || input.expenseTotalMinor < 0) {
    return { valid: false, reason: 'INVALID_EXPENSE_DATA' };
  }
  if (input.diners.length === 0) return { valid: false, reason: 'NO_ACTUAL_DINERS' };
  if (input.expenseTotalMinor === 0) return { valid: false, reason: 'NO_DINNER_EXPENSES' };

  const allocation = allocateAmountExactly(input.expenseTotalMinor, input.diners, {
    requirePositiveAllocations: true,
  });
  if (!allocation.valid) {
    return {
      valid: false,
      reason:
        allocation.reason === 'INVALID_TOTAL'
          ? 'INVALID_EXPENSE_DATA'
          : 'INVALID_PARTICIPANTS',
    };
  }
  return {
    valid: true,
    actualDinerCount: input.diners.length,
    allocations: allocation.allocations,
    displayAverageMinor: allocation.displayAverageMinor,
    expenseTotalMinor: input.expenseTotalMinor,
  };
}
