import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chip',
  styleUrl: './chip.scss',
  templateUrl: './chip.html',
})
export class Chip {
  readonly selected = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly selectedChange = output<boolean>();

  protected toggle(): void {
    this.selectedChange.emit(!this.selected());
  }
}
