import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  CreatedInvitation,
  InvitationAcceptance,
  InvitationAcceptanceStatus,
  InvitationOperationError,
  InvitationPreview,
  InvitationPreviewStatus,
  InvitableGroupMember,
} from './invitation.models';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly document = inject(DOCUMENT);

  async preview(rawToken: string): Promise<InvitationPreview> {
    const { data, error } = await this.client.rpc('get_group_invitation_preview', {
      p_raw_token: rawToken,
    });
    const row = data?.[0];

    if (error || !row || !isPreviewStatus(row.status)) {
      throw new InvitationOperationError('PREVIEW');
    }

    return {
      expiresAt: row.expires_at,
      groupName: row.group_name,
      memberDisplayName: row.member_display_name,
      status: row.status,
    };
  }

  async accept(rawToken: string): Promise<InvitationAcceptance> {
    const { data, error } = await this.client.rpc('accept_group_invitation', {
      p_raw_token: rawToken,
    });
    const row = data?.[0];

    if (error || !row || !isAcceptanceStatus(row.status)) {
      throw new InvitationOperationError('ACCEPT');
    }

    return {
      groupId: row.group_id,
      groupMemberId: row.group_member_id,
      groupName: row.group_name,
      memberDisplayName: row.member_display_name,
      status: row.status,
    };
  }

  async listInvitableMembers(): Promise<readonly InvitableGroupMember[]> {
    const { data, error } = await this.client.rpc('list_invitable_group_members');

    if (error) {
      throw new InvitationOperationError('LIST');
    }

    return (data ?? []).map((row) => ({
      groupId: row.group_id,
      groupMemberId: row.group_member_id,
      groupName: row.group_name,
      memberDisplayName: row.member_display_name,
    }));
  }

  async create(groupMemberId: string): Promise<CreatedInvitation> {
    const { data, error } = await this.client.rpc('create_group_invitation', {
      p_group_member_id: groupMemberId,
    });
    const row = data?.[0];

    if (error || !row) {
      throw new InvitationOperationError('CREATE');
    }

    return {
      expiresAt: row.expires_at,
      groupId: row.group_id,
      groupMemberId: row.group_member_id,
      groupName: row.group_name,
      memberDisplayName: row.member_display_name,
      url: new URL(
        `/invite/${encodeURIComponent(row.raw_token)}`,
        this.document.location.origin,
      ).toString(),
    };
  }

  async share(invitation: CreatedInvitation): Promise<'CANCELLED' | 'COPIED' | 'SHARED'> {
    const navigator = this.document.defaultView?.navigator;
    const text = `¡Hola ${invitation.memberDisplayName}! Te invitaron a unirte a ${invitation.groupName} en Miércoles FC.`;

    if (navigator?.share) {
      try {
        await navigator.share({ text, title: 'Invitación a Miércoles FC', url: invitation.url });
        return 'SHARED';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return 'CANCELLED';
        }
      }
    }

    await this.copy(invitation.url);
    return 'COPIED';
  }

  async copy(value: string): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;

    if (clipboard) {
      await clipboard.writeText(value);
      return;
    }

    const textArea = this.document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    this.document.body.append(textArea);
    textArea.select();
    const copied = this.document.execCommand('copy');
    textArea.remove();

    if (!copied) {
      throw new InvitationOperationError('SHARE');
    }
  }
}

function isPreviewStatus(value: string): value is InvitationPreviewStatus {
  return ['ACTIVE', 'ACCEPTED', 'EXPIRED', 'INVALID', 'MEMBER_LINKED', 'REVOKED'].includes(value);
}

function isAcceptanceStatus(value: string): value is InvitationAcceptanceStatus {
  return [
    'ACCEPTED',
    'ACCEPTED_NOW',
    'ALREADY_MEMBER',
    'EXPIRED',
    'INVALID',
    'MEMBER_LINKED',
    'PROFILE_ALREADY_MEMBER',
    'REVOKED',
  ].includes(value);
}
