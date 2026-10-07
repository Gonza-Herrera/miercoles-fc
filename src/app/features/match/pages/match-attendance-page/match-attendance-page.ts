import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Avatar, Badge, Button, Card } from '../../../../shared/ui';
import {
  AttendanceOperationError,
  AttendanceRecord,
  MatchAttendanceItemInput,
} from '../../../attendance/attendance.models';
import { AttendanceService } from '../../../attendance/attendance.service';
import { GroupDetail } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { WeeklyEvent } from '../../../events/event.models';
import { EventService } from '../../../events/event.service';

export interface MatchAttendeeRow {
  readonly id: string;
  readonly participantId: string | null;
  readonly groupMemberId: string | null;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly isGuest: boolean;
  readonly footballResponse: AttendanceRecord['footballResponse'];
  attended: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, PageContainer, RouterLink],
  selector: 'app-match-attendance-page',
  styleUrl: './match-attendance-page.scss',
  templateUrl: './match-attendance-page.html',
})
export class MatchAttendancePage implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly eventService = inject(EventService);
  private readonly groupService = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly attendees = signal<readonly MatchAttendeeRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);

  protected readonly presentCount = computed(
    () => this.attendees().filter((a) => a.attended).length,
  );
  protected readonly totalCount = computed(() => this.attendees().length);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    const eventId = this.route.snapshot.paramMap.get('eventId');
    if (!eventId) {
      this.errorMessage.set('Evento no encontrado.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.saveError.set(null);

    try {
      const currentEvent = await this.eventService.get(eventId);
      if (!currentEvent) {
        this.errorMessage.set('El evento no existe.');
        return;
      }
      this.event.set(currentEvent);

      const groupDetail = await this.groupService.get(currentEvent.groupId);
      this.group.set(groupDetail);

      if (groupDetail.membership?.role !== 'ADMIN') {
        this.errorMessage.set('Solo los administradores pueden marcar presentes.');
        return;
      }

      const records = await this.attendanceService.list(eventId);
      const rows: MatchAttendeeRow[] = records.map((record) => {
        const attended =
          record.actualFootball === 'YES'
            ? true
            : record.actualFootball === 'NO'
              ? false
              : record.footballResponse === 'YES';

        const id = record.participantId ?? record.groupMemberId ?? record.displayName;
        return {
          id,
          participantId: record.participantId,
          groupMemberId: record.groupMemberId,
          displayName: record.displayName,
          avatarUrl: record.avatarUrl,
          isGuest: record.isGuest,
          footballResponse: record.footballResponse,
          attended,
        };
      });

      // Ordenar: primero los confirmados y que juegan, luego el resto por nombre
      rows.sort((a, b) => {
        if (a.footballResponse === 'YES' && b.footballResponse !== 'YES') return -1;
        if (a.footballResponse !== 'YES' && b.footballResponse === 'YES') return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      this.attendees.set(rows);
    } catch {
      this.errorMessage.set('No pudimos cargar la lista de jugadores.');
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(id: string): void {
    if (this.saving()) return;
    this.attendees.update((items) =>
      items.map((item) => (item.id === id ? { ...item, attended: !item.attended } : item)),
    );
  }

  protected selectAll(attended: boolean): void {
    if (this.saving()) return;
    this.attendees.update((items) => items.map((item) => ({ ...item, attended })));
  }

  protected async save(): Promise<void> {
    const currentEvent = this.event();
    if (!currentEvent || this.saving()) return;

    this.saving.set(true);
    this.saveError.set(null);

    const payload: MatchAttendanceItemInput[] = this.attendees().map((attendee) => ({
      attended: attendee.attended,
      groupMemberId: attendee.groupMemberId,
      participantId: attendee.participantId,
    }));

    try {
      await this.attendanceService.recordMatchAttendance(currentEvent.id, payload);
      await this.router.navigate(['/events', currentEvent.id], {
        state: {
          eventFeedback: `Se guardó la lista de presentes (${this.presentCount()} jugadores).`,
        },
      });
    } catch (error) {
      this.saveError.set(
        error instanceof AttendanceOperationError && error.operation === 'SETTLEMENT_LOCKED'
          ? 'La cancha ya fue liquidada y la asistencia quedó bloqueada.'
          : 'No pudimos guardar los presentes. Revisá tu conexión e intentá de nuevo.',
      );
      this.saving.set(false);
    }
  }
}
