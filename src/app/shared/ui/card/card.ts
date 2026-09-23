import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CardVariant = 'default' | 'elevated' | 'interactive';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-card',
  styleUrl: './card.scss',
  templateUrl: './card.html',
})
export class Card {
  readonly variant = input<CardVariant>('default');
}
