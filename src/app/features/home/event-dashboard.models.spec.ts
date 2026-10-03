import { AttendanceRecord } from '../attendance/attendance.models';
import { WeeklyEvent } from '../events/event.models';
import { buildEventDashboard, calculateEstimatedCourtShare } from './event-dashboard.models';

describe('event dashboard models', () => {
  it('calculates exact common estimates in integer minor units', () => {
    expect(calculateEstimatedCourtShare(5_000_000, 10)).toBe(500_000);
    expect(calculateEstimatedCourtShare(5_000_000, 8)).toBe(625_000);
    expect(calculateEstimatedCourtShare(5_000_000, 1)).toBe(5_000_000);
  });

  it('returns no estimate for zero confirmations', () => {
    expect(calculateEstimatedCourtShare(5_000_000, 0)).toBeNull();
  });

  it('rounds a non-even division to the nearest minor unit using integer arithmetic', () => {
    expect(calculateEstimatedCourtShare(5_000_000, 12)).toBe(416_667);
  });

  it('counts football and dinner YES independently, including a guest', () => {
    const attendance = [
      attendee('Lucas', 'YES', 'NO'),
      attendee('Carla', 'NO', 'YES'),
      attendee('Gonzalo', 'YES', 'YES'),
      attendee('Martín', 'YES', 'YES', true),
      attendee('Diego', 'UNKNOWN', 'UNKNOWN'),
    ];

    const dashboard = buildEventDashboard(event(), attendance);

    expect(dashboard.footballConfirmedCount).toBe(3);
    expect(dashboard.dinnerConfirmedCount).toBe(3);
  });
});

function attendee(
  displayName: string,
  footballResponse: AttendanceRecord['footballResponse'],
  dinnerResponse: AttendanceRecord['dinnerResponse'],
  isGuest = false,
): AttendanceRecord {
  return {
    actualDinner: 'UNSET',
    actualFootball: 'UNSET',
    avatarPath: null,
    avatarUrl: null,
    dinnerResponse,
    displayName,
    eventId: 'event-id',
    footballResponse,
    groupMemberId: isGuest ? null : `${displayName}-id`,
    isCurrentUser: displayName === 'Gonzalo',
    isGuest,
    membershipActive: true,
    participantId: `${displayName}-participant-id`,
  };
}

function event(): WeeklyEvent {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: '2026-09-20T12:00:00Z',
    createdBy: 'profile-id',
    currencyCode: 'ARS',
    groupId: 'group-id',
    id: 'event-id',
    location: 'La Canchita',
    startsAt: '2026-09-30T21:00:00-03:00',
    status: 'OPEN',
    title: null,
    updatedAt: '2026-09-20T12:00:00Z',
  };
}
