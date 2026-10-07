import {
  calculateMatchSettlement,
  MatchSettlementPlayerInput,
} from './match-settlement-calculator';

describe('calculateMatchSettlement', () => {
  it.each([
    [10, 500_000],
    [5, 1_000_000],
  ])('allocates ARS 50,000 equally across %i players', (count, expected) => {
    const result = calculateMatchSettlement({
      attendanceRecorded: true,
      courtAmountMinor: 5_000_000,
      players: players(count),
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.allocations).toHaveLength(count);
    expect(result.allocations.every((allocation) => allocation.amountMinor === expected)).toBe(
      true,
    );
    expect(sum(result.allocations)).toBe(5_000_000);
  });

  it('distributes 50,000 / 9 deterministically without creating four extra cents', () => {
    const input = [...players(9)].reverse();
    const first = calculateMatchSettlement({
      attendanceRecorded: true,
      courtAmountMinor: 5_000_000,
      players: input,
    });
    const second = calculateMatchSettlement({
      attendanceRecorded: true,
      courtAmountMinor: 5_000_000,
      players: [...input].reverse(),
    });
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
    if (!first.valid) return;
    expect(first.displayAverageMinor).toBe(555_556);
    expect(
      first.allocations.filter((allocation) => allocation.amountMinor === 555_556),
    ).toHaveLength(5);
    expect(
      first.allocations.filter((allocation) => allocation.amountMinor === 555_555),
    ).toHaveLength(4);
    expect(sum(first.allocations)).toBe(5_000_000);
  });

  it('allocates one smallest unit across multiple players without NaN or Infinity', () => {
    const result = calculateMatchSettlement({
      attendanceRecorded: true,
      courtAmountMinor: 1,
      players: players(3),
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.allocations.map((allocation) => allocation.amountMinor)).toEqual([1, 0, 0]);
    expect(sum(result.allocations)).toBe(1);
    expect(result.allocations.every((allocation) => Number.isFinite(allocation.amountMinor))).toBe(
      true,
    );
  });

  it('returns explicit unavailable reasons and rejects duplicates', () => {
    expect(
      calculateMatchSettlement({ attendanceRecorded: false, courtAmountMinor: 1, players: [] }),
    ).toEqual({ valid: false, reason: 'ATTENDANCE_NOT_RECORDED' });
    expect(
      calculateMatchSettlement({ attendanceRecorded: true, courtAmountMinor: 1, players: [] }),
    ).toEqual({ valid: false, reason: 'NO_ACTUAL_PLAYERS' });
    expect(
      calculateMatchSettlement({
        attendanceRecorded: true,
        courtAmountMinor: -1,
        players: players(1),
      }),
    ).toEqual({ valid: false, reason: 'INVALID_COURT_PRICE' });
    const duplicate = [players(1)[0], players(1)[0]];
    expect(
      calculateMatchSettlement({
        attendanceRecorded: true,
        courtAmountMinor: 1,
        players: duplicate,
      }),
    ).toEqual({ valid: false, reason: 'INVALID_PARTICIPANTS' });
  });

  it('preserves exact-allocation invariants for representative totals and 1..30 players', () => {
    for (const total of [0, 1, 99, 100, 123_456, 5_000_000, Number.MAX_SAFE_INTEGER]) {
      for (let count = 1; count <= 30; count += 1) {
        const result = calculateMatchSettlement({
          attendanceRecorded: true,
          courtAmountMinor: total,
          players: players(count),
        });
        expect(result.valid).toBe(true);
        if (!result.valid) continue;
        const amounts = result.allocations.map((allocation) => allocation.amountMinor);
        expect(result.allocations).toHaveLength(count);
        expect(
          new Set(result.allocations.map((allocation) => allocation.eventParticipantId)).size,
        ).toBe(count);
        expect(sum(result.allocations)).toBe(total);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does not mutate its input array', () => {
    const input = [...players(4)].reverse();
    const snapshot = structuredClone(input);
    calculateMatchSettlement({ attendanceRecorded: true, courtAmountMinor: 100, players: input });
    expect(input).toEqual(snapshot);
  });
});

function players(count: number): readonly MatchSettlementPlayerInput[] {
  return Array.from({ length: count }, (_, index) => ({
    createdAt: `2026-10-07T${String(index).padStart(2, '0')}:00:00Z`,
    eventParticipantId: `participant-${String(index).padStart(2, '0')}`,
  }));
}

function sum(allocations: readonly { readonly amountMinor: number }[]): number {
  return allocations.reduce((total, allocation) => total + allocation.amountMinor, 0);
}
