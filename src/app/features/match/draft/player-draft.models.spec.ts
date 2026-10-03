import { currentDraftTeam, teamRemainingCapacity } from './player-draft.models';

describe('Player Draft domain presentation helpers', () => {
  const team = {
    capacity: 5,
    manager: { displayName: 'Gazpar', groupMemberId: 'member-1', nickname: null },
    players: [
      { avatarUrl: null, displayName: 'Gazpar', isGuest: false, participantId: 'player-1' },
    ],
    teamId: 'team-1',
    teamName: 'Equipo A',
    teamPosition: 1,
  } as const;

  it('counts an auto-assigned playing manager toward capacity', () => {
    expect(teamRemainingCapacity(team)).toBe(4);
  });

  it('finds the persisted current team', () => {
    expect(
      currentDraftTeam({
        availablePlayers: [],
        canCurrentUserPick: true,
        canStart: false,
        currentManagerName: 'Gazpar',
        currentTeamId: 'team-1',
        currentUserTeamId: 'team-1',
        eventId: 'event-1',
        eventStatus: 'IN_PROGRESS',
        formationMode: 'MANAGERS',
        pickNumber: 0,
        status: 'IN_PROGRESS',
        teams: [team],
        version: 1,
      }),
    ).toBe(team);
  });
});
