import { AttendanceRecord } from '../attendance/attendance.models';
import { DinnerPlanningView } from '../dinner/dinner-planning.models';
import { DinnerRealityView } from '../dinner/dinner-reality.models';
import { EventClosureSummary } from '../events/event-closure.models';
import { WeeklyEvent } from '../events/event.models';
import { TeamLineupState } from '../match/lineup/team-lineup.models';
import { DinnerSettlementView } from '../payments/dinner-settlement.models';
import { MatchSettlementView } from '../payments/match-settlement.models';
import { EventPaymentsView } from '../payments/payment.models';

export interface HistoryCursor {
  readonly eventId: string;
  readonly startsAt: string;
}

export interface HistoryEventItem {
  readonly actualDinerCount: number;
  readonly actualPlayerCount: number;
  readonly closedAt: string;
  readonly eventId: string;
  readonly groupId: string;
  readonly startsAt: string;
  readonly status: 'CLOSED';
  readonly title: string | null;
}

export interface HistoryPage {
  readonly hasMore: boolean;
  readonly items: readonly HistoryEventItem[];
  readonly nextCursor: HistoryCursor | null;
}

export interface HistoricalEventDetail {
  readonly attendance: readonly AttendanceRecord[];
  readonly closure: EventClosureSummary;
  readonly dinnerPlanning: DinnerPlanningView;
  readonly dinnerReality: DinnerRealityView;
  readonly dinnerSettlement: DinnerSettlementView;
  readonly event: WeeklyEvent;
  readonly lineup: TeamLineupState;
  readonly matchSettlement: MatchSettlementView;
  readonly payments: EventPaymentsView;
}

export type HistoryOperation = 'ACCESS' | 'CURSOR' | 'LOAD' | 'NOT_FOUND';

export class HistoryOperationError extends Error {
  constructor(readonly operation: HistoryOperation) {
    super(operation);
    this.name = 'HistoryOperationError';
  }
}

const HISTORY_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function historyDateParts(startsAt: string): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    timeZone: HISTORY_TIME_ZONE,
  }).formatToParts(new Date(startsAt));
  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '',
    month: (parts.find((part) => part.type === 'month')?.value ?? '')
      .replace('.', '')
      .toUpperCase(),
  };
}

export function historicalEventDate(startsAt: string): string {
  const value = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: HISTORY_TIME_ZONE,
  }).format(new Date(startsAt));
  return value.charAt(0).toUpperCase() + value.slice(1);
}
