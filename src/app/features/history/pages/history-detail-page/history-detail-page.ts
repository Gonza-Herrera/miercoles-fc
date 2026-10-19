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
import { Avatar, Badge, Button, Card, EmptyState } from '../../../../shared/ui';
import { formatMoneyMinor } from '../../../events/event.models';
import { GroupContextService } from '../../../groups/group-context.service';
import { GroupDetail } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { HistoricalEventDetail, historicalEventDate } from '../../history.models';
import { HistoryService } from '../../history.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, EmptyState, PageContainer, RouterLink],
  selector: 'app-history-detail-page',
  styleUrl: './history-detail-page.scss',
  templateUrl: './history-detail-page.html',
})
export class HistoryDetailPage implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly groups = inject(GroupService);
  private readonly history = inject(HistoryService);
  private readonly realtime = inject(RealtimeService, { optional: true });
  private readonly route = inject(ActivatedRoute);
  protected readonly detail = signal<HistoricalEventDetail | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly eventId = this.route.snapshot.paramMap.get('eventId')!;
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly groupId = this.route.snapshot.paramMap.get('groupId')!;
  protected readonly loading = signal(true);
  protected readonly actualPlayers = computed(
    () => this.detail()?.attendance.filter((item) => item.actualFootball === 'YES') ?? [],
  );
  protected readonly actualDiners = computed(
    () => this.detail()?.attendance.filter((item) => item.actualDinner === 'YES') ?? [],
  );

  async ngOnInit(): Promise<void> {
    await this.load();
    const unwatch = this.realtime?.watchEvent(this.eventId, () => void this.load(false));
    if (unwatch) this.destroyRef.onDestroy(unwatch);
  }

  protected async load(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [group, detail] = await Promise.all([
        this.groups.get(this.groupId),
        this.history.getDetail(this.groupId, this.eventId),
      ]);
      this.group.set(group);
      this.context.set(group);
      this.detail.set(detail);
    } catch {
      this.errorMessage.set('No pudimos cargar este miércoles.');
    } finally {
      if (showLoading) this.loading.set(false);
    }
  }

  protected date(startsAt: string): string {
    return historicalEventDate(startsAt);
  }
  protected money(amountMinor: number, currencyCode: string): string {
    return formatMoneyMinor(amountMinor, currencyCode);
  }
}
