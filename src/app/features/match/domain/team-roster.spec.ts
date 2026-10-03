import { GeneratedTeam, GeneratedTeamPlayer } from './random-team-generator';
import { rosterMatchesActualPlayers } from './team-roster';

describe('rosterMatchesActualPlayers', () => {
  it('accepts a persisted roster with exactly the current actual players', () => {
    expect(rosterMatchesActualPlayers(teams(['p-1'], ['p-2']), players('p-1', 'p-2'))).toBe(true);
  });

  it('rejects a roster that still contains removed players', () => {
    expect(
      rosterMatchesActualPlayers(teams(['p-1', 'p-3'], ['p-2', 'p-4']), players('p-1', 'p-2')),
    ).toBe(false);
  });

  it('rejects a roster missing a newly present player', () => {
    expect(rosterMatchesActualPlayers(teams(['p-1'], ['p-2']), players('p-1', 'p-2', 'p-3'))).toBe(
      false,
    );
  });

  it('treats the absence of a persisted roster as valid', () => {
    expect(rosterMatchesActualPlayers([], players('p-1', 'p-2'))).toBe(true);
  });
});

function players(...ids: string[]): GeneratedTeamPlayer[] {
  return ids.map((id) => ({
    avatarUrl: null,
    displayName: id,
    groupMemberId: null,
    id,
    isGuest: true,
    participantId: id,
  }));
}

function teams(first: string[], second: string[]): GeneratedTeam[] {
  return [
    { id: 'team-1', name: 'Equipo A', players: players(...first), position: 1 },
    { id: 'team-2', name: 'Equipo B', players: players(...second), position: 2 },
  ];
}
