import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { Button } from '../button/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  selector: 'app-confirm-dialog',
  styleUrl: './confirm-dialog.scss',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog implements AfterViewInit {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private ready = false;

  constructor() {
    effect(() => {
      const shouldOpen = this.open();
      if (!this.ready) return;
      this.sync(shouldOpen);
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.sync(this.open());
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected confirm(): void {
    this.confirmed.emit();
  }

  private sync(shouldOpen: boolean): void {
    const dialog = this.dialog().nativeElement;
    if (shouldOpen && !dialog.open) dialog.showModal();
    if (!shouldOpen && dialog.open) dialog.close();
  }
}
