import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PageContainer } from '../../shared/layout';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState } from '../../shared/ui';
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
import {
  EventPaymentsView,
  PaymentCategory,
  PaymentObligation,
  PaymentOperationError,
  PaymentStatus,
} from './payment.models';
import { PaymentService } from './payment.service';

interface PaymentConfirmation {
  readonly category: PaymentCategory;
  readonly obligation: PaymentObligation;
  readonly targetStatus: PaymentStatus;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, PageContainer],
  selector: 'app-payments',
  styleUrl: './payments.scss',
  templateUrl: './payments.html',
})
export class Payments implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);
  private readonly dinnerSettlements = inject(DinnerSettlementService);
  private readonly matchSettlements = inject(MatchSettlementService);
  private readonly payments = inject(PaymentService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly realtime = inject(RealtimeService, { optional: true });
  private unwatch: (() => void) | null = null;
  private watchedEventId: string | null = null;
  private request = 0;

  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly matchView = signal<MatchSettlementView | null>(null);
  protected readonly dinnerView = signal<DinnerSettlementView | null>(null);
  protected readonly paymentsView = signal<EventPaymentsView | null>(null);
  protected readonly loading = signal(true);
  protected readonly finalizing = signal<'DINNER' | 'MATCH' | null>(null);
  protected readonly confirmationOpen = signal<'DINNER' | 'MATCH' | null>(null);
  protected readonly paymentConfirmation = signal<PaymentConfirmation | null>(null);
  protected readonly updatingObligationId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly eventDateLabel = eventDateLabel;
  protected readonly formatMoney = formatMoneyMinor;

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
    try {
      const requestedEventId = this.route?.snapshot.queryParamMap.get('eventId');
      let event: WeeklyEvent | null;
      let requestedGroup: Awaited<ReturnType<GroupService['get']>> | null = null;
      if (requestedEventId) {
        event = await this.events.get(requestedEventId);
        requestedGroup = await this.groups.get(event.groupId);
      } else {
        const summaries = await this.groups.list();
        const groupId =
          this.context.current()?.id ??
          summaries.find((group) => group.id === this.context.selectedGroupId())?.id ??
          summaries[0]?.id;
        event = groupId ? await this.events.current(groupId) : null;
      }
      if (request !== this.request) return;
      if (requestedGroup) this.context.set(requestedGroup);
      this.event.set(event);
      if (!event) {
        this.matchView.set(null);
        this.dinnerView.set(null);
        this.paymentsView.set(null);
        return;
      }
      const [matchView, dinnerView, paymentsView] = await Promise.all([
        this.matchSettlements.get(event.id),
        this.dinnerSettlements.get(event.id),
        this.payments.get(event.id),
      ]);
      if (request !== this.request) return;
      this.matchView.set(matchView);
      this.dinnerView.set(dinnerView);
      this.paymentsView.set(paymentsView);
      this.watch(event.id);
    } catch {
      if (request === this.request) {
        this.event.set(null);
        this.matchView.set(null);
        this.dinnerView.set(null);
        this.paymentsView.set(null);
        this.errorMessage.set('No pudimos cargar las liquidaciones del miércoles solicitado.');
      }
    } finally {
      if (showLoading && request === this.request) this.loading.set(false);
    }
  }

  private watch(eventId: string): void {
    if (this.watchedEventId === eventId) return;
    this.unwatch?.();
    this.watchedEventId = eventId;
    this.unwatch = this.realtime?.watchEvent(eventId, () => void this.load(false)) ?? null;
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.unwatch?.());
  }

  protected requestFinalize(kind: 'DINNER' | 'MATCH'): void {
    const canFinalize =
      kind === 'MATCH' ? this.matchView()?.canFinalize : this.dinnerView()?.canFinalize;
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
      this.paymentsView.set(await this.payments.get(view.eventId));
    } catch (error) {
      this.errorMessage.set(
        kind === 'MATCH' ? this.matchFinalizeError(error) : this.dinnerFinalizeError(error),
      );
    } finally {
      this.finalizing.set(null);
    }
  }

  protected requestPaymentChange(category: PaymentCategory, obligation: PaymentObligation): void {
    if (!this.paymentsView()?.canManage || this.updatingObligationId()) return;
    this.paymentConfirmation.set({
      category,
      obligation,
      targetStatus: obligation.status === 'PAID' ? 'PENDING' : 'PAID',
    });
  }

  protected cancelPaymentChange(): void {
    this.paymentConfirmation.set(null);
  }

  protected async confirmPaymentChange(): Promise<void> {
    const confirmation = this.paymentConfirmation();
    if (!confirmation || this.updatingObligationId()) return;
    this.paymentConfirmation.set(null);
    this.updatingObligationId.set(confirmation.obligation.id);
    this.errorMessage.set(null);
    try {
      this.paymentsView.set(
        await this.payments.setStatus(
          confirmation.category,
          confirmation.obligation.id,
          confirmation.targetStatus,
          confirmation.obligation.updatedAt,
        ),
      );
      this.feedback.set(
        confirmation.targetStatus === 'PAID'
          ? `Pago de ${confirmation.obligation.displayName} registrado.`
          : `Pago de ${confirmation.obligation.displayName} corregido a pendiente.`,
      );
    } catch (error) {
      this.errorMessage.set(this.paymentError(error));
      await this.reloadPayments();
    } finally {
      this.updatingObligationId.set(null);
    }
  }

  protected paymentConfirmationDescription(confirmation: PaymentConfirmation): string {
    const action =
      confirmation.targetStatus === 'PAID' ? 'registrar como pagado' : 'volver a pendiente';
    return `${confirmation.obligation.displayName}: ${this.formatMoney(
      confirmation.obligation.amountMinor,
      this.paymentsView()?.currencyCode ?? 'ARS',
    )}. Se va a ${action} solo esta obligación.`;
  }

  private async reloadPayments(): Promise<void> {
    const eventId = this.event()?.id;
    if (!eventId) return;
    try {
      this.paymentsView.set(await this.payments.get(eventId));
    } catch {
      // Keep the last authoritative view and offer the explicit page retry action.
    }
  }

  private paymentError(error: unknown): string {
    if (error instanceof PaymentOperationError) {
      if (error.operation === 'CLOSED')
        return 'Este miércoles ya está cerrado y sus pagos son de solo lectura.';
      if (error.operation === 'WRONG_LIFECYCLE')
        return 'Los pagos solo pueden modificarse durante la liquidación.';
      if (error.operation === 'CONFLICT')
        return 'El estado de este pago cambió. Actualizamos la información para que intentes nuevamente.';
      if (error.operation === 'PERMISSION') return 'Solo un administrador puede modificar pagos.';
      if (error.operation === 'NOT_FOUND') return 'La obligación ya no está disponible.';
    }
    return 'No pudimos actualizar el pago. La información fue actualizada.';
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
    if (reason === 'INVALID_EXPENSE_DATA')
      return 'Los gastos reales no permiten generar una liquidación válida.';
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
