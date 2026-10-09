import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { PageContainer } from '../../shared/layout';
import { Badge, Button, Card, ConfirmDialog, EmptyState } from '../../shared/ui';
import { WeeklyEvent, eventDateLabel, formatMoneyMinor } from '../events/event.models';
import { EventService } from '../events/event.service';
import { GroupContextService } from '../groups/group-context.service';
import { GroupService } from '../groups/group.service';
import {
  DinnerSettlementOperationError,
  DinnerSettlementUnavailableReason,
  DinnerSettlementView,
} from './dinner-settlement.models';
import { DinnerSettlementService } from './dinner-settlement.service';
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
  private readonly dinnerSettlements = inject(DinnerSettlementService);
  private readonly matchSettlements = inject(MatchSettlementService);

  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly matchView = signal<MatchSettlementView | null>(null);
  protected readonly dinnerView = signal<DinnerSettlementView | null>(null);
  protected readonly loading = signal(true);
  protected readonly finalizing = signal<'DINNER' | 'MATCH' | null>(null);
  protected readonly confirmationOpen = signal<'DINNER' | 'MATCH' | null>(null);
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
        this.matchView.set(null);
        this.dinnerView.set(null);
        return;
      }
      const event = await this.events.current(groupId);
      this.event.set(event);
      if (!event) {
        this.matchView.set(null);
        this.dinnerView.set(null);
        return;
      }
      const [matchView, dinnerView] = await Promise.all([
        this.matchSettlements.get(event.id),
        this.dinnerSettlements.get(event.id),
      ]);
      this.matchView.set(matchView);
      this.dinnerView.set(dinnerView);
    } catch {
      this.errorMessage.set('No pudimos cargar las liquidaciones.');
    } finally {
      this.loading.set(false);
    }
  }

  protected requestFinalize(kind: 'DINNER' | 'MATCH'): void {
    const canFinalize = kind === 'MATCH' ? this.matchView()?.canFinalize : this.dinnerView()?.canFinalize;
    if (canFinalize) this.confirmationOpen.set(kind);
  }
  protected cancelFinalize(): void {
    this.confirmationOpen.set(null);
  }

  protected async finalize(kind: 'DINNER' | 'MATCH'): Promise<void> {
    const view = kind === 'MATCH' ? this.matchView() : this.dinnerView();
    if (!view?.canFinalize || this.finalizing()) return;
    this.confirmationOpen.set(null);
    this.finalizing.set(kind);
    this.errorMessage.set(null);
    try {
      if (kind === 'MATCH') {
        this.matchView.set(await this.matchSettlements.finalize(view.eventId));
        this.feedback.set('Liquidación de cancha generada.');
      } else {
        this.dinnerView.set(await this.dinnerSettlements.finalize(view.eventId));
        this.feedback.set('Liquidación de cena generada.');
      }
    } catch (error) {
      this.errorMessage.set(
        kind === 'MATCH' ? this.matchFinalizeError(error) : this.dinnerFinalizeError(error),
      );
    } finally {
      this.finalizing.set(null);
    }
  }

  protected matchUnavailableCopy(reason: MatchSettlementUnavailableReason | null): string {
    if (reason === 'ATTENDANCE_NOT_RECORDED') return 'Primero registrá quiénes jugaron realmente.';
    if (reason === 'NO_ACTUAL_PLAYERS') return 'No hay jugadores reales para liquidar la cancha.';
    if (reason === 'INVALID_COURT_PRICE') return 'Falta definir el precio de la cancha.';
    if (reason === 'WRONG_LIFECYCLE')
      return 'La liquidación se genera cuando el miércoles pasa a liquidación.';
    return 'La liquidación todavía no está disponible.';
  }

  protected dinnerUnavailableCopy(reason: DinnerSettlementUnavailableReason | null): string {
    if (reason === 'ATTENDANCE_NOT_RECORDED') return 'Primero registrá quiénes cenaron realmente.';
    if (reason === 'NO_ACTUAL_DINERS') return 'No hay comensales reales para liquidar la cena.';
    if (reason === 'NO_DINNER_EXPENSES') return 'Todavía no hay gastos reales para liquidar.';
    if (reason === 'INVALID_EXPENSE_DATA') return 'Los gastos reales no permiten generar una liquidación válida.';
    if (reason === 'WRONG_LIFECYCLE')
      return 'La liquidación se genera cuando el miércoles pasa a liquidación.';
    return 'La liquidación todavía no está disponible.';
  }

  private matchFinalizeError(error: unknown): string {
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

  private dinnerFinalizeError(error: unknown): string {
    if (error instanceof DinnerSettlementOperationError) {
      if (error.operation === 'ATTENDANCE_NOT_RECORDED')
        return 'Primero registrá quiénes cenaron realmente.';
      if (error.operation === 'NO_ACTUAL_DINERS')
        return 'No hay comensales reales para liquidar la cena.';
      if (error.operation === 'NO_DINNER_EXPENSES')
        return 'Todavía no hay gastos reales para liquidar.';
      if (error.operation === 'INVALID_EXPENSE_DATA')
        return 'Los gastos cambiaron. Actualizá e intentá nuevamente.';
      if (error.operation === 'CLOSED') return 'Este miércoles ya está cerrado.';
      if (error.operation === 'PERMISSION')
        return 'No tenés permisos para generar esta liquidación.';
      if (error.operation === 'CONFLICT' || error.operation === 'ALREADY_FINALIZED')
        return 'La información de la cena cambió. Actualizá e intentá nuevamente.';
    }
    return 'No pudimos generar la liquidación de la cena.';
  }
}
