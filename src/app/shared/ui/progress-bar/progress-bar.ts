import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-progress-bar',
  styleUrl: './progress-bar.scss',
  templateUrl: './progress-bar.html',
})
export class ProgressBar {
  readonly label = input.required<string>();
  readonly value = input(0);
  readonly max = input(100);
  readonly valueText = input<string>();

  protected readonly safeMax = computed(() => {
    const maximum = this.max();
    return Number.isFinite(maximum) && maximum > 0 ? maximum : 100;
  });

  protected readonly safeValue = computed(() => {
    const current = this.value();
    return Number.isFinite(current) ? Math.min(Math.max(current, 0), this.safeMax()) : 0;
  });

  protected readonly percentage = computed(() => (this.safeValue() / this.safeMax()) * 100);
  protected readonly accessibleValueText = computed(
    () => this.valueText() ?? `${this.safeValue()} of ${this.safeMax()}`,
  );
}
