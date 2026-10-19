import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  const handlers: (() => void)[] = [];
  let statusHandler!: (status: string) => void;
  const channel = {
    on: vi.fn((_kind, _filter, callback) => {
      handlers.push(callback);
      return channel;
    }),
    subscribe: vi.fn((callback) => {
      statusHandler = callback;
      return channel;
    }),
  };
  const client = {
    channel: vi.fn(() => channel),
    realtime: { setAuth: vi.fn() },
    removeChannel: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    handlers.length = 0;
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        RealtimeService,
        { provide: AuthService, useValue: { session: signal({ access_token: 'token' }) } },
        { provide: SUPABASE_CLIENT, useValue: client },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('shares one Event channel, coalesces invalidations and removes it after the last cleanup', () => {
    const service = TestBed.inject(RealtimeService);
    const first = vi.fn();
    const second = vi.fn();

    const stopFirst = service.watchEvent('event-1', first);
    const stopSecond = service.watchEvent('event-1', second);
    statusHandler('SUBSCRIBED');
    handlers[0]();
    handlers[1]();
    vi.advanceTimersByTime(75);

    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('CONNECTED');

    stopFirst();
    expect(client.removeChannel).not.toHaveBeenCalled();
    stopSecond();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('reports reconnecting without merging stale payload data', () => {
    const service = TestBed.inject(RealtimeService);
    service.watchEvent('event-2', vi.fn());

    statusHandler('TIMED_OUT');

    expect(service.status()).toBe('RECONNECTING');
  });
});
