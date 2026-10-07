import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { PageContainer } from '../../shared/layout';
import { Badge, Button, Card, ConfirmDialog, EmptyState } from '../../shared/ui';
import { WeeklyEvent, eventDateLabel, formatMoneyMinor } from '../events/event.models';
import { EventService } from '../events/event.service';
import { GroupContextService } from '../groups/group-context.service';
import { GroupService } from '../groups/group.service';
import {
  MatchSettlementOperationError,
  MatchSettlementUnavailableReason,
  MatchSettlementView,
} from './match-settlement.models';
import { MatchSettlementService } from './match-settlement.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button, Card, ConfirmDialog, EmptyState, PageContainer],
  selector: 'app-payments',
  styleUrl: './payments.scss',
  templateUrl: './payments.html',
})
export class Payments implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);
  private readonly settlements = inject(MatchSettlementService);

  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly view = signal<MatchSettlementView | null>(null);
  protected readonly loading = signal(true);
  protected readonly finalizing = signal(false);
  protected readonly confirmationOpen = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly eventDateLabel = eventDateLabel;
  protected readonly formatMoney = formatMoneyMinor;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const summaries = await this.groups.list();
      const groupId =
        this.context.current()?.id ??
        summaries.find((group) => group.id === this.context.selectedGroupId())?.id ??
        summaries[0]?.id;
      if (!groupId) {
        this.event.set(null);
        this.view.set(null);
        return;
      }
      const event = await this.events.current(groupId);
      this.event.set(event);
      this.view.set(event ? await this.settlements.get(event.id) : null);
    } catch {
      this.errorMessage.set('No pudimos cargar la liquidación de cancha.');
    } finally {
      this.loading.set(false);
    }
  }

  protected requestFinalize(): void {
    if (this.view()?.canFinalize) this.confirmationOpen.set(true);
  }
  protected cancelFinalize(): void {
    this.confirmationOpen.set(false);
  }

  protected async finalize(): Promise<void> {
    const view = this.view();
    if (!view?.canFinalize || this.finalizing()) return;
    this.confirmationOpen.set(false);
    this.finalizing.set(true);
    this.errorMessage.set(null);
    try {
      this.view.set(await this.settlements.finalize(view.eventId));
      this.feedback.set('Liquidación de cancha generada.');
    } catch (error) {
      this.errorMessage.set(this.finalizeError(error));
    } finally {
      this.finalizing.set(false);
    }
  }

  protected unavailableCopy(reason: MatchSettlementUnavailableReason | null): string {
    if (reason === 'ATTENDANCE_NOT_RECORDED') return 'Primero registrá quiénes jugaron realmente.';
    if (reason === 'NO_ACTUAL_PLAYERS') return 'No hay jugadores reales para liquidar la cancha.';
    if (reason === 'INVALID_COURT_PRICE') return 'Falta definir el precio de la cancha.';
    if (reason === 'WRONG_LIFECYCLE')
      return 'La liquidación se genera cuando el miércoles pasa a liquidación.';
    return 'La liquidación todavía no está disponible.';
  }

  private finalizeError(error: unknown): string {
    if (error instanceof MatchSettlementOperationError) {
      if (error.operation === 'ATTENDANCE_NOT_RECORDED')
        return 'Primero registrá quiénes jugaron realmente.';
      if (error.operation === 'NO_ACTUAL_PLAYERS')
        return 'No hay jugadores reales para liquidar la cancha.';
      if (error.operation === 'INVALID_COURT_PRICE') return 'Falta definir el precio de la cancha.';
      if (error.operation === 'CLOSED') return 'Este miércoles ya está cerrado.';
      if (error.operation === 'PERMISSION')
        return 'No tenés permisos para generar esta liquidación.';
      if (error.operation === 'CONFLICT' || error.operation === 'ALREADY_FINALIZED')
        return 'La información del partido cambió. Actualizá e intentá nuevamente.';
    }
    return 'No pudimos generar la liquidación.';
  }
}
