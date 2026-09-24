import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadSupabaseConfig, provideSupabase } from './app/core/supabase/supabase-client';

async function bootstrap(): Promise<void> {
  const supabaseConfig = await loadSupabaseConfig();

  await bootstrapApplication(
    App,
    mergeApplicationConfig(appConfig, {
      providers: [provideSupabase(supabaseConfig)],
    }),
  );
}

bootstrap().catch((error: unknown) => console.error(error));
