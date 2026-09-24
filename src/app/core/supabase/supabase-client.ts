import {
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { Database } from './database.types';

export interface SupabasePublicConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export const SUPABASE_CONFIG_PATH = '/config/supabase-config.json';

export const SUPABASE_PUBLIC_CONFIG = new InjectionToken<SupabasePublicConfig | null>(
  'SUPABASE_PUBLIC_CONFIG',
);

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient<Database>>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () => createSupabaseClient(inject(SUPABASE_PUBLIC_CONFIG)),
});

export function provideSupabase(config: SupabasePublicConfig | null): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SUPABASE_PUBLIC_CONFIG, useValue: config }]);
}

export function createSupabaseClient(
  config: SupabasePublicConfig | null,
): SupabaseClient<Database> {
  const validatedConfig = validateSupabaseConfig(config);

  return createClient<Database>(validatedConfig.url, validatedConfig.publishableKey);
}

export async function loadSupabaseConfig(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<SupabasePublicConfig | null> {
  const response = await fetcher(SUPABASE_CONFIG_PATH, { cache: 'no-store' });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load Supabase public configuration (${response.status}).`);
  }

  return validateSupabaseConfig((await response.json()) as unknown);
}

export function validateSupabaseConfig(config: unknown): SupabasePublicConfig {
  if (!isRecord(config)) {
    throw new Error('Supabase is not configured. Add the public runtime configuration file.');
  }

  const url = typeof config['url'] === 'string' ? config['url'].trim() : '';
  const publishableKey =
    typeof config['publishableKey'] === 'string' ? config['publishableKey'].trim() : '';

  if (!url || !publishableKey) {
    throw new Error('Supabase URL and publishable key are required.');
  }

  assertPublicSupabaseUrl(url);

  if (isPrivilegedKey(publishableKey)) {
    throw new Error('A Supabase secret or service-role key must never be used in the browser.');
  }

  return { url, publishableKey };
}

function assertPublicSupabaseUrl(value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Supabase URL must be a valid absolute URL.');
  }

  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
    throw new Error('Supabase URL must use HTTPS, except for local development.');
  }
}

function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_') || key.toLowerCase().includes('service_role')) {
    return true;
  }

  const segments = key.split('.');
  if (segments.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(segments[1])) as unknown;
    return isRecord(payload) && payload['role'] === 'service_role';
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(normalized + padding);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
