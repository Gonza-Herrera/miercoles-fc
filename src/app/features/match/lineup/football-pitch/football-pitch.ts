import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Avatar } from '../../../../shared/ui';
import {
  TeamLineup,
  TeamLineupPlayer,
  calculateLineupSlots,
  playerLabel,
} from '../team-lineup.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar],
  selector: 'app-football-pitch',
  styleUrl: './football-pitch.scss',
  templateUrl: './football-pitch.html',
})
export class FootballPitch {
  readonly team = input.required<TeamLineup>();
  readonly selectable = input(false);
  readonly selectedPlayerId = input<string | null>(null);
  readonly playerSelected = output<TeamLineupPlayer>();

  protected readonly markers = computed(() => {
    const players = this.team().players;
    const slots = calculateLineupSlots(players.length);
    return players.map((player, index) => ({ player, slot: slots[index] }));
  });
  protected readonly playerLabel = playerLabel;

  protected select(player: TeamLineupPlayer): void {
    if (this.selectable()) this.playerSelected.emit(player);
  }
}
