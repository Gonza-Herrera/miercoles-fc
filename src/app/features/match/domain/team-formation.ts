export interface TeamFormationPlan {
  readonly valid: true;
  readonly playerCount: number;
  readonly teamCount: number;
  readonly teamSizes: readonly number[];
}

export interface InsufficientTeamFormation {
  readonly valid: false;
  readonly playerCount: 0 | 1;
  readonly reason: 'INSUFFICIENT_PLAYERS';
}

export type TeamFormationResult = TeamFormationPlan | InsufficientTeamFormation;

export class TeamFormationInputError extends RangeError {
  readonly code = 'INVALID_PLAYER_COUNT';

  constructor(readonly playerCount: number) {
    super('playerCount must be a finite, non-negative integer');
    this.name = 'TeamFormationInputError';
  }
}

export function calculateTeamFormation(playerCount: number): TeamFormationResult {
  assertValidPlayerCount(playerCount);

  if (playerCount === 0 || playerCount === 1) {
    return {
      playerCount,
      reason: 'INSUFFICIENT_PLAYERS',
      valid: false,
    };
  }

  const teamSizes = calculateTeamSizes(playerCount);
  return {
    playerCount,
    teamCount: teamSizes.length,
    teamSizes,
    valid: true,
  };
}

function assertValidPlayerCount(playerCount: number): asserts playerCount is number {
  if (!Number.isFinite(playerCount) || !Number.isInteger(playerCount) || playerCount < 0) {
    throw new TeamFormationInputError(playerCount);
  }
}

function calculateTeamSizes(playerCount: number): readonly number[] {
  if (playerCount < 10) {
    return [Math.floor(playerCount / 2), Math.ceil(playerCount / 2)];
  }
  if (playerCount === 10) return [5, 5];
  if (playerCount === 11) return [5, 6];
  if (playerCount === 12) return [6, 6];
  return [5, 5, playerCount - 10];
}
