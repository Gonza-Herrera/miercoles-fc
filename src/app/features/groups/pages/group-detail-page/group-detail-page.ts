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
import { Avatar, Button, Card, ConfirmDialog, EmptyState } from '../../../../shared/ui';
import { CreatedInvitation } from '../../../invitations/invitation.models';
import { InvitationService } from '../../../invitations/invitation.service';
import { GroupContextService } from '../../group-context.service';
import { GroupDetail, GroupMember, GroupOperationError } from '../../group.models';
import { GroupService } from '../../group.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button, Card, ConfirmDialog, EmptyState, PageContainer, RouterLink],
  selector: 'app-group-detail-page',
  styleUrl: '../../groups.shared.scss',
  templateUrl: './group-detail-page.html',
})
export class GroupDetailPage implements OnInit {
  private readonly context = inject(GroupContextService);
  private readonly groups = inject(GroupService);
  private readonly invitations = inject(InvitationService);
  private readonly route = inject(ActivatedRoute);

  protected readonly busyMemberId = signal<string | null>(null);
  protected readonly confirmMember = signal<GroupMember | null>(null);
  protected readonly createdInvitation = signal<CreatedInvitation | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly shareMessage = signal<string | null>(null);
  protected readonly isAdmin = computed(() => this.group()?.membership.role === 'ADMIN');
  protected readonly activeMembers = computed(() =>
    (this.group()?.members ?? []).filter((member) => !member.deactivatedAt),
  );
  protected readonly inactiveMembers = computed(() =>
    (this.group()?.members ?? []).filter((member) => member.deactivatedAt),
  );
  protected readonly groupId = this.route.snapshot.paramMap.get('groupId')!;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const group = await this.groups.get(this.groupId);
      this.group.set(group);
      this.context.set(group);
    } catch (error) {
      this.errorMessage.set(
        error instanceof GroupOperationError && error.operation === 'PERMISSION'
          ? 'No tenés acceso activo a este grupo.'
          : 'No pudimos cargar el grupo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected requestDeactivation(member: GroupMember): void {
    this.confirmMember.set(member);
  }

  protected async deactivate(): Promise<void> {
    const member = this.confirmMember();
    this.confirmMember.set(null);
    if (!member) return;
    await this.memberMutation(member, 'DEACTIVATE');
  }

  protected async reactivate(member: GroupMember): Promise<void> {
    await this.memberMutation(member, 'REACTIVATE');
  }

  protected async createInvitation(member: GroupMember): Promise<void> {
    if (this.busyMemberId()) return;
    this.busyMemberId.set(member.id);
    this.createdInvitation.set(null);
    this.feedback.set(null);
    this.errorMessage.set(null);
    this.shareMessage.set(null);
    try {
      this.createdInvitation.set(await this.invitations.create(member.id));
      await this.load();
    } catch {
      this.errorMessage.set('No pudimos generar la invitación.');
    } finally {
      this.busyMemberId.set(null);
    }
  }

  protected async shareInvitation(invitation: CreatedInvitation): Promise<void> {
    try {
      const result = await this.invitations.share(invitation);
      this.shareMessage.set(
        result === 'CANCELLED'
          ? null
          : result === 'COPIED'
            ? 'Enlace copiado.'
            : 'Invitación compartida.',
      );
    } catch {
      this.shareMessage.set('No pudimos compartirla. Copiá el enlace manualmente.');
    }
  }

  protected async copyInvitation(invitation: CreatedInvitation): Promise<void> {
    try {
      await this.invitations.copy(invitation.url);
      this.shareMessage.set('Enlace copiado.');
    } catch {
      this.shareMessage.set('No pudimos copiarlo. Seleccioná el enlace manualmente.');
    }
  }

  private async memberMutation(
    member: GroupMember,
    operation: 'DEACTIVATE' | 'REACTIVATE',
  ): Promise<void> {
    if (this.busyMemberId()) return;
    this.busyMemberId.set(member.id);
    this.feedback.set(null);
    this.errorMessage.set(null);
    try {
      if (operation === 'DEACTIVATE') await this.groups.deactivate(member.id);
      else await this.groups.reactivate(member.id);
      this.feedback.set(
        operation === 'DEACTIVATE'
          ? `${member.displayName} fue quitado del grupo.`
          : `${member.displayName} volvió a ser miembro activo.`,
      );
      await this.load();
    } catch (error) {
      this.errorMessage.set(
        error instanceof GroupOperationError && error.operation === 'LAST_ADMIN'
          ? 'El grupo debe conservar al menos un administrador.'
          : 'No pudimos actualizar el miembro.',
      );
    } finally {
      this.busyMemberId.set(null);
    }
  }
}
