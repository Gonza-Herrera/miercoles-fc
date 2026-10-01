import { AttendanceRecord } from '../attendance/attendance.models';
import { WeeklyEvent } from '../events/event.models';

export interface EventDashboard {
  readonly dinnerConfirmedCount: number;
  readonly estimatedCourtPerPlayerMinor: number | null;
  readonly event: WeeklyEvent;
  readonly footballConfirmedCount: number;
}

export function buildEventDashboard(
  event: WeeklyEvent,
  attendance: readonly AttendanceRecord[],
): EventDashboard {
  const footballConfirmedCount = attendance.filter(
    (attendee) => attendee.footballResponse === 'YES',
  ).length;
  const dinnerConfirmedCount = attendance.filter(
    (attendee) => attendee.dinnerResponse === 'YES',
  ).length;

  return {
    dinnerConfirmedCount,
    estimatedCourtPerPlayerMinor: calculateEstimatedCourtShare(
      event.courtPriceMinor,
      footballConfirmedCount,
    ),
    event,
    footballConfirmedCount,
  };
}

export function calculateEstimatedCourtShare(
  courtPriceMinor: number,
  confirmedPlayers: number,
): number | null {
  if (
    confirmedPlayers <= 0 ||
    !Number.isSafeInteger(confirmedPlayers) ||
    !Number.isSafeInteger(courtPriceMinor) ||
    courtPriceMinor < 0
  ) {
    return null;
  }

  const total = BigInt(courtPriceMinor);
  const players = BigInt(confirmedPlayers);
  const quotient = total / players;
  const remainder = total % players;
  const rounded = quotient + (remainder * 2n >= players ? 1n : 0n);

  return Number(rounded);
}
