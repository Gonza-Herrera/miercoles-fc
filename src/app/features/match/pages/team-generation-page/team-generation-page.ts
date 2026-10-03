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
import { WeeklyEvent } from '../../../events/event.models';
import { EventService } from '../../../events/event.service';
import { GroupDetail, GroupMember } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import {
  GeneratedTeam,
  GeneratedTeamPlayer,
  generateRandomTeams,
  swapTeamPlayers,
} from '../../domain/random-team-generator';
import { calculateTeamFormation } from '../../domain/team-formation';
import {
  TeamFormationMode,
  TeamManagerAssignment,
  calculateTeamManagerCounts,
} from '../../managers/team-manager.models';
import { TeamManagerOperationError, TeamManagerService } from '../../managers/team-manager.service';
import { TeamService } from '../../team.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, PageContainer, RouterLink],
  selector: 'app-team-generation-page',
  styleUrls: ['./team-generation-page.scss', './team-managers.scss'],
  templateUrl: './team-generation-page.html',
})
export class TeamGenerationPage implements OnInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly eventService = inject(EventService);
  private readonly groupService = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly teamManagerService = inject(TeamManagerService);
  private readonly teamService = inject(TeamService);

  protected readonly event = signal<WeeklyEvent | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly mode = signal<TeamFormationMode>('RANDOM');

  protected readonly availablePlayers = signal<readonly GeneratedTeamPlayer[]>([]);
  protected readonly teams = signal<readonly GeneratedTeam[]>([]);
  protected readonly managerTeams = signal<readonly TeamManagerAssignment[]>([]);
  protected readonly managerSelections = signal<Readonly<Record<string, string | null>>>({});
  protected readonly selectedPlayerForSwap = signal<string | null>(null);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly savingMode = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly formationPlan = computed(() =>
    calculateTeamFormation(this.availablePlayers().length),
  );
  protected readonly isAdmin = computed(() => this.group()?.membership?.role === 'ADMIN');
  protected readonly canConfigure = computed(() => {
    const status = this.event()?.status;
    return this.isAdmin() && (status === 'OPEN' || status === 'IN_PROGRESS');
  });
  protected readonly eligibleManagers = computed<readonly GroupMember[]>(() =>
    (this.group()?.members ?? []).filter(
      (member) => member.deactivatedAt === null && member.profileId !== null,
    ),
  );
  protected readonly unlinkedActiveMembers = computed<readonly GroupMember[]>(() =>
    (this.group()?.members ?? []).filter(
      (member) => member.deactivatedAt === null && member.profileId === null,
    ),
  );
  protected readonly managerCounts = computed(() => {
    const selections = this.managerSelections();
    return calculateTeamManagerCounts(
      this.mode(),
      this.managerTeams().map((team) => ({
        manager: selections[team.teamId]
          ? {
              avatarUrl: null,
              displayName: '',
              groupMemberId: selections[team.teamId]!,
              nickname: null,
            }
          : null,
      })),
    );
  });

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

      const [groupDetail, records, existingTeams, managerConfiguration] = await Promise.all([
        this.groupService.get(currentEvent.groupId),
        this.attendanceService.list(eventId),
        this.teamService.getTeams(eventId),
        this.teamManagerService.getConfiguration(eventId),
      ]);
      this.group.set(groupDetail);

      const actualPlayers = records.filter((record) => record.actualFootball === 'YES');
      const players: GeneratedTeamPlayer[] = actualPlayers.map((record) => ({
        avatarUrl: record.avatarUrl,
        displayName: record.displayName,
        groupMemberId: record.groupMemberId,
        id: record.participantId ?? record.groupMemberId ?? record.displayName,
        isGuest: record.isGuest,
        participantId: record.participantId,
      }));
      this.availablePlayers.set(players);
      this.teams.set(existingTeams);
      this.applyManagerConfiguration(managerConfiguration.mode, managerConfiguration.teams);

      const plan = calculateTeamFormation(players.length);
      if (
        groupDetail.membership.role === 'ADMIN' &&
        managerConfiguration.mode === 'MANAGERS' &&
        plan.valid &&
        managerConfiguration.teams.length !== plan.teamCount &&
        (currentEvent.status === 'OPEN' || currentEvent.status === 'IN_PROGRESS')
      ) {
        await this.teamManagerService.setMode(eventId, 'MANAGERS', plan.teamCount);
        const synchronized = await this.teamManagerService.getConfiguration(eventId);
        this.applyManagerConfiguration(synchronized.mode, synchronized.teams);
      }
    } catch {
      this.errorMessage.set('No pudimos cargar la información del evento.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async changeMode(mode: TeamFormationMode): Promise<void> {
    const currentEvent = this.event();
    const plan = this.formationPlan();
    if (
      !currentEvent ||
      !this.canConfigure() ||
      this.savingMode() ||
      mode === this.mode() ||
      (mode === 'MANAGERS' && !plan.valid)
    ) {
      return;
    }

    this.savingMode.set(true);
    this.saveError.set(null);
    this.successMessage.set(null);
    try {
      await this.teamManagerService.setMode(
        currentEvent.id,
        mode,
        mode === 'MANAGERS' && plan.valid ? plan.teamCount : null,
      );
      const configuration = await this.teamManagerService.getConfiguration(currentEvent.id);
      this.applyManagerConfiguration(configuration.mode, configuration.teams);
      this.teams.set([]);
      this.selectedPlayerForSwap.set(null);
      this.successMessage.set('Modo de armado actualizado.');
    } catch (error) {
      this.saveError.set(this.errorCopy(error, 'No pudimos guardar el modo de armado.'));
    } finally {
      this.savingMode.set(false);
    }
  }

  protected selectManager(teamId: string, groupMemberId: string): void {
    this.managerSelections.update((current) => ({
      ...current,
      [teamId]: groupMemberId || null,
    }));
    this.saveError.set(null);
    this.successMessage.set(null);
  }

  protected managerIsSelectedElsewhere(groupMemberId: string, teamId: string): boolean {
    return Object.entries(this.managerSelections()).some(
      ([selectedTeamId, selectedMemberId]) =>
        selectedTeamId !== teamId && selectedMemberId === groupMemberId,
    );
  }

  protected managerName(team: TeamManagerAssignment): string {
    const selectedId = this.managerSelections()[team.teamId];
    return (
      this.eligibleManagers().find((member) => member.id === selectedId)?.displayName ??
      'Sin asignar'
    );
  }

  protected async saveManagers(): Promise<void> {
    const currentEvent = this.event();
    const selections = this.managerSelections();
    if (!currentEvent || !this.canConfigure() || !this.managerCounts().complete || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.successMessage.set(null);
    try {
      await this.teamManagerService.saveManagers(
        currentEvent.id,
        this.managerTeams().map((team) => ({
          groupMemberId: selections[team.teamId]!,
          teamId: team.teamId,
        })),
      );
      const configuration = await this.teamManagerService.getConfiguration(currentEvent.id);
      this.applyManagerConfiguration(configuration.mode, configuration.teams);
      this.successMessage.set('Directores técnicos guardados.');
    } catch (error) {
      this.saveError.set(this.errorCopy(error, 'No pudimos guardar los DT.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected generate(): void {
    const players = this.availablePlayers();
    if (this.mode() !== 'RANDOM' || players.length < 2) return;
    this.teams.set(generateRandomTeams(players));
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
    this.teams.set(swapTeamPlayers(this.teams(), selected, playerId));
    this.selectedPlayerForSwap.set(null);
  }

  protected async save(): Promise<void> {
    const currentEvent = this.event();
    const currentTeams = this.teams();
    if (!currentEvent || this.mode() !== 'RANDOM' || currentTeams.length === 0 || this.saving()) {
      return;
    }

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

  private applyManagerConfiguration(
    mode: TeamFormationMode,
    teams: readonly TeamManagerAssignment[],
  ): void {
    this.mode.set(mode);
    this.managerTeams.set(teams);
    this.managerSelections.set(
      Object.fromEntries(teams.map((team) => [team.teamId, team.manager?.groupMemberId ?? null])),
    );
  }

  private errorCopy(error: unknown, fallback: string): string {
    if (!(error instanceof TeamManagerOperationError)) return fallback;
    if (error.operation === 'ACCOUNT_REQUIRED') {
      return 'Este miembro necesita vincular su cuenta para ser DT.';
    }
    if (error.operation === 'INCOMPLETE') return 'Falta asignar un DT.';
    if (error.operation === 'CONFLICT') return 'Este miembro ya dirige otro equipo.';
    if (error.operation === 'READ_ONLY') {
      return 'Este miércoles ya no permite modificar los equipos.';
    }
    return fallback;
  }
}
