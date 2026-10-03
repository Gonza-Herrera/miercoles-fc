import { EventStatus } from '../../events/event.models';
import { TeamFormationMode } from '../managers/team-manager.models';

export interface LineupSlot {
  readonly x: number;
  readonly y: number;
}

export interface TeamLineupPlayer {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly eventParticipantId: string;
  readonly isGuest: boolean;
  readonly nickname: string | null;
}

export interface TeamLineupManager {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly groupMemberId: string;
  readonly nickname: string | null;
}

export interface TeamLineup {
  readonly manager: TeamLineupManager | null;
  readonly name: string;
  readonly order: number;
  readonly players: readonly TeamLineupPlayer[];
  readonly teamId: string;
}

export interface TeamLineupState {
  readonly canEdit: boolean;
  readonly eventId: string;
  readonly eventStatus: EventStatus;
  readonly formationMode: TeamFormationMode;
  readonly isComplete: boolean;
  readonly teams: readonly TeamLineup[];
}

export function playerLabel(player: TeamLineupPlayer): string {
  return player.nickname?.trim() || player.displayName;
}

export function calculateLineupSlots(playerCount: number): readonly LineupSlot[] {
  if (!Number.isInteger(playerCount) || playerCount < 0) {
    throw new RangeError('playerCount must be a non-negative integer');
  }

  const common: Readonly<Record<number, readonly LineupSlot[]>> = {
    0: [],
    1: [{ x: 50, y: 50 }],
    2: [
      { x: 50, y: 28 },
      { x: 50, y: 72 },
    ],
    3: [
      { x: 50, y: 20 },
      { x: 27, y: 68 },
      { x: 73, y: 68 },
    ],
    4: [
      { x: 28, y: 27 },
      { x: 72, y: 27 },
      { x: 28, y: 72 },
      { x: 72, y: 72 },
    ],
    5: [
      { x: 50, y: 16 },
      { x: 27, y: 48 },
      { x: 73, y: 48 },
      { x: 27, y: 80 },
      { x: 73, y: 80 },
    ],
    6: [
      { x: 50, y: 12 },
      { x: 27, y: 36 },
      { x: 73, y: 36 },
      { x: 27, y: 64 },
      { x: 73, y: 64 },
      { x: 50, y: 88 },
    ],
  };
  if (playerCount <= 6) return common[playerCount];

  const columns = playerCount >= 10 ? 4 : 3;
  const rows = Math.ceil(playerCount / columns);
  const slots: LineupSlot[] = [];
  for (let index = 0; index < playerCount; index += 1) {
    const row = Math.floor(index / columns);
    const countInRow = Math.min(columns, playerCount - row * columns);
    const column = index - row * columns;
    slots.push({
      x: ((column + 1) * 100) / (countInRow + 1),
      y: 10 + (row * 80) / Math.max(1, rows - 1),
    });
  }
  return slots;
}
