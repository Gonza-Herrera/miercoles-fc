import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Badge, Button, Card, EmptyState } from '../../../../shared/ui';
import { GroupContextService } from '../../../groups/group-context.service';
import { GroupDetail } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { HistoryEventItem, HistoryCursor, historyDateParts } from '../../history.models';
import { HistoryService } from '../../history.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button, Card, EmptyState, PageContainer, RouterLink],
  selector: 'app-history-page',
  styleUrl: './history-page.scss',
  templateUrl: './history-page.html',
})
export class HistoryPage implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly groups = inject(GroupService);
  private readonly history = inject(HistoryService);
  private readonly route = inject(ActivatedRoute);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly groupId = this.route.snapshot.paramMap.get('groupId')!;
  protected readonly hasMore = signal(false);
  protected readonly items = signal<readonly HistoryEventItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  private readonly cursor = signal<HistoryCursor | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.items.set([]);
    this.cursor.set(null);
    try {
      const [group, page] = await Promise.all([
        this.groups.get(this.groupId),
        this.history.list(this.groupId, null),
      ]);
      this.group.set(group);
      this.context.set(group);
      this.applyPage(page, false);
    } catch {
      this.errorMessage.set('No pudimos cargar el historial.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    try {
      this.applyPage(await this.history.list(this.groupId, this.cursor()), true);
    } catch {
      this.errorMessage.set('No pudimos cargar más miércoles.');
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected date(item: HistoryEventItem): { day: string; month: string } {
    return historyDateParts(item.startsAt);
  }

  private applyPage(page: Awaited<ReturnType<HistoryService['list']>>, append: boolean): void {
    const next = append ? [...this.items(), ...page.items] : page.items;
    this.items.set(next);
    this.cursor.set(page.nextCursor);
    this.hasMore.set(page.hasMore);
  }
}
