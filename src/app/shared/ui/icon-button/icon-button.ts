import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

import { ButtonSize, ButtonType } from '../button/button';

export type IconButtonVariant = 'primary' | 'neutral' | 'ghost';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-icon-button',
  styleUrl: './icon-button.scss',
  templateUrl: './icon-button.html',
})
export class IconButton {
  readonly ariaLabel = input.required<string>();
  readonly variant = input<IconButtonVariant>('neutral');
  readonly size = input<ButtonSize>('medium');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
}
