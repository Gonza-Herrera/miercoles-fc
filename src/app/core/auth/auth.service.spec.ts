import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../supabase/database.types';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { AuthOperationError } from './auth.models';
import { AuthService } from './auth.service';

const session = {
  access_token: 'test-access-token',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  user: {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-09-24T00:00:00Z',
    email: 'gonzalo@example.com',
    id: '4b66c8e4-aae8-4d1e-b0b5-7e091f0d8835',
    user_metadata: {},
  },
} as Session;

describe('AuthService', () => {
  let emitAuthChange: (event: AuthChangeEvent, nextSession: Session | null) => void;
  let signInWithOtp: ReturnType<typeof vi.fn>;
  let signInWithOAuth: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    signInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });
    signOut = vi.fn().mockResolvedValue({ error: null });

    const client = {
      auth: {
        onAuthStateChange: vi.fn((callback) => {
          emitAuthChange = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithOAuth,
        signInWithOtp,
        signOut,
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                avatar_url: null,
                created_at: '2026-09-24T00:00:00Z',
                display_name: 'Gonzalo',
                id: session.user.id,
                updated_at: '2026-09-24T00:00:00Z',
              },
              error: null,
            }),
          })),
        })),
      })),
    } as unknown as SupabaseClient<Database>;

    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: client }],
    });
  });

  it('remains initializing until Supabase emits INITIAL_SESSION', async () => {
    const service = TestBed.inject(AuthService);

    expect(service.isInitializing()).toBe(true);

    emitAuthChange('INITIAL_SESSION', null);
    await service.initialize();

    expect(service.state().status).toBe('UNAUTHENTICATED');
  });

  it('restores the session and loads only the matching profile', async () => {
    const service = TestBed.inject(AuthService);

    emitAuthChange('INITIAL_SESSION', session);
    await service.initialize();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe('gonzalo@example.com');
    await vi.waitFor(() => expect(service.profile()?.display_name).toBe('Gonzalo'));
  });

  it('requests a Magic Link using the centralized callback URL', async () => {
    const service = TestBed.inject(AuthService);
    const origin = TestBed.inject(DOCUMENT).location.origin;

    await service.requestMagicLink(' gonzalo@example.com ', '/payments');

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'gonzalo@example.com',
      options: {
        emailRedirectTo: `${origin}/auth/callback?returnUrl=%2Fpayments`,
        shouldCreateUser: true,
      },
    });
  });

  it('starts Google OAuth through Supabase', async () => {
    const service = TestBed.inject(AuthService);

    await service.signInWithGoogle('/');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      options: { redirectTo: `${TestBed.inject(DOCUMENT).location.origin}/auth/callback` },
      provider: 'google',
    });
  });

  it('maps provider failures without exposing raw errors', async () => {
    signInWithOtp.mockResolvedValueOnce({ error: new Error('sensitive provider details') });
    const service = TestBed.inject(AuthService);

    await expect(service.requestMagicLink('gonzalo@example.com')).rejects.toEqual(
      new AuthOperationError('MAGIC_LINK'),
    );
  });

  it('clears application identity after Supabase signs out', async () => {
    const service = TestBed.inject(AuthService);
    emitAuthChange('INITIAL_SESSION', session);
    await service.initialize();

    await service.signOut();

    expect(signOut).toHaveBeenCalledOnce();
    expect(service.state().status).toBe('UNAUTHENTICATED');
    expect(service.profile()).toBeNull();
  });
});
