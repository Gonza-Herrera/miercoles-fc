import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Avatar, Badge, Button } from '../../../../../shared/ui';
import { ParticipantPresentation } from '../../models/participant.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button],
  selector: 'app-participant-row',
  styleUrl: './participant-row.scss',
  templateUrl: './participant-row.html',
})
export class ParticipantRow {
  readonly canManage = input(false);
  readonly editRequested = output<void>();
  readonly participant = input.required<ParticipantPresentation>();
  readonly removeRequested = output<void>();
}
