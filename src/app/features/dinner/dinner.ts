import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CurrentAttendancePage } from '../attendance';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrentAttendancePage],
  selector: 'app-dinner',
  templateUrl: './dinner.html',
})
export class Dinner {}
