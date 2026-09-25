import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { Button, Card } from '../../../../shared/ui';
import {
  InvitationAcceptance,
  InvitationAcceptanceStatus,
  InvitationPreview,
  InvitationPreviewStatus,
} from '../../invitation.models';
import { InvitationService } from '../../invitation.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, RouterLink],
  selector: 'app-invitation-page',
  styleUrl: './invitation-page.scss',
  templateUrl: './invitation-page.html',
})
export class InvitationPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly invitations = inject(InvitationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  protected readonly accepting = signal(false);
  protected readonly acceptance = signal<InvitationAcceptance | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly preview = signal<InvitationPreview | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadPreview();
  }

  protected async loadPreview(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      this.preview.set(await this.invitations.preview(this.token));
    } catch {
      this.errorMessage.set('No pudimos procesar la invitación. Intentá nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async joinGroup(): Promise<void> {
    if (this.accepting() || this.preview()?.status !== 'ACTIVE') {
      return;
    }

    await this.auth.initialize();

    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/auth'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.accepting.set(true);
    this.errorMessage.set(null);

    try {
      this.acceptance.set(await this.invitations.accept(this.token));
    } catch {
      this.errorMessage.set('No pudimos procesar la invitación. Intentá nuevamente.');
    } finally {
      this.accepting.set(false);
    }
  }

  protected previewTitle(status: InvitationPreviewStatus): string {
    const titles: Record<InvitationPreviewStatus, string> = {
      ACCEPTED: 'Esta invitación ya fue utilizada',
      ACTIVE: 'Invitación disponible',
      EXPIRED: 'Esta invitación venció',
      INVALID: 'No encontramos esta invitación',
      MEMBER_LINKED: 'Este miembro ya está vinculado a una cuenta',
      REVOKED: 'Esta invitación ya no está disponible',
    };
    return titles[status];
  }

  protected acceptanceTitle(status: InvitationAcceptanceStatus): string {
    const titles: Record<InvitationAcceptanceStatus, string> = {
      ACCEPTED: 'Esta invitación ya fue utilizada',
      ACCEPTED_NOW: '¡Ya estás adentro!',
      ALREADY_MEMBER: 'Ya eras parte del grupo',
      EXPIRED: 'Esta invitación venció',
      INVALID: 'No encontramos esta invitación',
      MEMBER_LINKED: 'Este miembro ya está vinculado a una cuenta',
      PROFILE_ALREADY_MEMBER: 'Ya pertenecés a este grupo',
      REVOKED: 'Esta invitación ya no está disponible',
    };
    return titles[status];
  }
}
