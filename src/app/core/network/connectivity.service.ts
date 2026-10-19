import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export class OfflineOperationError extends Error {
  constructor() {
    super('Necesitás conexión a internet para realizar esta acción.');
    this.name = 'OfflineOperationError';
  }
}

export function offlineAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (globalThis.navigator && !globalThis.navigator.onLine) {
    return Promise.reject(new OfflineOperationError());
  }
  return globalThis.fetch(input, init);
}

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = this.document.defaultView;

  readonly online = signal(this.window?.navigator.onLine ?? true);

  constructor() {
    const setOnline = () => this.online.set(true);
    const setOffline = () => this.online.set(false);

    this.window?.addEventListener('online', setOnline);
    this.window?.addEventListener('offline', setOffline);
    this.destroyRef.onDestroy(() => {
      this.window?.removeEventListener('online', setOnline);
      this.window?.removeEventListener('offline', setOffline);
    });
  }

  requireOnline(): void {
    if (!this.online()) throw new OfflineOperationError();
  }
}
