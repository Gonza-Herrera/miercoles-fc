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
import { Button, Card, ConfirmDialog } from '../../../../shared/ui';
import { GroupContextService } from '../../../groups/group-context.service';
import { GroupDetail } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { GuestParticipantManager } from '../../participants';
import { EventCard } from '../../components/event-card/event-card';
import { EventContextService } from '../../event-context.service';
import {
  EVENT_NEXT_STATUS,
  EVENT_TRANSITION_LABELS,
  EventOperationError,
  EventStatus,
  WeeklyEvent,
  canEditEvent,
} from '../../event.models';
import { EventService } from '../../event.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    Card,
    ConfirmDialog,
    EventCard,
    GuestParticipantManager,
    PageContainer,
    RouterLink,
  ],
  selector: 'app-event-detail-page',
  styleUrl: '../../events.shared.scss',
  templateUrl: './event-detail-page.html',
})
export class EventDetailPage implements OnInit {
  private readonly eventContext = inject(EventContextService);
  private readonly events = inject(EventService);
  private readonly groupContext = inject(GroupContextService);
  private readonly groups = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly confirmClose = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly feedback = signal<string | null>(
    (this.router.getCurrentNavigation()?.extras.state?.['eventFeedback'] as string | undefined) ??
      null,
  );
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly transitioning = signal(false);
  protected readonly eventId = this.route.snapshot.paramMap.get('eventId')!;
  protected readonly isAdmin = computed(() => this.group()?.membership.role === 'ADMIN');
  protected readonly nextStatus = computed(() => {
    const event = this.event();
    return event ? (EVENT_NEXT_STATUS[event.status] ?? null) : null;
  });
  protected readonly canEdit = computed(() => {
    const event = this.event();
    return this.isAdmin() && !!event && canEditEvent(event);
  });
  protected readonly canManageGuests = computed(
    () => this.isAdmin() && this.event()?.status !== 'CLOSED',
  );
  protected readonly transitionLabel = computed(() => {
    const event = this.event();
    return event ? (EVENT_TRANSITION_LABELS[event.status] ?? '') : '';
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const event = await this.events.get(this.eventId);
      const group = await this.groups.get(event.groupId);
      this.event.set(event);
      this.group.set(group);
      this.eventContext.set(event);
      this.groupContext.set(group);
    } catch (error) {
      this.errorMessage.set(
        error instanceof EventOperationError && error.operation === 'NOT_FOUND'
          ? 'El evento no existe o ya no está disponible.'
          : 'No pudimos cargar el evento.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected requestTransition(): void {
    if (this.nextStatus() === 'CLOSED') {
      this.confirmClose.set(true);
      return;
    }
    void this.transition();
  }

  protected async transition(): Promise<void> {
    const target = this.nextStatus();
    this.confirmClose.set(false);
    if (!target || this.transitioning() || !this.isAdmin()) return;
    this.transitioning.set(true);
    this.errorMessage.set(null);
    this.feedback.set(null);
    try {
      const updated = await this.events.transition(this.eventId, target);
      this.event.set(updated);
      this.eventContext.set(updated);
      this.feedback.set(this.transitionFeedback(updated.status));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.transitioning.set(false);
    }
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof EventOperationError)) return 'No pudimos cambiar el estado.';
    if (error.operation === 'PERMISSION') return 'No tenés permisos para cambiar el estado.';
    if (error.operation === 'TRANSITION') {
      return 'El estado cambió en otra sesión. Actualizá el evento e intentá nuevamente.';
    }
    if (error.operation === 'CLOSED') return 'El evento ya está cerrado.';
    return 'No pudimos cambiar el estado.';
  }

  private transitionFeedback(status: EventStatus): string {
    const messages: Readonly<Record<EventStatus, string>> = {
      DRAFT: 'Miércoles guardado como borrador.',
      OPEN: 'El miércoles ya está abierto.',
      IN_PROGRESS: 'El miércoles está en curso.',
      SETTLEMENT: 'Pasamos a liquidación.',
      CLOSED: 'Miércoles cerrado.',
    };
    return messages[status];
  }
}
