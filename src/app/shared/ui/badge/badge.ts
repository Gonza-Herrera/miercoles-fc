import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-badge',
  styleUrl: './badge.scss',
  templateUrl: './badge.html',
})
export class Badge {
  readonly variant = input<BadgeVariant>('neutral');
}
