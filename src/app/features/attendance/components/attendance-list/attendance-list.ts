import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Avatar, Badge } from '../../../../shared/ui';
import { AttendanceMode, AttendanceRecord, attendanceResponseLabel } from '../../attendance.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge],
  selector: 'app-attendance-list',
  styleUrl: './attendance-list.scss',
  templateUrl: './attendance-list.html',
})
export class AttendanceList {
  readonly attendees = input.required<readonly AttendanceRecord[]>();
  readonly mode = input.required<AttendanceMode>();
  protected readonly responseLabel = attendanceResponseLabel;
}
