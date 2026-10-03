import { GeneratedTeam, GeneratedTeamPlayer } from './random-team-generator';

export function rosterMatchesActualPlayers(
  teams: readonly GeneratedTeam[],
  actualPlayers: readonly GeneratedTeamPlayer[],
): boolean {
  if (teams.length === 0) return true;

  const rosterIds = teams.flatMap((team) => team.players.map((player) => player.id));
  const actualIds = actualPlayers.map((player) => player.id);
  if (rosterIds.length !== actualIds.length) return false;

  const rosterSet = new Set(rosterIds);
  return rosterSet.size === rosterIds.length && actualIds.every((id) => rosterSet.has(id));
}
