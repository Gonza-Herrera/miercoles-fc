export type InvitationPreviewStatus =
  'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'INVALID' | 'MEMBER_LINKED' | 'REVOKED';

export type InvitationAcceptanceStatus =
  | 'ACCEPTED'
  | 'ACCEPTED_NOW'
  | 'ALREADY_MEMBER'
  | 'EXPIRED'
  | 'INVALID'
  | 'MEMBER_LINKED'
  | 'PROFILE_ALREADY_MEMBER'
  | 'REVOKED';

export interface InvitationPreview {
  readonly expiresAt: string | null;
  readonly groupName: string | null;
  readonly memberDisplayName: string | null;
  readonly status: InvitationPreviewStatus;
}

export interface InvitationAcceptance {
  readonly groupId: string | null;
  readonly groupMemberId: string | null;
  readonly groupName: string | null;
  readonly memberDisplayName: string | null;
  readonly status: InvitationAcceptanceStatus;
}

export interface InvitableGroupMember {
  readonly groupId: string;
  readonly groupMemberId: string;
  readonly groupName: string;
  readonly memberDisplayName: string;
}

export interface CreatedInvitation extends InvitableGroupMember {
  readonly expiresAt: string;
  readonly url: string;
}

export type InvitationOperation = 'ACCEPT' | 'CREATE' | 'LIST' | 'PREVIEW' | 'SHARE';

export class InvitationOperationError extends Error {
  constructor(readonly operation: InvitationOperation) {
    super(`Invitation operation failed: ${operation}`);
    this.name = 'InvitationOperationError';
  }
}
