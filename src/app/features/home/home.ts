import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PageContainer } from '../../shared/layout';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { Button, Card, EmptyState } from '../../shared/ui';
import { AttendanceRecord } from '../attendance/attendance.models';
import { AttendanceService } from '../attendance/attendance.service';
import { DinnerPlanningService } from '../dinner/dinner-planning.service';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly dinnerPlanning = inject(DinnerPlanningService);
  private readonly eventContext = inject(EventContextService);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);
  private readonly realtime = inject(RealtimeService, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private request = 0;
  private unwatchEvent: (() => void) | null = null;
  private unwatchGroup: (() => void) | null = null;
  private watchedEventId: string | null = null;
  private watchedGroupId: string | null = null;

  protected readonly attendanceError = signal(false);
  protected readonly attendanceRecords = signal<readonly AttendanceRecord[]>([]);
  protected readonly currentEvent = signal<WeeklyEvent | null>(null);
  protected readonly dinnerMenu = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly isAdmin = computed(() => this.group()?.membership.role === 'ADMIN');
  protected readonly dashboard = computed(() => {
    const event = this.currentEvent();
    return event ? buildEventDashboard(event, this.attendanceRecords()) : null;
  });

  async ngOnInit(): Promise<void> {
    const changes = this.route?.queryParamMap;
    if (!changes?.subscribe) {
      await this.load();
      return;
    }
    const subscription = changes.subscribe(() => void this.load());
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected async load(showLoading = true): Promise<void> {
    const request = ++this.request;
    if (showLoading) this.loading.set(true);
    this.errorMessage.set(null);
    this.attendanceError.set(false);
    this.attendanceRecords.set([]);
    this.dinnerMenu.set(null);
    try {
      const requestedEventId = this.route?.snapshot.queryParamMap.get('eventId');
      if (requestedEventId) {
        const event = await this.events.get(requestedEventId);
        const group = await this.groups.get(event.groupId);
        if (request !== this.request) return;
        this.group.set(group);
        this.currentEvent.set(event);
        this.context.set(group);
        this.watch(group.id, event.id);
        this.eventContext.set(event);
        await this.loadDashboardDetails(event, request);
        return;
      }
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
      if (request !== this.request) return;
      this.group.set(group);
      this.currentEvent.set(event);
      this.context.set(group);
      this.watch(group.id, event?.id ?? null);
      if (event) {
        this.eventContext.set(event);
        await this.loadDashboardDetails(event, request);
      } else {
        this.eventContext.clear();
      }
    } catch {
      if (request === this.request) {
        this.errorMessage.set('No pudimos cargar el miércoles solicitado.');
        this.eventContext.clear();
      }
    } finally {
      if (showLoading && request === this.request) this.loading.set(false);
    }
  }

  private async loadDashboardDetails(event: WeeklyEvent, request: number): Promise<void> {
    try {
      const attendance = await this.attendance.listForDashboard(event.id);
      if (request === this.request) this.attendanceRecords.set(attendance);
    } catch {
      if (request === this.request) this.attendanceError.set(true);
    }
    try {
      const dinner = await this.dinnerPlanning.get(event.id);
      if (request === this.request) this.dinnerMenu.set(dinner.plan?.menu ?? null);
    } catch {
      if (request === this.request) this.dinnerMenu.set(null);
    }
  }

  private watch(groupId: string, eventId: string | null): void {
    if (this.watchedGroupId !== groupId) {
      this.unwatchGroup?.();
      this.watchedGroupId = groupId;
      this.unwatchGroup = this.realtime?.watchGroup(groupId, () => void this.load(false)) ?? null;
    }
    if (this.watchedEventId !== eventId) {
      this.unwatchEvent?.();
      this.watchedEventId = eventId;
      this.unwatchEvent = eventId
        ? (this.realtime?.watchEvent(eventId, () => void this.load(false)) ?? null)
        : null;
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.unwatchEvent?.();
      this.unwatchGroup?.();
    });
  }
}
