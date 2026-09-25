import { Injectable, computed, signal } from '@angular/core';

import { GroupDetail } from './group.models';

@Injectable({ providedIn: 'root' })
export class GroupContextService {
  private readonly currentSignal = signal<GroupDetail | null>(null);

  readonly current = this.currentSignal.asReadonly();
  readonly membership = computed(() => this.current()?.membership ?? null);
  readonly isAdmin = computed(() => this.membership()?.role === 'ADMIN');

  set(group: GroupDetail): void {
    this.currentSignal.set(group);
  }

  clear(): void {
    this.currentSignal.set(null);
  }
}
