import { calculateTeamManagerCounts } from './team-manager.models';

describe('team manager configuration', () => {
  it('does not require managers in RANDOM mode', () => {
    expect(calculateTeamManagerCounts('RANDOM', [])).toEqual({
      assigned: 0,
      complete: true,
      missing: 0,
      required: 0,
    });
  });

  it('marks a complete two-team manager configuration', () => {
    const manager = {
      avatarUrl: null,
      displayName: 'Gazpar',
      groupMemberId: 'member-1',
      nickname: null,
    };
    expect(calculateTeamManagerCounts('MANAGERS', [{ manager }, { manager }])).toEqual({
      assigned: 2,
      complete: true,
      missing: 0,
      required: 2,
    });
  });

  it('reports the missing manager in an incomplete three-team configuration', () => {
    const manager = {
      avatarUrl: null,
      displayName: 'Gazpar',
      groupMemberId: 'member-1',
      nickname: null,
    };
    expect(
      calculateTeamManagerCounts('MANAGERS', [{ manager }, { manager }, { manager: null }]),
    ).toEqual({
      assigned: 2,
      complete: false,
      missing: 1,
      required: 3,
    });
  });
});
