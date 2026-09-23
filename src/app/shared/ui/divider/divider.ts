import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-divider',
  styleUrl: './divider.scss',
  template: '<hr class="divider" />',
})
export class Divider {}
