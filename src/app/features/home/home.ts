import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageContainer } from '../../shared/layout';
import { Button, Card, EmptyState } from '../../shared/ui';
import { EventCard } from '../events/components/event-card/event-card';
import { WeeklyEvent } from '../events/event.models';
import { EventService } from '../events/event.service';
import { GroupContextService } from '../groups/group-context.service';
import { GroupDetail } from '../groups/group.models';
import { GroupService } from '../groups/group.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, EmptyState, EventCard, PageContainer, RouterLink],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);

  protected readonly currentEvent = signal<WeeklyEvent | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly isAdmin = computed(() => this.group()?.membership.role === 'ADMIN');

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const summaries = await this.groups.list();
      const selectedId =
        this.context.current()?.id ??
        summaries.find((group) => group.id === this.context.selectedGroupId())?.id ??
        summaries[0]?.id;
      if (!selectedId) {
        this.group.set(null);
        this.currentEvent.set(null);
        return;
      }
      const [group, event] = await Promise.all([
        this.groups.get(selectedId),
        this.events.current(selectedId),
      ]);
      this.group.set(group);
      this.currentEvent.set(event);
      this.context.set(group);
    } catch {
      this.errorMessage.set('No pudimos cargar tu próximo miércoles.');
    } finally {
      this.loading.set(false);
    }
  }
}
