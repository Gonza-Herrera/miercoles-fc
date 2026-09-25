import { Database } from '../../core/supabase/database.types';

export type GroupMemberRole = Database['public']['Enums']['group_member_role'];
export type InvitationIndicator = 'ACTIVE' | 'EXPIRED' | 'LINKED' | 'NOT_LINKED';

export interface GroupSummary {
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly description: string | null;
  readonly id: string;
  readonly memberCount: number;
  readonly name: string;
  readonly role: GroupMemberRole;
}

export interface GroupMember {
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly deactivatedAt: string | null;
  readonly displayName: string;
  readonly groupId: string;
  readonly id: string;
  readonly invitation: InvitationIndicator;
  readonly nickname: string | null;
  readonly profileId: string | null;
  readonly role: GroupMemberRole;
}

export interface GroupDetail {
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly description: string | null;
  readonly id: string;
  readonly membership: GroupMember;
  readonly members: readonly GroupMember[];
  readonly name: string;
}

export interface GroupInput {
  readonly description: string;
  readonly name: string;
}

export interface MemberInput {
  readonly displayName: string;
  readonly nickname: string;
  readonly role: GroupMemberRole;
}

export type GroupOperation =
  | 'ADD_MEMBER'
  | 'AVATAR'
  | 'CREATE'
  | 'DEACTIVATE'
  | 'LAST_ADMIN'
  | 'LOAD'
  | 'NOT_FOUND'
  | 'PERMISSION'
  | 'REACTIVATE'
  | 'ROLE'
  | 'UPDATE_GROUP'
  | 'UPDATE_MEMBER';

export class GroupOperationError extends Error {
  constructor(readonly operation: GroupOperation) {
    super(operation);
    this.name = 'GroupOperationError';
  }
}
