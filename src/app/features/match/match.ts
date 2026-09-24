import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageContainer } from '../../shared/layout';
import { Card, EmptyState } from '../../shared/ui';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, EmptyState, PageContainer],
  selector: 'app-match',
  templateUrl: './match.html',
})
export class Match {}
