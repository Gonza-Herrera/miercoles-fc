import {
  calculateDinnerSettlement,
  DinnerSettlementDinerInput,
} from './dinner-settlement-calculator';

describe('calculateDinnerSettlement', () => {
  it('allocates ARS 100,000 equally across 10 actual diners', () => {
    const result = calculateDinnerSettlement({
      attendanceRecorded: true,
      diners: diners(10),
      expenseTotalMinor: 10_000_000,
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.allocations).toHaveLength(10);
    expect(result.allocations.every((allocation) => allocation.amountMinor === 1_000_000)).toBe(true);
    expect(sum(result.allocations)).toBe(10_000_000);
  });

  it('distributes 100,000 / 11 deterministically without adding one cent', () => {
    const first = calculateDinnerSettlement({
      attendanceRecorded: true,
      diners: [...diners(11)].reverse(),
      expenseTotalMinor: 10_000_000,
    });
    const second = calculateDinnerSettlement({
      attendanceRecorded: true,
      diners: diners(11),
      expenseTotalMinor: 10_000_000,
    });
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
    if (!first.valid) return;
    expect(first.displayAverageMinor).toBe(909_091);
    expect(first.allocations.filter((item) => item.amountMinor === 909_091)).toHaveLength(10);
    expect(first.allocations.filter((item) => item.amountMinor === 909_090)).toHaveLength(1);
    expect(sum(first.allocations)).toBe(10_000_000);
  });

  it('handles 50,000 / 3 with an exact deterministic remainder', () => {
    const result = calculateDinnerSettlement({
      attendanceRecorded: true,
      diners: diners(3),
      expenseTotalMinor: 5_000_000,
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.allocations.map((item) => item.amountMinor)).toEqual([1_666_667, 1_666_667, 1_666_666]);
    expect(sum(result.allocations)).toBe(5_000_000);
  });

  it('rejects unrecorded, zero diners, zero expenses, too-small totals and duplicates', () => {
    expect(calculateDinnerSettlement({ attendanceRecorded: false, diners: [], expenseTotalMinor: 0 })).toEqual({ valid: false, reason: 'ATTENDANCE_NOT_RECORDED' });
    expect(calculateDinnerSettlement({ attendanceRecorded: true, diners: [], expenseTotalMinor: 1 })).toEqual({ valid: false, reason: 'NO_ACTUAL_DINERS' });
    expect(calculateDinnerSettlement({ attendanceRecorded: true, diners: diners(1), expenseTotalMinor: 0 })).toEqual({ valid: false, reason: 'NO_DINNER_EXPENSES' });
    expect(calculateDinnerSettlement({ attendanceRecorded: true, diners: diners(3), expenseTotalMinor: 1 })).toEqual({ valid: false, reason: 'INVALID_PARTICIPANTS' });
    const duplicate = [diners(1)[0], diners(1)[0]];
    expect(calculateDinnerSettlement({ attendanceRecorded: true, diners: duplicate, expenseTotalMinor: 100 })).toEqual({ valid: false, reason: 'INVALID_PARTICIPANTS' });
  });

  it('preserves exact invariants for representative positive totals and 1..30 diners', () => {
    for (const total of [1, 99, 100, 123_456, 10_000_000, Number.MAX_SAFE_INTEGER]) {
      for (let count = 1; count <= Math.min(30, total); count += 1) {
        const result = calculateDinnerSettlement({ attendanceRecorded: true, diners: diners(count), expenseTotalMinor: total });
        expect(result.valid).toBe(true);
        if (!result.valid) continue;
        const amounts = result.allocations.map((item) => item.amountMinor);
        expect(sum(result.allocations)).toBe(total);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
        expect(new Set(result.allocations.map((item) => item.eventParticipantId)).size).toBe(count);
      }
    }
  });

  it('does not mutate diner inputs', () => {
    const input = [...diners(4)].reverse();
    const snapshot = structuredClone(input);
    calculateDinnerSettlement({ attendanceRecorded: true, diners: input, expenseTotalMinor: 100 });
    expect(input).toEqual(snapshot);
  });
});

function diners(count: number): readonly DinnerSettlementDinerInput[] {
  return Array.from({ length: count }, (_, index) => ({
    createdAt: `2026-10-07T${String(index).padStart(2, '0')}:00:00Z`,
    eventParticipantId: `diner-${String(index).padStart(2, '0')}`,
  }));
}

function sum(allocations: readonly { readonly amountMinor: number }[]): number {
  return allocations.reduce((total, allocation) => total + allocation.amountMinor, 0);
}
