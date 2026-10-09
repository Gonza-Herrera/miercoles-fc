import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { Avatar, Badge, Button, Card, ConfirmDialog } from '../../../../shared/ui';
import { formatMoneyMinor, parseCourtPriceToMinor } from '../../../events/event.models';
import {
  DinnerExpense,
  DinnerRealityOperationError,
  DinnerRealityParticipant,
  DinnerRealityView,
  dinnerExpenseTotal,
  dinnerParticipantKey,
} from '../../dinner-reality.models';
import { DinnerRealityService } from '../../dinner-reality.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, ConfirmDialog],
  selector: 'app-dinner-reality',
  styleUrls: ['./dinner-reality.scss', './dinner-expenses.scss'],
  templateUrl: './dinner-reality.html',
})
export class DinnerReality implements OnInit {
  readonly eventId = input.required<string>();

  private readonly realityService = inject(DinnerRealityService);

  protected readonly view = signal<DinnerRealityView | null>(null);
  protected readonly selectedKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly attendanceSaving = signal(false);
  protected readonly expenseSaving = signal(false);
  protected readonly feedback = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly expenseEditing = signal<DinnerExpense | 'new' | null>(null);
  protected readonly expenseDescription = signal('');
  protected readonly expenseAmount = signal('');
  protected readonly expenseValidation = signal<string | null>(null);
  protected readonly expenseToDelete = signal<DinnerExpense | null>(null);

  protected readonly localDinerCount = computed(() => this.selectedKeys().size);
  protected readonly computedExpenseTotal = computed(() =>
    dinnerExpenseTotal(this.view()?.expenses ?? []),
  );
  protected readonly attendanceDirty = computed(() => {
    const view = this.view();
    if (!view) return false;
    const persisted = new Set(
      view.participants
        .filter((participant) => participant.actualDinnerAttendance === 'YES')
        .map(dinnerParticipantKey),
    );
    const selected = this.selectedKeys();
    return (
      !view.attendanceRecorded ||
      persisted.size !== selected.size ||
      [...persisted].some((key) => !selected.has(key))
    );
  });

  protected readonly formatMoney = formatMoneyMinor;
  protected readonly participantKey = dinnerParticipantKey;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.applyAuthoritative(await this.realityService.get(this.eventId()));
    } catch {
      this.errorMessage.set('No pudimos cargar la realidad de la cena.');
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(participant: DinnerRealityParticipant): void {
    if (!this.view()?.canEdit || this.attendanceSaving()) return;
    const key = dinnerParticipantKey(participant);
    this.selectedKeys.update((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    this.feedback.set(null);
  }

  protected async saveAttendance(): Promise<void> {
    const view = this.view();
    if (!view?.canEdit || this.attendanceSaving()) return;
    this.attendanceSaving.set(true);
    this.errorMessage.set(null);
    try {
      const selected = this.selectedKeys();
      const saved = await this.realityService.saveAttendance(
        view.eventId,
        view.participants.map((participant) => ({
          attended: selected.has(dinnerParticipantKey(participant)),
          groupMemberId: participant.groupMemberId,
          participantId: participant.participantId,
        })),
        view.attendanceRecordedAt,
      );
      this.applyAuthoritative(saved);
      this.feedback.set('Asistencia guardada.');
    } catch (error) {
      this.errorMessage.set(this.attendanceError(error));
    } finally {
      this.attendanceSaving.set(false);
    }
  }

  protected openNewExpense(): void {
    if (!this.view()?.canEdit) return;
    this.expenseEditing.set('new');
    this.expenseDescription.set('');
    this.expenseAmount.set('');
    this.expenseValidation.set(null);
    this.feedback.set(null);
  }

  protected openEditExpense(expense: DinnerExpense): void {
    if (!this.view()?.canEdit) return;
    this.expenseEditing.set(expense);
    this.expenseDescription.set(expense.description);
    this.expenseAmount.set(this.amountForInput(expense.amountMinor));
    this.expenseValidation.set(null);
    this.feedback.set(null);
  }

  protected cancelExpense(): void {
    this.expenseEditing.set(null);
    this.expenseValidation.set(null);
  }

  protected updateExpenseDescription(value: string): void {
    this.expenseDescription.set(value);
    this.expenseValidation.set(null);
  }

  protected updateExpenseAmount(value: string): void {
    this.expenseAmount.set(value);
    this.expenseValidation.set(null);
  }

  protected async saveExpense(): Promise<void> {
    const view = this.view();
    const editing = this.expenseEditing();
    if (!view?.canEdit || !editing || this.expenseSaving()) return;
    const description = this.expenseDescription().trim();
    const amountMinor = parseCourtPriceToMinor(this.expenseAmount());
    if (!description || description.length > 120) {
      this.expenseValidation.set('Ingresá un concepto de hasta 120 caracteres.');
      return;
    }
    if (amountMinor === null || amountMinor <= 0) {
      this.expenseValidation.set('El importe debe ser mayor a cero.');
      return;
    }

    this.expenseSaving.set(true);
    this.errorMessage.set(null);
    try {
      const input = { amountMinor, description };
      const saved =
        editing === 'new'
          ? await this.realityService.createExpense(view.eventId, input)
          : await this.realityService.updateExpense(view.eventId, editing, input);
      this.applyAuthoritative(saved, false);
      this.expenseEditing.set(null);
      this.feedback.set(editing === 'new' ? 'Gasto agregado.' : 'Gasto actualizado.');
    } catch (error) {
      this.errorMessage.set(this.expenseError(error, 'guardar'));
    } finally {
      this.expenseSaving.set(false);
    }
  }

  protected requestDelete(expense: DinnerExpense): void {
    if (this.view()?.canEdit) this.expenseToDelete.set(expense);
  }

  protected cancelDelete(): void {
    this.expenseToDelete.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const view = this.view();
    const expense = this.expenseToDelete();
    if (!view?.canEdit || !expense || this.expenseSaving()) return;
    this.expenseSaving.set(true);
    this.errorMessage.set(null);
    try {
      const saved = await this.realityService.deleteExpense(view.eventId, expense);
      this.applyAuthoritative(saved, false);
      this.expenseToDelete.set(null);
      this.feedback.set('Gasto eliminado.');
    } catch (error) {
      this.expenseToDelete.set(null);
      this.errorMessage.set(this.expenseError(error, 'eliminar'));
    } finally {
      this.expenseSaving.set(false);
    }
  }

  protected confirmationLabel(participant: DinnerRealityParticipant): string {
    if (participant.dinnerConfirmation === 'YES') return 'Había confirmado';
    if (participant.dinnerConfirmation === 'NO') return 'Había dicho que no';
    return 'No había respondido';
  }

  private applyAuthoritative(view: DinnerRealityView, resetAttendance = true): void {
    this.view.set(view);
    if (resetAttendance) {
      this.selectedKeys.set(
        new Set(
          view.participants
            .filter((participant) =>
              view.attendanceRecorded
                ? participant.actualDinnerAttendance === 'YES'
                : participant.dinnerConfirmation === 'YES',
            )
            .map(dinnerParticipantKey),
        ),
      );
    }
  }

  private amountForInput(amountMinor: number): string {
    const whole = Math.trunc(amountMinor / 100);
    const cents = amountMinor % 100;
    return cents ? `${whole},${String(cents).padStart(2, '0')}` : String(whole);
  }

  private attendanceError(error: unknown): string {
    if (error instanceof DinnerRealityOperationError) {
      if (error.operation === 'ATTENDANCE_CONFLICT') {
        return 'La asistencia cambió. Actualizá e intentá nuevamente.';
      }
      if (error.operation === 'PERMISSION') {
        return 'No tenés permisos para registrar la asistencia de la cena.';
      }
      if (error.operation === 'READ_ONLY') {
        return 'Este miércoles no permite registrar quiénes comieron.';
      }
      if (error.operation === 'SETTLEMENT_LOCKED') {
        return 'La cena ya fue liquidada y su asistencia no puede modificarse.';
      }
      if (error.operation === 'ATTENDANCE_INVALID') {
        return 'La lista cambió. Actualizá e intentá nuevamente.';
      }
    }
    return 'No pudimos guardar quiénes comieron.';
  }

  private expenseError(error: unknown, action: 'eliminar' | 'guardar'): string {
    if (error instanceof DinnerRealityOperationError) {
      if (error.operation === 'CONFLICT' || error.operation === 'NOT_FOUND') {
        return 'Este gasto cambió. Actualizá e intentá nuevamente.';
      }
      if (error.operation === 'PERMISSION') return 'No tenés permisos para modificar gastos.';
      if (error.operation === 'READ_ONLY') return 'Este miércoles ya no permite modificar gastos.';
      if (error.operation === 'SETTLEMENT_LOCKED') {
        return 'La cena ya fue liquidada y sus gastos no pueden modificarse.';
      }
      if (error.operation === 'VALIDATION') return 'Revisá el concepto y el importe.';
    }
    return action === 'eliminar' ? 'No pudimos eliminar el gasto.' : 'No pudimos guardar el gasto.';
  }
}
