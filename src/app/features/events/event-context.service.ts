import { Injectable, computed, signal } from '@angular/core';

import { WeeklyEvent, canEditEvent, canEditSchedule } from './event.models';

@Injectable({ providedIn: 'root' })
export class EventContextService {
  private readonly currentSignal = signal<WeeklyEvent | null>(null);

  readonly current = this.currentSignal.asReadonly();
  readonly status = computed(() => this.current()?.status ?? null);
  readonly editable = computed(() => {
    const event = this.current();
    return event ? canEditEvent(event) : false;
  });
  readonly scheduleEditable = computed(() => {
    const event = this.current();
    return event ? canEditSchedule(event) : false;
  });

  set(event: WeeklyEvent): void {
    this.currentSignal.set(event);
  }

  clear(): void {
    this.currentSignal.set(null);
  }
}
