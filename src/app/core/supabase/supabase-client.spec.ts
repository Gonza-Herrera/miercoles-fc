import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import {
  SUPABASE_CLIENT,
  SUPABASE_PUBLIC_CONFIG,
  createSupabaseClient,
  loadSupabaseConfig,
  provideSupabase,
  validateSupabaseConfig,
} from './supabase-client';

const publicConfig = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test_key',
};

describe('Supabase client infrastructure', () => {
  it('provides one typed client through Angular dependency injection', () => {
    TestBed.configureTestingModule({ providers: [provideSupabase(publicConfig)] });

    const firstClient = TestBed.inject(SUPABASE_CLIENT);
    const secondClient = TestBed.inject(SUPABASE_CLIENT);

    expect(firstClient).toBe(secondClient);
    expect(TestBed.inject(SUPABASE_PUBLIC_CONFIG)).toEqual(publicConfig);
  });

  it('fails clearly when required public configuration is missing', () => {
    expect(() => createSupabaseClient(null)).toThrowError(/not configured/i);
    expect(() => validateSupabaseConfig({ url: '', publishableKey: '' })).toThrowError(/required/i);
  });

  it('rejects secret and service-role keys in browser configuration', () => {
    expect(() =>
      validateSupabaseConfig({ ...publicConfig, publishableKey: 'sb_secret_do_not_expose' }),
    ).toThrowError(/must never be used in the browser/i);

    const serviceRolePayload = btoa(JSON.stringify({ role: 'service_role' }));
    expect(() =>
      validateSupabaseConfig({
        ...publicConfig,
        publishableKey: `header.${serviceRolePayload}.signature`,
      }),
    ).toThrowError(/must never be used in the browser/i);
  });

  it('allows the app shell to start when no local runtime config exists', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

    await expect(loadSupabaseConfig(fetcher)).resolves.toBeNull();
  });
});
