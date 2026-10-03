import { EventStatus } from '../../events/event.models';

export type TeamFormationMode = 'RANDOM' | 'MANAGERS';

export interface TeamManagerIdentity {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly groupMemberId: string;
  readonly nickname: string | null;
}

export interface TeamManagerAssignment {
  readonly manager: TeamManagerIdentity | null;
  readonly teamId: string;
  readonly teamName: string;
  readonly teamPosition: number;
}

export interface TeamManagerConfiguration {
  readonly eventStatus: EventStatus;
  readonly mode: TeamFormationMode;
  readonly teams: readonly TeamManagerAssignment[];
}

export interface TeamManagerCounts {
  readonly assigned: number;
  readonly complete: boolean;
  readonly missing: number;
  readonly required: number;
}

export function calculateTeamManagerCounts(
  mode: TeamFormationMode,
  teams: readonly Pick<TeamManagerAssignment, 'manager'>[],
): TeamManagerCounts {
  const required = mode === 'MANAGERS' ? teams.length : 0;
  const assigned = mode === 'MANAGERS' ? teams.filter((team) => team.manager !== null).length : 0;
  return {
    assigned,
    complete: mode === 'RANDOM' || (required > 0 && assigned === required),
    missing: required - assigned,
    required,
  };
}
