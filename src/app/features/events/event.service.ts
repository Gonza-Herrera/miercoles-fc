import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  EventInput,
  EventOperation,
  EventOperationError,
  EventStatus,
  WeeklyEvent,
  localDateTimeToIso,
  mapEvent,
  parseCourtPriceToMinor,
  selectCurrentEvent,
} from './event.models';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly client = inject(SUPABASE_CLIENT);

  async list(groupId: string): Promise<readonly WeeklyEvent[]> {
    const { data, error } = await this.client
      .from('events')
      .select(
        'id, group_id, created_by, title, starts_at, location, court_price_minor, currency_code, status, created_at, updated_at',
      )
      .eq('group_id', groupId)
      .order('starts_at', { ascending: false });
    if (error) throw new EventOperationError('LOAD');
    return (data ?? []).map(mapEvent);
  }

  async get(eventId: string): Promise<WeeklyEvent> {
    const { data, error } = await this.client
      .from('events')
      .select(
        'id, group_id, created_by, title, starts_at, location, court_price_minor, currency_code, status, created_at, updated_at',
      )
      .eq('id', eventId)
      .single();
    if (error || !data) {
      throw new EventOperationError(error?.code === 'PGRST116' ? 'NOT_FOUND' : 'LOAD');
    }
    return mapEvent(data);
  }

  async current(groupId: string, now = new Date()): Promise<WeeklyEvent | null> {
    return selectCurrentEvent(await this.list(groupId), now);
  }

  async create(groupId: string, input: EventInput): Promise<WeeklyEvent> {
    const values = this.rpcValues(input);
    const { data, error } = await this.client.rpc('create_event', {
      p_court_price_minor: values.price,
      p_group_id: groupId,
      p_location: input.location,
      p_starts_at: values.startsAt,
    });
    if (error || !data) throw this.mapError(error, 'CREATE');
    return mapEvent(data);
  }

  async update(eventId: string, input: EventInput): Promise<WeeklyEvent> {
    const values = this.rpcValues(input);
    const { data, error } = await this.client.rpc('update_event_details', {
      p_court_price_minor: values.price,
      p_event_id: eventId,
      p_location: input.location,
      p_starts_at: values.startsAt,
    });
    if (error || !data) throw this.mapError(error, 'UPDATE');
    return mapEvent(data);
  }

  async transition(eventId: string, status: EventStatus): Promise<WeeklyEvent> {
    const { data, error } = await this.client.rpc('transition_event_status', {
      p_event_id: eventId,
      p_target_status: status,
    });
    if (error || !data) throw this.mapError(error, 'TRANSITION');
    return mapEvent(data);
  }

  private rpcValues(input: EventInput): { price: number; startsAt: string } {
    const price = parseCourtPriceToMinor(input.courtPrice);
    const startsAt = localDateTimeToIso(input.date, input.time);
    if (price === null || startsAt === null || !input.location.trim()) {
      throw new EventOperationError('VALIDATION');
    }
    return { price, startsAt };
  }

  private mapError(
    error: { message?: string } | null,
    fallback: EventOperation,
  ): EventOperationError {
    const message = error?.message ?? '';
    if (message.includes('EVENT_ADMIN_REQUIRED') || message.includes('permission denied')) {
      return new EventOperationError('PERMISSION');
    }
    if (message.includes('EVENT_NOT_FOUND')) return new EventOperationError('NOT_FOUND');
    if (message.includes('EVENT_CLOSED')) return new EventOperationError('CLOSED');
    if (message.includes('EVENT_SCHEDULE_LOCKED')) {
      return new EventOperationError('SCHEDULE_LOCKED');
    }
    if (message.includes('EVENT_TRANSITION_INVALID')) {
      return new EventOperationError('TRANSITION');
    }
    if (message.includes('EVENT_') && message.includes('INVALID')) {
      return new EventOperationError('VALIDATION');
    }
    return new EventOperationError(fallback);
  }
}
