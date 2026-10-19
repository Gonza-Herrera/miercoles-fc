import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { PageContainer } from '../../shared/layout';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { Avatar, Button, Card, EmptyState } from '../../shared/ui';
import { AttendanceManager } from '../attendance/components/attendance-manager/attendance-manager';
import { WeeklyEvent, eventDateLabel } from '../events/event.models';
import { EventService } from '../events/event.service';
import { GroupContextService } from '../groups/group-context.service';
import { GroupDetail, GroupMember } from '../groups/group.models';
import { GroupService } from '../groups/group.service';
import {
  DinnerPlanDraft,
  DinnerPlannedPurchase,
  DinnerPlanningOperationError,
  DinnerPlanningView,
  emptyDinnerPlanDraft,
} from './dinner-planning.models';
import { DinnerPlanningService } from './dinner-planning.service';
import { DinnerReality } from './components/dinner-reality/dinner-reality';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AttendanceManager, Avatar, Button, Card, DinnerReality, EmptyState, PageContainer],
  selector: 'app-dinner',
  styleUrl: './dinner.scss',
  templateUrl: './dinner.html',
})
export class Dinner implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);
  private readonly planning = inject(DinnerPlanningService);
  private readonly realtime = inject(RealtimeService, { optional: true });
  private unwatch: (() => void) | null = null;

  protected readonly currentEvent = signal<WeeklyEvent | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly view = signal<DinnerPlanningView | null>(null);
  protected readonly draft = signal<DinnerPlanDraft>(emptyDinnerPlanDraft(null));
  protected readonly editing = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly eventDateLabel = eventDateLabel;
  protected readonly eligibleOwners = computed<readonly GroupMember[]>(() =>
    (this.group()?.members ?? []).filter((member) => member.deactivatedAt === null),
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const summaries = await this.groups.list();
      const groupId =
        this.context.current()?.id ??
        summaries.find((group) => group.id === this.context.selectedGroupId())?.id ??
        summaries[0]?.id;
      if (!groupId) {
        this.group.set(null);
        this.currentEvent.set(null);
        this.view.set(null);
        return;
      }
      const [group, event] = await Promise.all([
        this.groups.get(groupId),
        this.events.current(groupId),
      ]);
      this.group.set(group);
      this.currentEvent.set(event);
      this.view.set(event ? await this.planning.get(event.id) : null);
      if (event && !this.unwatch) {
        this.unwatch = this.realtime?.watchEvent(event.id, () => void this.load(false)) ?? null;
        this.destroyRef.onDestroy(() => this.unwatch?.());
      }
    } catch {
      this.errorMessage.set('No pudimos cargar la planificación de la cena.');
    } finally {
      if (showLoading) this.loading.set(false);
    }
  }

  protected startEditing(): void {
    if (!this.view()?.canEdit) return;
    this.draft.set(emptyDinnerPlanDraft(this.view()?.plan ?? null));
    this.editing.set(true);
    this.feedback.set(null);
    this.errorMessage.set(null);
  }

  protected cancelEditing(): void {
    this.editing.set(false);
    this.draft.set(emptyDinnerPlanDraft(this.view()?.plan ?? null));
    this.errorMessage.set(null);
  }

  protected updateMenu(menu: string): void {
    this.draft.update((draft) => ({ ...draft, menu }));
  }

  protected updateOwner(groupMemberId: string): void {
    this.draft.update((draft) => ({
      ...draft,
      purchaseOwnerGroupMemberId: groupMemberId || null,
    }));
  }

  protected addPurchase(): void {
    this.draft.update((draft) => ({
      ...draft,
      plannedPurchases: [
        ...draft.plannedPurchases,
        {
          id: `draft-${crypto.randomUUID()}`,
          name: '',
          sortOrder: draft.plannedPurchases.length,
        },
      ],
    }));
  }

  protected updatePurchase(id: string, name: string): void {
    this.draft.update((draft) => ({
      ...draft,
      plannedPurchases: draft.plannedPurchases.map((item) =>
        item.id === id ? { ...item, name } : item,
      ),
    }));
  }

  protected removePurchase(id: string): void {
    this.draft.update((draft) => ({
      ...draft,
      plannedPurchases: draft.plannedPurchases
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index })),
    }));
  }

  protected purchaseTrack(_: number, item: DinnerPlannedPurchase): string {
    return item.id;
  }

  protected async save(): Promise<void> {
    const event = this.currentEvent();
    const view = this.view();
    if (!event || !view?.canEdit || this.saving()) return;
    const draft = this.draft();
    if (
      draft.menu.trim().length > 500 ||
      draft.plannedPurchases.length > 30 ||
      draft.plannedPurchases.some((item) => !item.name.trim() || item.name.trim().length > 120)
    ) {
      this.errorMessage.set('Revisá el menú y las compras previstas antes de guardar.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const saved = await this.planning.save(event.id, draft, view.plan?.updatedAt ?? null);
      this.view.set(saved);
      this.draft.set(emptyDinnerPlanDraft(saved.plan));
      this.editing.set(false);
      this.feedback.set('Planificación guardada.');
    } catch (error) {
      this.errorMessage.set(this.saveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private saveError(error: unknown): string {
    if (!(error instanceof DinnerPlanningOperationError)) {
      return 'No pudimos guardar la planificación.';
    }
    if (error.operation === 'OWNER_INVALID') {
      return 'El encargado seleccionado ya no está disponible.';
    }
    if (error.operation === 'READ_ONLY') {
      return 'Este miércoles ya no permite modificar la cena.';
    }
    if (error.operation === 'CONFLICT') {
      return 'La planificación cambió. Actualizá e intentá nuevamente.';
    }
    if (error.operation === 'VALIDATION') {
      return 'Revisá el menú y las compras previstas antes de guardar.';
    }
    if (error.operation === 'PERMISSION') {
      return 'No tenés permisos para modificar esta planificación.';
    }
    return 'No pudimos guardar la planificación.';
  }
}
