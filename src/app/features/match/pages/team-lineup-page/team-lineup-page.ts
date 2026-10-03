import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Avatar, Button, Card, ConfirmDialog } from '../../../../shared/ui';
import { FootballPitch } from '../../lineup/football-pitch/football-pitch';
import {
  TeamLineup,
  TeamLineupPlayer,
  TeamLineupState,
  playerLabel,
} from '../../lineup/team-lineup.models';
import { TeamLineupOperationError, TeamLineupService } from '../../lineup/team-lineup.service';

interface SwapSelection {
  readonly player: TeamLineupPlayer;
  readonly team: TeamLineup;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button, Card, ConfirmDialog, FootballPitch, PageContainer, RouterLink],
  selector: 'app-team-lineup-page',
  styleUrl: './team-lineup-page.scss',
  templateUrl: './team-lineup-page.html',
})
export class TeamLineupPage implements OnInit {
  private readonly lineupService = inject(TeamLineupService);
  private readonly route = inject(ActivatedRoute);
  private touchStartX: number | null = null;

  protected readonly eventId = this.route.snapshot.paramMap.get('eventId')!;
  protected readonly state = signal<TeamLineupState | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly selectedTeamIndex = signal(0);
  protected readonly editing = signal(false);
  protected readonly swapping = signal(false);
  protected readonly firstSelection = signal<SwapSelection | null>(null);
  protected readonly pendingSwap = signal<{ first: SwapSelection; second: SwapSelection } | null>(
    null,
  );
  protected readonly activeTeam = computed(() => {
    const teams = this.state()?.teams ?? [];
    return teams[this.selectedTeamIndex()] ?? null;
  });
  protected readonly playerLabel = playerLabel;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const state = await this.lineupService.get(this.eventId);
      this.state.set(state);
      this.selectedTeamIndex.update((index) =>
        Math.min(index, Math.max(0, state.teams.length - 1)),
      );
    } catch {
      this.errorMessage.set('No pudimos cargar los equipos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected selectTeam(index: number): void {
    this.selectedTeamIndex.set(index);
  }

  protected enterEdit(): void {
    if (!this.state()?.canEdit) return;
    this.editing.set(true);
    this.feedback.set('Elegí un jugador y después otro de un equipo diferente.');
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.firstSelection.set(null);
    this.pendingSwap.set(null);
    this.feedback.set(null);
  }

  protected selectPlayer(player: TeamLineupPlayer): void {
    const team = this.activeTeam();
    if (!this.editing() || !team || this.swapping()) return;
    const first = this.firstSelection();
    if (!first) {
      this.firstSelection.set({ player, team });
      this.feedback.set(`${playerLabel(player)} seleccionado. Elegí otro equipo y jugador.`);
      return;
    }
    if (first.player.eventParticipantId === player.eventParticipantId) {
      this.firstSelection.set(null);
      this.feedback.set('Selección cancelada. Elegí un jugador.');
      return;
    }
    if (first.team.teamId === team.teamId) {
      this.errorMessage.set('Elegí un jugador de otro equipo.');
      return;
    }
    this.errorMessage.set(null);
    this.pendingSwap.set({ first, second: { player, team } });
  }

  protected async confirmSwap(): Promise<void> {
    const swap = this.pendingSwap();
    if (!swap || this.swapping()) return;
    this.pendingSwap.set(null);
    this.swapping.set(true);
    this.errorMessage.set(null);
    try {
      await this.lineupService.swap(
        this.eventId,
        swap.first.player.eventParticipantId,
        swap.second.player.eventParticipantId,
      );
      await this.load();
      this.editing.set(false);
      this.firstSelection.set(null);
      this.feedback.set(
        `${playerLabel(swap.first.player)} y ${playerLabel(swap.second.player)} fueron intercambiados.`,
      );
    } catch (error) {
      const message = this.swapError(error);
      await this.load();
      this.errorMessage.set(message);
      this.firstSelection.set(null);
    } finally {
      this.swapping.set(false);
    }
  }

  protected swapDescription(): string {
    const swap = this.pendingSwap();
    if (!swap) return '';
    return `${playerLabel(swap.first.player)} · ${swap.first.team.name} ↕ ${playerLabel(swap.second.player)} · ${swap.second.team.name}`;
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? null;
  }

  protected onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const delta = endX - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(delta) < 48) return;
    const count = this.state()?.teams.length ?? 0;
    if (delta < 0 && this.selectedTeamIndex() < count - 1) {
      this.selectedTeamIndex.update((index) => index + 1);
    } else if (delta > 0 && this.selectedTeamIndex() > 0) {
      this.selectedTeamIndex.update((index) => index - 1);
    }
  }

  private swapError(error: unknown): string {
    if (!(error instanceof TeamLineupOperationError)) {
      return 'No pudimos intercambiar los jugadores.';
    }
    if (error.operation === 'CONFLICT') {
      return 'Los equipos cambiaron. Actualizá e intentá nuevamente.';
    }
    if (error.operation === 'READ_ONLY') return 'Este miércoles ya no permite editar equipos.';
    if (error.operation === 'PERMISSION') return 'No tenés permisos para editar estos equipos.';
    return 'No pudimos intercambiar los jugadores.';
  }
}
