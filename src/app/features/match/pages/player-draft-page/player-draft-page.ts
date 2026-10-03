import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Avatar, Badge, Button, Card, ConfirmDialog } from '../../../../shared/ui';
import {
  DraftPlayer,
  DraftRealtimeStatus,
  PlayerDraftState,
  currentDraftTeam,
  teamRemainingCapacity,
} from '../../draft/player-draft.models';
import { PlayerDraftOperationError, PlayerDraftService } from '../../draft/player-draft.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, ConfirmDialog, PageContainer, RouterLink],
  selector: 'app-player-draft-page',
  styleUrl: './player-draft-page.scss',
  templateUrl: './player-draft-page.html',
})
export class PlayerDraftPage implements OnInit, OnDestroy {
  private readonly draftService = inject(PlayerDraftService);
  private readonly route = inject(ActivatedRoute);
  private unsubscribe: (() => void) | null = null;
  private reloading = false;

  protected readonly eventId = this.route.snapshot.paramMap.get('eventId')!;
  protected readonly draft = signal<PlayerDraftState | null>(null);
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly selectedPlayer = signal<DraftPlayer | null>(null);
  protected readonly realtimeStatus = signal<DraftRealtimeStatus>('CONNECTING');
  protected readonly currentTeam = computed(() => {
    const draft = this.draft();
    return draft ? currentDraftTeam(draft) : null;
  });

  async ngOnInit(): Promise<void> {
    await this.load(true);
    this.unsubscribe = this.draftService.subscribe(
      this.eventId,
      () => void this.reloadFromRealtime(),
      (status) => this.realtimeStatus.set(status),
    );
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  protected remaining(team: PlayerDraftState['teams'][number]): number {
    return teamRemainingCapacity(team);
  }

  protected async load(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.draft.set(await this.draftService.get(this.eventId));
    } catch {
      this.errorMessage.set('No pudimos cargar el draft.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async start(): Promise<void> {
    if (this.acting()) return;
    this.acting.set(true);
    this.errorMessage.set(null);
    try {
      await this.draftService.start(this.eventId);
      await this.load(false);
      this.feedback.set('Draft iniciado.');
    } catch (error) {
      this.errorMessage.set(this.errorCopy(error, 'No pudimos comenzar el draft.'));
    } finally {
      this.acting.set(false);
    }
  }

  protected requestPick(player: DraftPlayer): void {
    if (!this.draft()?.canCurrentUserPick || this.acting()) return;
    this.selectedPlayer.set(player);
  }

  protected async confirmPick(): Promise<void> {
    const state = this.draft();
    const player = this.selectedPlayer();
    this.selectedPlayer.set(null);
    if (!state || !player || !state.canCurrentUserPick || this.acting()) return;

    this.acting.set(true);
    this.errorMessage.set(null);
    this.feedback.set(null);
    try {
      await this.draftService.pick(this.eventId, player.participantId, state.version);
      await this.load(false);
      this.feedback.set(`${player.displayName} fue agregado al equipo.`);
    } catch (error) {
      const errorMessage = this.errorCopy(error, 'No pudimos guardar la selección.');
      await this.load(false);
      this.errorMessage.set(errorMessage);
    } finally {
      this.acting.set(false);
    }
  }

  private async reloadFromRealtime(): Promise<void> {
    if (this.reloading || this.acting()) return;
    this.reloading = true;
    try {
      await this.load(false);
    } finally {
      this.reloading = false;
    }
  }

  private errorCopy(error: unknown, fallback: string): string {
    if (!(error instanceof PlayerDraftOperationError)) return fallback;
    if (error.operation === 'STALE') return 'La selección cambió. Actualizamos el draft.';
    if (error.operation === 'ALREADY_SELECTED') return 'Este jugador ya fue seleccionado.';
    if (error.operation === 'NOT_CURRENT_MANAGER') return 'Ya no es tu turno.';
    if (error.operation === 'TEAM_FULL') return 'El equipo ya está completo.';
    if (error.operation === 'READ_ONLY') {
      return 'Este miércoles ya no permite modificar los equipos.';
    }
    if (error.operation === 'NOT_READY')
      return 'La configuración de equipos todavía no está lista.';
    if (error.operation === 'PERMISSION') return 'No tenés permisos para realizar esta acción.';
    return fallback;
  }
}
