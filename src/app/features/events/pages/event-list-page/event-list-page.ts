import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Button, Card, EmptyState } from '../../../../shared/ui';
import { GroupContextService } from '../../../groups/group-context.service';
import { GroupDetail } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { EventCard } from '../../components/event-card/event-card';
import { WeeklyEvent } from '../../event.models';
import { EventService } from '../../event.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, EmptyState, EventCard, PageContainer, RouterLink],
  selector: 'app-event-list-page',
  styleUrl: '../../events.shared.scss',
  templateUrl: './event-list-page.html',
})
export class EventListPage implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly events = inject(EventService);
  private readonly groups = inject(GroupService);
  private readonly route = inject(ActivatedRoute);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly eventList = signal<readonly WeeklyEvent[]>([]);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly groupId = this.route.snapshot.paramMap.get('groupId')!;
  protected readonly isAdmin = computed(() => this.group()?.membership.role === 'ADMIN');
  protected readonly activeEvents = computed(() =>
    this.eventList().filter((event) => event.status !== 'CLOSED'),
  );
  protected readonly previousEvents = computed(() =>
    this.eventList().filter((event) => event.status === 'CLOSED'),
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [group, events] = await Promise.all([
        this.groups.get(this.groupId),
        this.events.list(this.groupId),
      ]);
      this.group.set(group);
      this.context.set(group);
      this.eventList.set(events);
    } catch {
      this.errorMessage.set('No pudimos cargar los miércoles del grupo.');
    } finally {
      this.loading.set(false);
    }
  }
}
