import {
  TeamFormationInputError,
  TeamFormationPlan,
  calculateTeamFormation,
} from './team-formation';

describe('Team Formation Engine', () => {
  it.each([0, 1])('returns an insufficient result for %i player(s)', (playerCount) => {
    expect(calculateTeamFormation(playerCount)).toEqual({
      playerCount,
      reason: 'INSUFFICIENT_PLAYERS',
      valid: false,
    });
  });

  it.each([
    [2, [1, 1]],
    [3, [1, 2]],
    [4, [2, 2]],
    [5, [2, 3]],
    [6, [3, 3]],
    [7, [3, 4]],
    [8, [4, 4]],
    [9, [4, 5]],
  ])('returns two balanced teams for %i players', (playerCount, teamSizes) => {
    expect(validPlan(playerCount).teamSizes).toEqual(teamSizes);
  });

  it.each([
    [10, [5, 5]],
    [11, [5, 6]],
    [12, [6, 6]],
  ])('applies the explicit two-team rule for %i players', (playerCount, teamSizes) => {
    expect(validPlan(playerCount).teamSizes).toEqual(teamSizes);
  });

  it.each([
    [13, [5, 5, 3]],
    [14, [5, 5, 4]],
    [15, [5, 5, 5]],
    [16, [5, 5, 6]],
    [17, [5, 5, 7]],
    [18, [5, 5, 8]],
    [20, [5, 5, 10]],
  ])('keeps the first two teams at five for %i players', (playerCount, teamSizes) => {
    expect(validPlan(playerCount).teamSizes).toEqual(teamSizes);
  });

  it.each([-1, -10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2.5, 10.1])(
    'rejects invalid technical input %s',
    (playerCount) => {
      expect(() => calculateTeamFormation(playerCount)).toThrow(TeamFormationInputError);
    },
  );

  it.each(Array.from({ length: 49 }, (_, index) => index + 2))(
    'preserves every formation invariant for %i players',
    (playerCount) => {
      const plan = validPlan(playerCount);

      expect(plan.teamSizes.reduce((total, size) => total + size, 0)).toBe(playerCount);
      expect(plan.teamCount).toBe(plan.teamSizes.length);
      expect(plan.teamSizes.every((size) => size > 0)).toBe(true);

      if (playerCount <= 12) {
        expect(plan.teamCount).toBe(2);
      } else {
        expect(plan.teamCount).toBe(3);
        expect(plan.teamSizes).toEqual([5, 5, playerCount - 10]);
      }

      if (playerCount < 10) {
        expect(Math.abs(plan.teamSizes[0] - plan.teamSizes[1])).toBeLessThanOrEqual(1);
      }
    },
  );

  it('is deterministic for repeated calculations', () => {
    expect(calculateTeamFormation(14)).toEqual(calculateTeamFormation(14));
  });
});

function validPlan(playerCount: number): TeamFormationPlan {
  const result = calculateTeamFormation(playerCount);
  if (!result.valid) throw new Error('Expected a valid team formation');
  return result;
}
