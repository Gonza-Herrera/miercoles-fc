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

import { PageContainer } from '../../../../shared/layout';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import { Badge, Button, Card, ConfirmDialog } from '../../../../shared/ui';
import {
  ClosureBlocker,
  ClosureOperationError,
  EventClosureSummary,
} from '../../event-closure.models';
import { EventClosureService } from '../../event-closure.service';
import { formatMoneyMinor } from '../../event.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button, Card, ConfirmDialog, PageContainer, RouterLink],
  selector: 'app-event-summary-page',
  styleUrl: './event-summary-page.scss',
  templateUrl: './event-summary-page.html',
})
export class EventSummaryPage implements OnInit {
  private readonly closure = inject(EventClosureService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly realtime = inject(RealtimeService, { optional: true });
  private readonly route = inject(ActivatedRoute);
  protected readonly closing = signal(false);
  protected readonly confirmClose = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly eventId = this.route.snapshot.paramMap.get('eventId')!;
  protected readonly loading = signal(true);
  protected readonly summary = signal<EventClosureSummary | null>(null);
  protected readonly isClosed = computed(() => this.summary()?.event.status === 'CLOSED');

  async ngOnInit(): Promise<void> {
    await this.load();
    const unwatch = this.realtime?.watchEvent(this.eventId, () => void this.load(false));
    if (unwatch) this.destroyRef.onDestroy(unwatch);
  }

  protected async load(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.summary.set(await this.closure.get(this.eventId));
    } catch (error) {
      this.errorMessage.set(this.errorFor(error));
    } finally {
      if (showLoading) this.loading.set(false);
    }
  }

  protected async close(): Promise<void> {
    if (this.closing()) return;
    this.confirmClose.set(false);
    this.closing.set(true);
    this.errorMessage.set(null);
    try {
      this.summary.set(await this.closure.close(this.eventId));
    } catch (error) {
      this.errorMessage.set(this.errorFor(error));
    } finally {
      this.closing.set(false);
    }
  }

  protected money(amountMinor: number, currencyCode: string): string {
    return formatMoneyMinor(amountMinor, currencyCode);
  }

  protected blockerCopy(blocker: ClosureBlocker | null): string | null {
    const messages: Record<ClosureBlocker, string> = {
      ATTENDANCE_NOT_RECORDED: 'Primero registrá la asistencia real del partido y de la cena.',
      DINNER_INVALID_NO_DINERS: 'Hay gastos sin comensales reales. Revisá la cena.',
      DINNER_SETTLEMENT_REQUIRED: 'Primero liquidá la cena.',
      MATCH_INVALID_NO_PLAYERS: 'Hay costo de cancha sin jugadores reales. Revisá el partido.',
      MATCH_SETTLEMENT_REQUIRED: 'Primero liquidá la cancha.',
      WRONG_LIFECYCLE: 'El evento debe estar en liquidación para poder finalizarlo.',
    };
    return blocker ? messages[blocker] : null;
  }

  private errorFor(error: unknown): string {
    if (!(error instanceof ClosureOperationError)) return 'No pudimos cargar el resumen.';
    if (error.operation === 'PERMISSION') return 'No tenés permisos para finalizar este evento.';
    if (error.operation === 'NOT_FOUND') return 'El evento no existe o no está disponible.';
    if (error.operation === 'CONFLICT')
      return 'La información cambió. Actualizá e intentá nuevamente.';
    if (error.operation === 'ALREADY_CLOSED') return 'Este miércoles ya fue finalizado.';
    if (error.operation === 'UPDATE') return 'No pudimos finalizar este miércoles.';
    return this.blockerCopy(error.operation as ClosureBlocker) ?? 'No pudimos cargar el resumen.';
  }
}
