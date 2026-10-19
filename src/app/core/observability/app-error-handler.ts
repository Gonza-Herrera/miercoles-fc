import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const name = error instanceof Error ? error.name : 'UnknownError';
    // Keep production diagnostics deliberately metadata-only: never log request payloads,
    // auth tokens, invitation URLs, emails, names, or Supabase response bodies.
    console.error('[Miércoles FC] Error no controlado', {
      name,
      timestamp: new Date().toISOString(),
    });
  }
}
