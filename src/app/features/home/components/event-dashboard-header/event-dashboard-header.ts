import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Badge } from '../../../../shared/ui';
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_VARIANTS,
  WeeklyEvent,
  eventDateLabel,
  eventTime,
} from '../../../events/event.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge],
  selector: 'app-event-dashboard-header',
  styleUrl: './event-dashboard-header.scss',
  templateUrl: './event-dashboard-header.html',
})
export class EventDashboardHeader {
  readonly event = input.required<WeeklyEvent>();
  readonly groupName = input.required<string>();

  protected readonly dateLabel = computed(() => eventDateLabel(this.event().startsAt));
  protected readonly timeLabel = computed(() => eventTime(this.event().startsAt));
  protected readonly statusLabel = computed(() => EVENT_STATUS_LABELS[this.event().status]);
  protected readonly statusVariant = computed(() => EVENT_STATUS_VARIANTS[this.event().status]);
}
