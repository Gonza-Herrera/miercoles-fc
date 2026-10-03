import { calculateTeamFormation } from './team-formation';

export interface GeneratedTeamPlayer {
  readonly id: string;
  readonly participantId: string | null;
  readonly groupMemberId: string | null;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly isGuest: boolean;
}

export interface GeneratedTeam {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly players: readonly GeneratedTeamPlayer[];
}

const TEAM_NAMES = ['Equipo A', 'Equipo B', 'Equipo C', 'Equipo D', 'Equipo E'];

export function generateRandomTeams(
  players: readonly GeneratedTeamPlayer[],
  rng: () => number = Math.random,
): readonly GeneratedTeam[] {
  const formation = calculateTeamFormation(players.length);
  if (!formation.valid) {
    return [];
  }

  // Fisher-Yates shuffle
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  const teams: GeneratedTeam[] = [];
  let currentIndex = 0;

  formation.teamSizes.forEach((size, index) => {
    const teamPlayers = shuffled.slice(currentIndex, currentIndex + size);
    currentIndex += size;

    const teamName = TEAM_NAMES[index] ?? `Equipo ${index + 1}`;
    teams.push({
      id: `team-${index + 1}`,
      name: teamName,
      position: index + 1,
      players: teamPlayers,
    });
  });

  return teams;
}

export function swapTeamPlayers(
  teams: readonly GeneratedTeam[],
  player1Id: string,
  player2Id: string,
): readonly GeneratedTeam[] {
  if (player1Id === player2Id) return teams;

  let player1: GeneratedTeamPlayer | null = null;
  let player2: GeneratedTeamPlayer | null = null;

  teams.forEach((team) => {
    team.players.forEach((p) => {
      if (p.id === player1Id) player1 = p;
      if (p.id === player2Id) player2 = p;
    });
  });

  if (!player1 || !player2) return teams;

  return teams.map((team) => ({
    ...team,
    players: team.players.map((p) => {
      if (p.id === player1Id) return player2!;
      if (p.id === player2Id) return player1!;
      return p;
    }),
  }));
}
