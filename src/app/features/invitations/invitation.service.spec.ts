import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { Database } from '../../core/supabase/database.types';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { CreatedInvitation, InvitationOperationError } from './invitation.models';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  const rpc = vi.fn();
  const share = vi.fn();
  const writeText = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    share.mockReset();
    writeText.mockReset();

    const documentStub = {
      defaultView: { navigator: { clipboard: { writeText }, share } },
      location: { origin: 'https://miercoles-fc.example' },
    };
    const client = { rpc } as unknown as SupabaseClient<Database>;

    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: documentStub },
        { provide: SUPABASE_CLIENT, useValue: client },
      ],
    });
  });

  it('maps the minimum safe invitation preview', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          expires_at: '2026-10-01T00:00:00Z',
          group_name: 'Los del Miércoles',
          member_display_name: 'Lucas',
          status: 'ACTIVE',
        },
      ],
      error: null,
    });

    const result = await TestBed.inject(InvitationService).preview('secure-token');

    expect(rpc).toHaveBeenCalledWith('get_group_invitation_preview', {
      p_raw_token: 'secure-token',
    });
    expect(result).toEqual({
      expiresAt: '2026-10-01T00:00:00Z',
      groupName: 'Los del Miércoles',
      memberDisplayName: 'Lucas',
      status: 'ACTIVE',
    });
  });

  it('creates an origin-aware URL without exposing database identifiers as credentials', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          expires_at: '2026-10-01T00:00:00Z',
          group_id: 'group-id',
          group_member_id: 'member-id',
          group_name: 'Los del Miércoles',
          member_display_name: 'Lucas',
          raw_token: 'raw-token',
        },
      ],
      error: null,
    });

    const result = await TestBed.inject(InvitationService).create('member-id');

    expect(result.url).toBe('https://miercoles-fc.example/invite/raw-token');
    expect(result.url).not.toContain('member-id');
  });

  it('maps acceptance failures without exposing raw database errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sensitive SQL details' } });

    await expect(TestBed.inject(InvitationService).accept('raw-token')).rejects.toEqual(
      new InvitationOperationError('ACCEPT'),
    );
  });

  it('uses the native Web Share API when available', async () => {
    share.mockResolvedValue(undefined);

    const result = await TestBed.inject(InvitationService).share(invitation);

    expect(result).toBe('SHARED');
    expect(share).toHaveBeenCalledWith({
      text: '¡Hola Lucas! Te invitaron a unirte a Los del Miércoles en Miércoles FC.',
      title: 'Invitación a Miércoles FC',
      url: invitation.url,
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does not report a cancelled native share as successful', async () => {
    share.mockRejectedValue(new DOMException('Share cancelled', 'AbortError'));

    const result = await TestBed.inject(InvitationService).share(invitation);

    expect(result).toBe('CANCELLED');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the URL when native sharing is unavailable', async () => {
    TestBed.resetTestingModule();
    const documentStub = {
      defaultView: { navigator: { clipboard: { writeText } } },
      location: { origin: 'https://miercoles-fc.example' },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: documentStub },
        { provide: SUPABASE_CLIENT, useValue: { rpc } },
      ],
    });

    const result = await TestBed.inject(InvitationService).share(invitation);

    expect(result).toBe('COPIED');
    expect(writeText).toHaveBeenCalledWith(invitation.url);
  });
});

const invitation: CreatedInvitation = {
  expiresAt: '2026-10-01T00:00:00Z',
  groupId: 'group-id',
  groupMemberId: 'member-id',
  groupName: 'Los del Miércoles',
  memberDisplayName: 'Lucas',
  url: 'https://miercoles-fc.example/invite/raw-token',
};
