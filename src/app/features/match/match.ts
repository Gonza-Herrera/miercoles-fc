import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CurrentAttendancePage } from '../attendance';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrentAttendancePage],
  selector: 'app-match',
  templateUrl: './match.html',
})
export class Match {}
