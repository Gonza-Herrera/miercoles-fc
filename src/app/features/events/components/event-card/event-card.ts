import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Badge, Card } from '../../../../shared/ui';
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_VARIANTS,
  WeeklyEvent,
  eventTime,
  eventTitle,
  formatMoneyMinor,
} from '../../event.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Card, RouterLink],
  selector: 'app-event-card',
  styleUrl: './event-card.scss',
  templateUrl: './event-card.html',
})
export class EventCard {
  readonly event = input.required<WeeklyEvent>();
  readonly linked = input(true);

  protected readonly statusLabels = EVENT_STATUS_LABELS;
  protected readonly statusVariants = EVENT_STATUS_VARIANTS;
  protected readonly eventTime = eventTime;
  protected readonly eventTitle = eventTitle;
  protected readonly formatMoneyMinor = formatMoneyMinor;
}
