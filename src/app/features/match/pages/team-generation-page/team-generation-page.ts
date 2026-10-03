import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Avatar, Badge, Button, Card } from '../../../../shared/ui';
import { AttendanceService } from '../../../attendance/attendance.service';
import { GroupDetail } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { WeeklyEvent } from '../../../events/event.models';
import { EventService } from '../../../events/event.service';
import {
  GeneratedTeam,
  GeneratedTeamPlayer,
  generateRandomTeams,
  swapTeamPlayers,
} from '../../domain/random-team-generator';
import { calculateTeamFormation } from '../../domain/team-formation';
import { TeamService } from '../../team.service';

export type TeamGenerationMode = 'random' | 'manual';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, PageContainer, RouterLink],
  selector: 'app-team-generation-page',
  styleUrl: './team-generation-page.scss',
  templateUrl: './team-generation-page.html',
})
export class TeamGenerationPage implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly eventService = inject(EventService);
  private readonly groupService = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly teamService = inject(TeamService);

  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly mode = signal<TeamGenerationMode>('random');

  protected readonly availablePlayers = signal<readonly GeneratedTeamPlayer[]>([]);
  protected readonly teams = signal<readonly GeneratedTeam[]>([]);
  protected readonly selectedPlayerForSwap = signal<string | null>(null);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);

  protected readonly formationPlan = computed(() =>
    calculateTeamFormation(this.availablePlayers().length),
  );

  protected readonly isAdmin = computed(
    () => this.group()?.membership?.role === 'ADMIN',
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    const eventId = this.route.snapshot.paramMap.get('eventId');
    if (!eventId) {
      this.errorMessage.set('Evento no encontrado.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.saveError.set(null);

    try {
      const currentEvent = await this.eventService.get(eventId);
      if (!currentEvent) {
        this.errorMessage.set('El evento no existe.');
        return;
      }
      this.event.set(currentEvent);

      const groupDetail = await this.groupService.get(currentEvent.groupId);
      this.group.set(groupDetail);

      // Cargar asistencia para determinar la lista de jugadores disponibles
      const records = await this.attendanceService.list(eventId);

      // Filtrar jugadores: presentes reales ('YES') o confirmados ('YES')
      let candidates = records.filter(
        (r) => r.actualFootball === 'YES' || (r.actualFootball === 'UNSET' && r.footballResponse === 'YES'),
      );

      // Si nadie confirmó aún, usar la lista completa de miembros activos
      if (candidates.length === 0) {
        candidates = records.filter((r) => r.membershipActive || r.isGuest);
      }

      const players: GeneratedTeamPlayer[] = candidates.map((r) => ({
        avatarUrl: r.avatarUrl,
        displayName: r.displayName,
        groupMemberId: r.groupMemberId,
        id: r.participantId ?? r.groupMemberId ?? r.displayName,
        isGuest: r.isGuest,
        participantId: r.participantId,
      }));

      this.availablePlayers.set(players);

      // Cargar equipos guardados previamente si existen
      const existingTeams = await this.teamService.getTeams(eventId);
      if (existingTeams.length > 0) {
        this.teams.set(existingTeams);
      }
    } catch {
      this.errorMessage.set('No pudimos cargar la información del evento.');
    } finally {
      this.loading.set(false);
    }
  }

  protected generate(): void {
    const players = this.availablePlayers();
    if (players.length < 2) return;

    const newTeams = generateRandomTeams(players);
    this.teams.set(newTeams);
    this.selectedPlayerForSwap.set(null);
  }

  protected handlePlayerClick(playerId: string): void {
    const selected = this.selectedPlayerForSwap();
    if (!selected) {
      this.selectedPlayerForSwap.set(playerId);
      return;
    }

    if (selected === playerId) {
      this.selectedPlayerForSwap.set(null);
      return;
    }

    // Intercambio manual entre dos jugadores
    const updated = swapTeamPlayers(this.teams(), selected, playerId);
    this.teams.set(updated);
    this.selectedPlayerForSwap.set(null);
  }

  protected async save(): Promise<void> {
    const currentEvent = this.event();
    const currentTeams = this.teams();
    if (!currentEvent || currentTeams.length === 0 || this.saving()) return;

    this.saving.set(true);
    this.saveError.set(null);

    try {
      await this.teamService.saveTeams(currentEvent.id, currentTeams);
      await this.router.navigate(['/events', currentEvent.id], {
        state: {
          eventFeedback: `¡Equipos armados y guardados con éxito! (${currentTeams.length} equipos).`,
        },
      });
    } catch {
      this.saveError.set('No pudimos guardar los equipos. Intentá de nuevo.');
      this.saving.set(false);
    }
  }
}
