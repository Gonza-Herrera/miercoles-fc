import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';

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
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);

  readonly activity = input.required<AttendanceActivity>();
  protected readonly currentEvent = signal<WeeklyEvent | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const groups = await this.groups.list();
      const groupId =
        this.context.current()?.id ??
        groups.find((group) => group.id === this.context.selectedGroupId())?.id ??
        groups[0]?.id;
      this.currentEvent.set(groupId ? await this.events.current(groupId) : null);
    } catch {
      this.errorMessage.set('No pudimos cargar el miércoles actual.');
    } finally {
      this.loading.set(false);
    }
  }
}
