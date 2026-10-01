import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AttendanceResponse } from '../../attendance.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-attendance-choice',
  styleUrl: './attendance-choice.scss',
  templateUrl: './attendance-choice.html',
})
export class AttendanceChoice {
  readonly accessibleLabel = input.required<string>();
  readonly disabled = input(false);
  readonly response = input.required<AttendanceResponse>();
  readonly responseChange = output<'NO' | 'YES'>();
  readonly saving = input(false);
}
