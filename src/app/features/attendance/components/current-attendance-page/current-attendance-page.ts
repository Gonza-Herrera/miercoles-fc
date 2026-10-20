import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Button, Card, EmptyState } from '../../../../shared/ui';
import { EventCard } from '../../../events/components/event-card/event-card';
import { WeeklyEvent } from '../../../events/event.models';
import { EventService } from '../../../events/event.service';
import { GroupContextService } from '../../../groups/group-context.service';
import { GroupService } from '../../../groups/group.service';
import { AttendanceActivity } from '../../attendance.models';
import { AttendanceManager } from '../attendance-manager/attendance-manager';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AttendanceManager, Button, Card, EmptyState, EventCard, PageContainer],
  selector: 'app-current-attendance-page',
  styleUrl: './current-attendance-page.scss',
  templateUrl: './current-attendance-page.html',
})
export class CurrentAttendancePage implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private request = 0;

  readonly activity = input.required<AttendanceActivity>();
  protected readonly currentEvent = signal<WeeklyEvent | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    const changes = this.route?.queryParamMap;
    if (!changes?.subscribe) {
      await this.load();
      return;
    }
    const subscription = changes.subscribe(() => void this.load());
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const requestedEventId = this.route?.snapshot.queryParamMap.get('eventId');
      if (requestedEventId) {
        const event = await this.events.get(requestedEventId);
        const group = await this.groups.get(event.groupId);
        if (request !== this.request) return;
        this.context.set(group);
        this.currentEvent.set(event);
        return;
      }
      const groups = await this.groups.list();
      const groupId =
        this.context.current()?.id ??
        groups.find((group) => group.id === this.context.selectedGroupId())?.id ??
        groups[0]?.id;
      const event = groupId ? await this.events.current(groupId) : null;
      if (request === this.request) this.currentEvent.set(event);
    } catch {
      if (request === this.request) {
        this.currentEvent.set(null);
        this.errorMessage.set('No pudimos cargar el miércoles solicitado.');
      }
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}
