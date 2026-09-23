import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';
export type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.button-host--full]': 'fullWidth()',
  },
  selector: 'app-button',
  styleUrl: './button.scss',
  templateUrl: './button.html',
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('medium');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly fullWidth = input(false, { transform: booleanAttribute });
}
