import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Button, Card } from '../../../../shared/ui';
import { EventStatus, formatMoneyMinor } from '../../../events/event.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, RouterLink],
  selector: 'app-match-summary-card',
  styleUrl: './match-summary-card.scss',
  templateUrl: './match-summary-card.html',
})
export class MatchSummaryCard {
  readonly confirmedCount = input.required<number>();
  readonly courtPriceMinor = input.required<number>();
  readonly currencyCode = input('ARS');
  readonly dataAvailable = input(true);
  readonly estimatedPerPlayerMinor = input<number | null>(null);
  readonly eventStatus = input.required<EventStatus>();

  protected readonly courtPrice = computed(() =>
    formatMoneyMinor(this.courtPriceMinor(), this.currencyCode()),
  );
  protected readonly estimate = computed(() => {
    const value = this.estimatedPerPlayerMinor();
    return value === null ? null : formatMoneyMinor(value, this.currencyCode());
  });
  protected readonly confirmationsOpen = computed(() => this.eventStatus() === 'OPEN');
  protected readonly planningComplete = computed(
    () => this.eventStatus() === 'SETTLEMENT' || this.eventStatus() === 'CLOSED',
  );
}
