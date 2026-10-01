import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Button, Card } from '../../../../shared/ui';
import { EventStatus } from '../../../events/event.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, RouterLink],
  selector: 'app-dinner-summary-card',
  styleUrl: './dinner-summary-card.scss',
  templateUrl: './dinner-summary-card.html',
})
export class DinnerSummaryCard {
  readonly confirmedCount = input.required<number>();
  readonly dataAvailable = input(true);
  readonly eventStatus = input.required<EventStatus>();
  readonly menu = input<string | null>(null);
}
