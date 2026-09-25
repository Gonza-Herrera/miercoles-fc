import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Avatar, Button, Card, EmptyState } from '../../../../shared/ui';
import { GroupContextService } from '../../group-context.service';
import { GroupSummary } from '../../group.models';
import { GroupService } from '../../group.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button, Card, EmptyState, PageContainer, RouterLink],
  selector: 'app-group-list-page',
  styleUrl: '../../groups.shared.scss',
  templateUrl: './group-list-page.html',
})
export class GroupListPage implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly groupsService = inject(GroupService);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly groups = signal<readonly GroupSummary[]>([]);
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    this.context.clear();
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.groups.set(await this.groupsService.list());
    } catch {
      this.errorMessage.set('No pudimos cargar tus grupos. Intentá nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
