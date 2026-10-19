import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate, { optional: true });

  readonly available = signal(false);
  readonly applying = signal(false);
  readonly error = signal(false);

  constructor() {
    if (!this.updates?.isEnabled) return;
    this.updates.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.available.set(true));
    this.updates.unrecoverable.subscribe(() => this.available.set(true));
  }

  async apply(): Promise<void> {
    if (!this.updates || !this.available() || this.applying()) return;
    this.applying.set(true);
    this.error.set(false);
    try {
      await this.updates.activateUpdate();
      globalThis.location.reload();
    } catch {
      this.error.set(true);
      this.applying.set(false);
    }
  }

  dismiss(): void {
    this.available.set(false);
  }
}
