import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageContainer } from '../../shared/layout';
import { Button, Card, EmptyState } from '../../shared/ui';
import { AttendanceRecord } from '../attendance/attendance.models';
import { AttendanceService } from '../attendance/attendance.service';
import { EventContextService } from '../events/event-context.service';
import { WeeklyEvent } from '../events/event.models';
import { EventService } from '../events/event.service';
import { GroupContextService } from '../groups/group-context.service';
import { GroupDetail } from '../groups/group.models';
import { GroupService } from '../groups/group.service';
import { DinnerSummaryCard } from './components/dinner-summary-card/dinner-summary-card';
import { EventDashboardHeader } from './components/event-dashboard-header/event-dashboard-header';
import { MatchSummaryCard } from './components/match-summary-card/match-summary-card';
import { buildEventDashboard } from './event-dashboard.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    Card,
    DinnerSummaryCard,
    EmptyState,
    EventDashboardHeader,
    MatchSummaryCard,
    PageContainer,
    RouterLink,
  ],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly attendance = inject(AttendanceService);
  private readonly context = inject(GroupContextService);
  private readonly eventContext = inject(EventContextService);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);

  protected readonly attendanceError = signal(false);
  protected readonly attendanceRecords = signal<readonly AttendanceRecord[]>([]);
  protected readonly currentEvent = signal<WeeklyEvent | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly isAdmin = computed(() => this.group()?.membership.role === 'ADMIN');
  protected readonly dashboard = computed(() => {
    const event = this.currentEvent();
    return event ? buildEventDashboard(event, this.attendanceRecords()) : null;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.attendanceError.set(false);
    this.attendanceRecords.set([]);
    try {
      const summaries = await this.groups.list();
      const selectedId =
        this.context.current()?.id ??
        summaries.find((group) => group.id === this.context.selectedGroupId())?.id ??
        summaries[0]?.id;
      if (!selectedId) {
        this.group.set(null);
        this.currentEvent.set(null);
        this.eventContext.clear();
        return;
      }
      const [group, event] = await Promise.all([
        this.groups.get(selectedId),
        this.events.current(selectedId),
      ]);
      this.group.set(group);
      this.currentEvent.set(event);
      this.context.set(group);
      if (event) {
        this.eventContext.set(event);
        try {
          this.attendanceRecords.set(await this.attendance.listForDashboard(event.id));
        } catch {
          this.attendanceError.set(true);
        }
      } else {
        this.eventContext.clear();
      }
    } catch {
      this.errorMessage.set('No pudimos cargar tu próximo miércoles.');
      this.eventContext.clear();
    } finally {
      this.loading.set(false);
    }
  }
}
