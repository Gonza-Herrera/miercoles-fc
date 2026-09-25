import { Injectable, computed, signal } from '@angular/core';

import { GroupDetail } from './group.models';

@Injectable({ providedIn: 'root' })
export class GroupContextService {
  private readonly currentSignal = signal<GroupDetail | null>(null);
  private readonly selectedGroupIdSignal = signal<string | null>(this.readSelectedGroupId());

  readonly current = this.currentSignal.asReadonly();
  readonly selectedGroupId = this.selectedGroupIdSignal.asReadonly();
  readonly membership = computed(() => this.current()?.membership ?? null);
  readonly isAdmin = computed(() => this.membership()?.role === 'ADMIN');

  set(group: GroupDetail): void {
    this.currentSignal.set(group);
    this.selectedGroupIdSignal.set(group.id);
    try {
      globalThis.localStorage?.setItem('miercoles-fc:selected-group', group.id);
    } catch {
      // Storage is optional; the in-memory context still works.
    }
  }

  clear(): void {
    this.currentSignal.set(null);
  }

  private readSelectedGroupId(): string | null {
    try {
      return globalThis.localStorage?.getItem('miercoles-fc:selected-group') ?? null;
    } catch {
      return null;
    }
  }
}
