import { calculateLineupSlots, playerLabel } from './team-lineup.models';

describe('Team lineup layout', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 10])(
    'creates %i deterministic, bounded and unique slots',
    (count) => {
      const first = calculateLineupSlots(count);
      const second = calculateLineupSlots(count);

      expect(first).toEqual(second);
      expect(first).toHaveLength(count);
      expect(new Set(first.map((slot) => `${slot.x}:${slot.y}`)).size).toBe(count);
      for (const slot of first) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x).toBeLessThanOrEqual(100);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(100);
      }
    },
  );

  it('prefers a nickname and falls back to the display name', () => {
    const player = {
      avatarUrl: null,
      displayName: 'Matías Herrera',
      eventParticipantId: 'participant-1',
      isGuest: false,
      nickname: 'Mati',
    };

    expect(playerLabel(player)).toBe('Mati');
    expect(playerLabel({ ...player, nickname: null })).toBe('Matías Herrera');
  });

  it('rejects invalid counts', () => {
    expect(() => calculateLineupSlots(-1)).toThrow(RangeError);
    expect(() => calculateLineupSlots(2.5)).toThrow(RangeError);
  });
});
