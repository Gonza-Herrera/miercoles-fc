import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

import { AuthService } from '../auth/auth.service';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { RealtimeConnectionStatus } from './realtime.models';

const EVENT_TABLES = [
  'events',
  'event_participants',
  'teams',
  'team_members',
  'event_managers',
  'event_drafts',
  'dinner_plans',
  'dinner_expenses',
  'match_settlements',
  'match_settlement_items',
  'dinner_settlements',
  'dinner_settlement_items',
  'payments',
] as const;

interface SharedEventSubscription {
  readonly callbacks: Set<() => void>;
  readonly channel: RealtimeChannel;
  timer: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly eventSubscriptions = new Map<string, SharedEventSubscription>();
  private readonly groupChannels = new Set<RealtimeChannel>();
  private readonly activeSignal = signal(false);
  private readonly statusSignal = signal<RealtimeConnectionStatus>('DISCONNECTED');

  readonly active = this.activeSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();

  constructor() {
    effect(() => {
      const token = this.auth.session()?.access_token;
      if (token) void this.client.realtime.setAuth(token);
      else this.removeAll();
    });

    const onVisibility = () => {
      if (this.document.visibilityState === 'visible') this.invalidateAll();
    };
    this.document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.removeAll();
    });
  }

  watchEvent(eventId: string, onInvalidate: () => void): () => void {
    let shared = this.eventSubscriptions.get(eventId);
    if (!shared) {
      const callbacks = new Set<() => void>();
      const notify = () => this.schedule(eventId);
      let channel = this.client.channel(`event:${eventId}`);
      for (const table of EVENT_TABLES) {
        channel = channel.on(
          'postgres_changes',
          {
            event: '*',
            filter: `${table === 'events' ? 'id' : 'event_id'}=eq.${eventId}`,
            schema: 'public',
            table,
          },
          notify,
        );
      }
      shared = { callbacks, channel, timer: null };
      this.eventSubscriptions.set(eventId, shared);
      this.activeSignal.set(true);
      this.statusSignal.set('CONNECTING');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.statusSignal.set('CONNECTED');
          this.schedule(eventId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.statusSignal.set('RECONNECTING');
        } else if (status === 'CLOSED') {
          this.statusSignal.set('DISCONNECTED');
        }
      });
    }
    shared.callbacks.add(onInvalidate);

    return () => {
      const current = this.eventSubscriptions.get(eventId);
      if (!current) return;
      current.callbacks.delete(onInvalidate);
      if (current.callbacks.size) return;
      if (current.timer) clearTimeout(current.timer);
      this.eventSubscriptions.delete(eventId);
      void this.client.removeChannel(current.channel);
      this.updateIdleStatus();
    };
  }

  watchGroup(groupId: string, onInvalidate: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onInvalidate, 75);
    };
    this.statusSignal.set('CONNECTING');
    this.activeSignal.set(true);
    const channel = this.client
      .channel(`group:${groupId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', filter: `group_id=eq.${groupId}`, schema: 'public', table: 'events' },
        notify,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.statusSignal.set('CONNECTED');
          notify();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.statusSignal.set('RECONNECTING');
        } else if (status === 'CLOSED') {
          this.statusSignal.set('DISCONNECTED');
        }
      });
    this.groupChannels.add(channel);
    return () => {
      if (timer) clearTimeout(timer);
      this.groupChannels.delete(channel);
      void this.client.removeChannel(channel);
      this.updateIdleStatus();
    };
  }

  private schedule(eventId: string): void {
    const shared = this.eventSubscriptions.get(eventId);
    if (!shared) return;
    if (shared.timer) clearTimeout(shared.timer);
    shared.timer = setTimeout(() => {
      shared.timer = null;
      for (const callback of shared.callbacks) callback();
    }, 75);
  }

  private invalidateAll(): void {
    for (const eventId of this.eventSubscriptions.keys()) this.schedule(eventId);
  }

  private removeAll(): void {
    for (const subscription of this.eventSubscriptions.values()) {
      if (subscription.timer) clearTimeout(subscription.timer);
      void this.client.removeChannel(subscription.channel);
    }
    for (const channel of this.groupChannels) void this.client.removeChannel(channel);
    this.eventSubscriptions.clear();
    this.groupChannels.clear();
    this.activeSignal.set(false);
    this.statusSignal.set('DISCONNECTED');
  }

  private updateIdleStatus(): void {
    if (!this.eventSubscriptions.size && !this.groupChannels.size) {
      this.activeSignal.set(false);
      this.statusSignal.set('DISCONNECTED');
    }
  }
}
