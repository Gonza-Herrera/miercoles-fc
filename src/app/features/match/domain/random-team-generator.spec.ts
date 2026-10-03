import { describe, expect, it } from 'vitest';

import {
  GeneratedTeamPlayer,
  generateRandomTeams,
  swapTeamPlayers,
} from './random-team-generator';

describe('RandomTeamGenerator', () => {
  it('creates 2 teams of 5 for 10 players', () => {
    const players = makePlayers(10);
    const teams = generateRandomTeams(players, () => 0.5);

    expect(teams.length).toBe(2);
    expect(teams[0].name).toBe('Equipo A');
    expect(teams[0].players.length).toBe(5);
    expect(teams[1].name).toBe('Equipo B');
    expect(teams[1].players.length).toBe(5);
  });

  it('creates 3 teams of [5, 5, 3] for 13 players', () => {
    const players = makePlayers(13);
    const teams = generateRandomTeams(players, () => 0.5);

    expect(teams.length).toBe(3);
    expect(teams[0].players.length).toBe(5);
    expect(teams[1].players.length).toBe(5);
    expect(teams[2].players.length).toBe(3);
  });

  it('returns empty array when players count is insufficient (<2)', () => {
    expect(generateRandomTeams(makePlayers(1))).toEqual([]);
    expect(generateRandomTeams(makePlayers(0))).toEqual([]);
  });

  it('swaps two players between teams correctly', () => {
    const players = makePlayers(10);
    const teams = generateRandomTeams(players, () => 0.1);

    const playerA = teams[0].players[0];
    const playerB = teams[1].players[0];

    const swapped = swapTeamPlayers(teams, playerA.id, playerB.id);

    expect(swapped[0].players[0].id).toBe(playerB.id);
    expect(swapped[1].players[0].id).toBe(playerA.id);
  });
});

function makePlayers(count: number): GeneratedTeamPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    avatarUrl: null,
    displayName: `Jugador ${i + 1}`,
    groupMemberId: `member-${i + 1}`,
    id: `player-${i + 1}`,
    isGuest: false,
    participantId: `part-${i + 1}`,
  }));
}
