import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { PageContainer } from '../../../../shared/layout';
import { Button, Card, EmptyState } from '../../../../shared/ui';
import { CreatedInvitation, InvitableGroupMember } from '../../invitation.models';
import { InvitationService } from '../../invitation.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, EmptyState, PageContainer],
  selector: 'app-invitation-admin-page',
  styleUrl: './invitation-admin-page.scss',
  templateUrl: './invitation-admin-page.html',
})
export class InvitationAdminPage implements OnInit {
  private readonly invitations = inject(InvitationService);

  protected readonly activeMemberId = signal<string | null>(null);
  protected readonly createdInvitation = signal<CreatedInvitation | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly members = signal<readonly InvitableGroupMember[]>([]);
  protected readonly shareMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadMembers();
  }

  protected async loadMembers(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      this.members.set(await this.invitations.listInvitableMembers());
    } catch {
      this.errorMessage.set('No pudimos cargar los miembros disponibles. Intentá nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async createInvitation(member: InvitableGroupMember): Promise<void> {
    if (this.activeMemberId()) {
      return;
    }

    this.activeMemberId.set(member.groupMemberId);
    this.createdInvitation.set(null);
    this.errorMessage.set(null);
    this.shareMessage.set(null);

    try {
      this.createdInvitation.set(await this.invitations.create(member.groupMemberId));
    } catch {
      this.errorMessage.set(
        'No pudimos generar la invitación. Verificá que el miembro siga disponible.',
      );
    } finally {
      this.activeMemberId.set(null);
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
}
