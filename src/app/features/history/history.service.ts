import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { AttendanceService } from '../attendance/attendance.service';
import { DinnerPlanningService } from '../dinner/dinner-planning.service';
import { DinnerRealityService } from '../dinner/dinner-reality.service';
import { EventClosureService } from '../events/event-closure.service';
import { EventService } from '../events/event.service';
import { TeamLineupService } from '../match/lineup/team-lineup.service';
import { DinnerSettlementService } from '../payments/dinner-settlement.service';
import { MatchSettlementService } from '../payments/match-settlement.service';
import { PaymentService } from '../payments/payment.service';
import {
  HistoricalEventDetail,
  HistoryCursor,
  HistoryOperationError,
  HistoryPage,
} from './history.models';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly attendance = inject(AttendanceService);
  private readonly closure = inject(EventClosureService);
  private readonly dinnerPlanning = inject(DinnerPlanningService);
  private readonly dinnerReality = inject(DinnerRealityService);
  private readonly dinnerSettlements = inject(DinnerSettlementService);
  private readonly events = inject(EventService);
  private readonly lineup = inject(TeamLineupService);
  private readonly matchSettlements = inject(MatchSettlementService);
  private readonly payments = inject(PaymentService);

  async list(groupId: string, cursor: HistoryCursor | null, limit = 10): Promise<HistoryPage> {
    const { data, error } = await this.client.rpc('get_group_event_history', {
      p_before_event_id: cursor?.eventId,
      p_before_starts_at: cursor?.startsAt,
      p_group_id: groupId,
      p_limit: limit,
    });
    if (error || !data) throw this.mapError(error);
    return data as unknown as HistoryPage;
  }

  async getDetail(groupId: string, eventId: string): Promise<HistoricalEventDetail> {
    const event = await this.events.get(eventId);
    if (event.groupId !== groupId || event.status !== 'CLOSED') {
      throw new HistoryOperationError('NOT_FOUND');
    }
    const [
      attendance,
      closure,
      dinnerPlanning,
      dinnerReality,
      dinnerSettlement,
      lineup,
      matchSettlement,
      payments,
    ] = await Promise.all([
      this.attendance.list(eventId),
      this.closure.get(eventId),
      this.dinnerPlanning.get(eventId),
      this.dinnerReality.get(eventId),
      this.dinnerSettlements.get(eventId),
      this.lineup.get(eventId),
      this.matchSettlements.get(eventId),
      this.payments.get(eventId),
    ]);
    return {
      attendance,
      closure,
      dinnerPlanning,
      dinnerReality,
      dinnerSettlement,
      event,
      lineup,
      matchSettlement,
      payments,
    };
  }

  private mapError(error: { readonly message?: string } | null): HistoryOperationError {
    const message = error?.message ?? '';
    if (message.includes('HISTORY_CURSOR_INVALID')) return new HistoryOperationError('CURSOR');
    if (
      message.includes('HISTORY_ACCESS_DENIED') ||
      message.includes('HISTORY_AUTH_REQUIRED') ||
      message.includes('permission denied')
    ) {
      return new HistoryOperationError('ACCESS');
    }
    return new HistoryOperationError('LOAD');
  }
}
