import { EventStatus } from '../../events/event.models';
import { TeamFormationMode } from '../managers/team-manager.models';

export type PlayerDraftStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type DraftRealtimeStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export interface DraftPlayer {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly isGuest: boolean;
  readonly participantId: string;
}

export interface DraftManager {
  readonly displayName: string;
  readonly groupMemberId: string;
  readonly nickname: string | null;
}

export interface DraftTeam {
  readonly capacity: number;
  readonly manager: DraftManager;
  readonly players: readonly DraftPlayer[];
  readonly teamId: string;
  readonly teamName: string;
  readonly teamPosition: number;
}

export interface PlayerDraftState {
  readonly availablePlayers: readonly DraftPlayer[];
  readonly canCurrentUserPick: boolean;
  readonly canStart: boolean;
  readonly currentManagerName: string | null;
  readonly currentTeamId: string | null;
  readonly currentUserTeamId: string | null;
  readonly eventId: string;
  readonly eventStatus: EventStatus;
  readonly formationMode: TeamFormationMode;
  readonly pickNumber: number;
  readonly status: PlayerDraftStatus;
  readonly teams: readonly DraftTeam[];
  readonly version: number;
}

export function teamRemainingCapacity(team: DraftTeam): number {
  return Math.max(0, team.capacity - team.players.length);
}

export function currentDraftTeam(state: PlayerDraftState): DraftTeam | null {
  return state.teams.find((team) => team.teamId === state.currentTeamId) ?? null;
}
