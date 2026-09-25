import { Injectable, inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import {
  GroupDetail,
  GroupInput,
  GroupMember,
  GroupMemberRole,
  GroupOperationError,
  GroupSummary,
  InvitationIndicator,
  MemberInput,
} from './group.models';

type MemberRow = Database['public']['Tables']['group_members']['Row'];

const AVATAR_BUCKET = 'group-assets';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly auth = inject(AuthService);
  private readonly client = inject(SUPABASE_CLIENT);

  async list(): Promise<readonly GroupSummary[]> {
    const profileId = this.requireProfileId();
    const { data: memberships, error: membershipError } = await this.client
      .from('group_members')
      .select('id, group_id, role')
      .eq('profile_id', profileId)
      .is('deactivated_at', null);

    if (membershipError) {
      throw new GroupOperationError('LOAD');
    }

    const groupIds = (memberships ?? []).map((membership) => membership.group_id);
    if (!groupIds.length) {
      return [];
    }

    const [{ data: groups, error: groupError }, { data: activeMembers, error: countError }] =
      await Promise.all([
        this.client
          .from('groups')
          .select('id, name, description, avatar_url, created_by, created_at, updated_at')
          .in('id', groupIds)
          .order('name'),
        this.client
          .from('group_members')
          .select('group_id')
          .in('group_id', groupIds)
          .is('deactivated_at', null),
      ]);

    if (groupError || countError) {
      throw new GroupOperationError('LOAD');
    }

    const counts = new Map<string, number>();
    for (const member of activeMembers ?? []) {
      counts.set(member.group_id, (counts.get(member.group_id) ?? 0) + 1);
    }

    return Promise.all(
      (groups ?? []).map(async (group) => ({
        avatarPath: group.avatar_url,
        avatarUrl: await this.signedAvatar(group.avatar_url),
        description: group.description,
        id: group.id,
        memberCount: counts.get(group.id) ?? 0,
        name: group.name,
        role: memberships?.find((membership) => membership.group_id === group.id)?.role ?? 'MEMBER',
      })),
    );
  }

  async get(groupId: string): Promise<GroupDetail> {
    const profileId = this.requireProfileId();
    const [{ data: group, error: groupError }, { data: memberRows, error: membersError }] =
      await Promise.all([
        this.client
          .from('groups')
          .select('id, name, description, avatar_url, created_by, created_at, updated_at')
          .eq('id', groupId)
          .single(),
        this.client
          .from('group_members')
          .select(
            'id, group_id, profile_id, display_name, nickname, avatar_url, role, deactivated_at, created_at, updated_at',
          )
          .eq('group_id', groupId)
          .order('role')
          .order('display_name'),
      ]);

    if (groupError || membersError || !group || !memberRows) {
      throw new GroupOperationError(groupError?.code === 'PGRST116' ? 'NOT_FOUND' : 'LOAD');
    }

    const ownRow = memberRows.find(
      (member) => member.profile_id === profileId && member.deactivated_at === null,
    );
    if (!ownRow) {
      throw new GroupOperationError('PERMISSION');
    }

    const invitations =
      ownRow.role === 'ADMIN' ? await this.invitationIndicators(groupId) : new Map();
    const members = await Promise.all(
      memberRows.map((member) => this.mapMember(member, invitations.get(member.id))),
    );
    const membership = members.find((member) => member.id === ownRow.id);

    if (!membership) {
      throw new GroupOperationError('PERMISSION');
    }

    return {
      avatarPath: group.avatar_url,
      avatarUrl: await this.signedAvatar(group.avatar_url),
      description: group.description,
      id: group.id,
      membership,
      members,
      name: group.name,
    };
  }

  async create(input: GroupInput): Promise<string> {
    const { data, error } = await this.client.rpc('create_group', {
      p_description: input.description,
      p_name: input.name,
    });
    const row = data?.[0];

    if (error || !row) {
      throw this.mapError(error, 'CREATE');
    }
    return row.group_id;
  }

  async updateGroup(groupId: string, input: GroupInput): Promise<void> {
    const { error } = await this.client.rpc('update_group', {
      p_description: input.description,
      p_group_id: groupId,
      p_name: input.name,
    });
    if (error) {
      throw this.mapError(error, 'UPDATE_GROUP');
    }
  }

  async addMember(groupId: string, input: MemberInput): Promise<string> {
    const { data, error } = await this.client.rpc('add_group_member', {
      p_display_name: input.displayName,
      p_group_id: groupId,
      p_nickname: input.nickname,
      p_role: input.role,
    });
    if (error || !data) {
      throw this.mapError(error, 'ADD_MEMBER');
    }
    return data.id;
  }

  async updateMember(memberId: string, input: Omit<MemberInput, 'role'>): Promise<void> {
    const { error } = await this.client.rpc('update_group_member', {
      p_display_name: input.displayName,
      p_group_member_id: memberId,
      p_nickname: input.nickname,
    });
    if (error) {
      throw this.mapError(error, 'UPDATE_MEMBER');
    }
  }

  async changeRole(memberId: string, role: GroupMemberRole): Promise<void> {
    const { error } = await this.client.rpc('change_group_member_role', {
      p_group_member_id: memberId,
      p_role: role,
    });
    if (error) {
      throw this.mapError(error, 'ROLE');
    }
  }

  async deactivate(memberId: string): Promise<void> {
    const { error } = await this.client.rpc('deactivate_group_member', {
      p_group_member_id: memberId,
    });
    if (error) {
      throw this.mapError(error, 'DEACTIVATE');
    }
  }

  async reactivate(memberId: string): Promise<void> {
    const { error } = await this.client.rpc('reactivate_group_member', {
      p_group_member_id: memberId,
    });
    if (error) {
      throw this.mapError(error, 'REACTIVATE');
    }
  }

  async uploadGroupAvatar(groupId: string, file: File): Promise<void> {
    const path = `groups/${groupId}/avatar`;
    await this.upload(path, file);
    const { error } = await this.client.rpc('set_group_avatar', {
      p_avatar_path: path,
      p_group_id: groupId,
    });
    if (error) {
      throw this.mapError(error, 'AVATAR');
    }
  }

  async uploadMemberAvatar(groupId: string, memberId: string, file: File): Promise<void> {
    const path = `members/${groupId}/${memberId}/avatar`;
    await this.upload(path, file);
    const { error } = await this.client.rpc('set_group_member_avatar', {
      p_avatar_path: path,
      p_group_member_id: memberId,
    });
    if (error) {
      throw this.mapError(error, 'AVATAR');
    }
  }

  private async invitationIndicators(groupId: string): Promise<Map<string, InvitationIndicator>> {
    const { data, error } = await this.client
      .from('group_invitations')
      .select('group_member_id, expires_at, accepted_at, revoked_at, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new GroupOperationError('LOAD');
    }

    const result = new Map<string, InvitationIndicator>();
    for (const invitation of data ?? []) {
      if (result.has(invitation.group_member_id)) {
        continue;
      }
      const expired = invitation.expires_at && Date.parse(invitation.expires_at) <= Date.now();
      result.set(
        invitation.group_member_id,
        !invitation.accepted_at && !invitation.revoked_at && !expired ? 'ACTIVE' : 'EXPIRED',
      );
    }
    return result;
  }

  private async mapMember(row: MemberRow, invitation?: InvitationIndicator): Promise<GroupMember> {
    return {
      avatarPath: row.avatar_url,
      avatarUrl: await this.signedAvatar(row.avatar_url),
      deactivatedAt: row.deactivated_at,
      displayName: row.display_name,
      groupId: row.group_id,
      id: row.id,
      invitation: row.profile_id ? 'LINKED' : (invitation ?? 'NOT_LINKED'),
      nickname: row.nickname,
      profileId: row.profile_id,
      role: row.role,
    };
  }

  private async signedAvatar(path: string | null): Promise<string | null> {
    if (!path) {
      return null;
    }
    const { data, error } = await this.client.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(path, 300);
    return error ? null : data.signedUrl;
  }

  private async upload(path: string, file: File): Promise<void> {
    if (!AVATAR_TYPES.includes(file.type) || file.size > AVATAR_MAX_BYTES) {
      throw new GroupOperationError('AVATAR');
    }
    const { error } = await this.client.storage.from(AVATAR_BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      throw new GroupOperationError('AVATAR');
    }
  }

  private requireProfileId(): string {
    const profileId = this.auth.profile()?.id ?? this.auth.user()?.id;
    if (!profileId) {
      throw new GroupOperationError('PERMISSION');
    }
    return profileId;
  }

  private mapError(
    error: { message?: string } | null,
    fallback: GroupOperationError['operation'],
  ): GroupOperationError {
    const message = error?.message ?? '';
    if (message.includes('GROUP_LAST_ADMIN')) {
      return new GroupOperationError('LAST_ADMIN');
    }
    if (message.includes('GROUP_ADMIN_REQUIRED') || message.includes('permission denied')) {
      return new GroupOperationError('PERMISSION');
    }
    return new GroupOperationError(fallback);
  }
}
