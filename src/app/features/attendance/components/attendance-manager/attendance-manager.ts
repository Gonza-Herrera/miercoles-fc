import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { EventStatus } from '../../../events/event.models';
import { Button, Card } from '../../../../shared/ui';
import {
  AttendanceActivity,
  AttendanceMode,
  AttendanceOperationError,
  AttendanceRecord,
  AttendanceResponse,
} from '../../attendance.models';
import { AttendanceService } from '../../attendance.service';
import { AttendanceChoice } from '../attendance-choice/attendance-choice';
import { AttendanceList } from '../attendance-list/attendance-list';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AttendanceChoice, AttendanceList, Button, Card],
  selector: 'app-attendance-manager',
  styleUrl: './attendance-manager.scss',
  templateUrl: './attendance-manager.html',
})
export class AttendanceManager implements OnInit {
  private readonly attendance = inject(AttendanceService);

  readonly eventId = input.required<string>();
  readonly eventStatus = input.required<EventStatus>();
  readonly mode = input<AttendanceMode>('both');

  protected readonly attendees = signal<readonly AttendanceRecord[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly savingActivity = signal<AttendanceActivity | null>(null);
  protected readonly currentUser = computed(
    () => this.attendees().find((attendee) => attendee.isCurrentUser) ?? null,
  );
  protected readonly editable = computed(
    () => this.eventStatus() === 'OPEN' && this.currentUser()?.membershipActive === true,
  );
  protected readonly footballYesCount = computed(
    () => this.attendees().filter((attendee) => attendee.footballResponse === 'YES').length,
  );
  protected readonly dinnerYesCount = computed(
    () => this.attendees().filter((attendee) => attendee.dinnerResponse === 'YES').length,
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.attendees.set(await this.attendance.list(this.eventId()));
    } catch {
      this.errorMessage.set('No pudimos cargar la asistencia planificada.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async confirm(
    activity: AttendanceActivity,
    response: Exclude<AttendanceResponse, 'UNKNOWN'>,
  ): Promise<void> {
    if (!this.editable() || this.savingActivity()) return;
    this.savingActivity.set(activity);
    this.errorMessage.set(null);
    this.feedback.set(null);
    try {
      const saved =
        activity === 'football'
          ? await this.attendance.setFootball(this.eventId(), response)
          : await this.attendance.setDinner(this.eventId(), response);
      this.attendees.update((attendees) =>
        attendees.map((attendee) =>
          attendee.isCurrentUser
            ? {
                ...attendee,
                dinnerResponse: saved.dinnerResponse,
                footballResponse: saved.footballResponse,
                participantId: saved.participantId,
              }
            : attendee,
        ),
      );
      this.feedback.set(
        activity === 'football'
          ? 'Guardamos tu respuesta para el partido.'
          : 'Guardamos tu respuesta para la cena.',
      );
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.savingActivity.set(null);
    }
  }

  protected readOnlyMessage(): string {
    const messages: Readonly<Record<EventStatus, string>> = {
      DRAFT: 'Las confirmaciones se habilitan cuando el miércoles está abierto.',
      OPEN: 'Tu membresía activa es necesaria para confirmar.',
      IN_PROGRESS: 'El miércoles ya comenzó. Las respuestas planificadas son de solo lectura.',
      SETTLEMENT: 'La planificación terminó. Las respuestas son de solo lectura.',
      CLOSED: 'Este miércoles está cerrado. Las respuestas son históricas.',
    };
    return messages[this.eventStatus()];
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof AttendanceOperationError)) return 'No pudimos guardar tu respuesta.';
    if (error.operation === 'NOT_OPEN') {
      return 'El estado del miércoles cambió. La confirmación ya no está disponible.';
    }
    if (error.operation === 'PERMISSION') {
      return 'Necesitás una membresía activa en este grupo para confirmar.';
    }
    if (error.operation === 'VALIDATION') return 'Elegí Voy o No voy.';
    return 'No pudimos guardar tu respuesta. Intentá nuevamente.';
  }
}
