import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { GroupOperationError } from './group.models';
import { GroupService } from './group.service';

describe('GroupService', () => {
  const rpc = vi.fn();
  const upload = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    upload.mockReset();
    const client = {
      rpc,
      storage: { from: () => ({ upload }) },
    } as unknown as SupabaseClient<Database>;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { profile: signal({ id: 'profile-id' }), user: signal(null) },
        },
        { provide: SUPABASE_CLIENT, useValue: client },
      ],
    });
  });

  it('creates a group through the atomic RPC', async () => {
    rpc.mockResolvedValue({
      data: [{ group_id: 'group-id', group_name: 'Los del Miércoles', membership_id: 'member-id' }],
      error: null,
    });

    const id = await TestBed.inject(GroupService).create({
      description: 'Partido y cena',
      name: 'Los del Miércoles',
    });

    expect(id).toBe('group-id');
    expect(rpc).toHaveBeenCalledWith('create_group', {
      p_description: 'Partido y cena',
      p_name: 'Los del Miércoles',
    });
  });

  it('defaults member creation data to the explicit role supplied by the form', async () => {
    rpc.mockResolvedValue({ data: { id: 'member-id' }, error: null });

    await TestBed.inject(GroupService).addMember('group-id', {
      displayName: 'Lucas',
      nickname: '',
      role: 'MEMBER',
    });

    expect(rpc).toHaveBeenCalledWith('add_group_member', {
      p_display_name: 'Lucas',
      p_group_id: 'group-id',
      p_nickname: '',
      p_role: 'MEMBER',
    });
  });

  it('maps the database last-admin invariant to a domain error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'GROUP_LAST_ADMIN' } });

    await expect(TestBed.inject(GroupService).changeRole('member-id', 'MEMBER')).rejects.toEqual(
      new GroupOperationError('LAST_ADMIN'),
    );
  });

  it('rejects unsupported avatars before contacting Storage', async () => {
    const file = new File(['not-an-image'], 'avatar.gif', { type: 'image/gif' });

    await expect(TestBed.inject(GroupService).uploadGroupAvatar('group-id', file)).rejects.toEqual(
      new GroupOperationError('AVATAR'),
    );
    expect(upload).not.toHaveBeenCalled();
  });
});
