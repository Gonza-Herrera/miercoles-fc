import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Button, Card } from '../../../../shared/ui';
import { GroupService } from '../../../groups/group.service';
import {
  EventOperationError,
  WeeklyEvent,
  canEditSchedule,
  isoToLocalDateTime,
} from '../../event.models';
import { EventService } from '../../event.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, PageContainer, ReactiveFormsModule, RouterLink],
  selector: 'app-event-form-page',
  styleUrl: '../../events.shared.scss',
  templateUrl: './event-form-page.html',
})
export class EventFormPage implements OnInit {
  private readonly events = inject(EventService);
  private readonly fb = inject(FormBuilder);
  private readonly groups = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly eventId = this.route.snapshot.paramMap.get('eventId');
  protected groupId = this.route.snapshot.paramMap.get('groupId');
  protected readonly form = this.fb.nonNullable.group({
    courtPrice: ['', [Validators.required, Validators.pattern(/^\s*\d[\d.,]*\s*$/)]],
    date: ['', Validators.required],
    location: ['', [Validators.required, Validators.maxLength(200)]],
    time: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    if (!this.eventId) return;
    this.loading.set(true);
    try {
      const event = await this.events.get(this.eventId);
      const group = await this.groups.get(event.groupId);
      if (group.membership.role !== 'ADMIN' || event.status === 'CLOSED') {
        this.errorMessage.set(
          event.status === 'CLOSED'
            ? 'Un evento cerrado ya no se puede editar.'
            : 'No tenés permisos para editar este evento.',
        );
        this.form.disable();
        return;
      }
      this.event.set(event);
      this.groupId = event.groupId;
      const local = isoToLocalDateTime(event.startsAt);
      this.form.setValue({
        courtPrice: this.priceInput(event.courtPriceMinor),
        date: local.date,
        location: event.location,
        time: local.time,
      });
      if (!canEditSchedule(event)) {
        this.form.controls.date.disable();
        this.form.controls.time.disable();
        this.form.controls.location.disable();
      }
    } catch {
      this.errorMessage.set('No pudimos cargar el evento.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || !this.groupId) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const saved = this.eventId
        ? await this.events.update(this.eventId, this.form.getRawValue())
        : await this.events.create(this.groupId, this.form.getRawValue());
      await this.router.navigate(['/events', saved.id], {
        state: { eventFeedback: this.eventId ? 'Cambios guardados.' : 'Miércoles creado.' },
      });
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof EventOperationError)) return 'No pudimos guardar el evento.';
    if (error.operation === 'PERMISSION') return 'No tenés permisos para guardar este evento.';
    if (error.operation === 'CLOSED') return 'El evento ya está cerrado.';
    if (error.operation === 'SCHEDULE_LOCKED') {
      return 'En esta etapa sólo se puede actualizar el precio de la cancha.';
    }
    if (error.operation === 'VALIDATION') return 'Revisá la fecha, la hora, el lugar y el precio.';
    return 'No pudimos guardar el evento.';
  }

  private priceInput(amountMinor: number): string {
    const whole = Math.trunc(amountMinor / 100);
    const fraction = String(amountMinor % 100).padStart(2, '0');
    return fraction === '00' ? String(whole) : `${whole},${fraction}`;
  }
}
