import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-page-container',
  styleUrl: './page-container.scss',
  template: '<div class="page-container"><ng-content /></div>',
})
export class PageContainer {}
