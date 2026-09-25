import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { InvitationService } from '../../invitation.service';
import { InvitationAdminPage } from './invitation-admin-page';

describe('InvitationAdminPage', () => {
  const create = vi.fn();
  const listInvitableMembers = vi.fn();
  const share = vi.fn();

  beforeEach(() => {
    create.mockReset();
    listInvitableMembers.mockReset();
    share.mockReset();
    listInvitableMembers.mockResolvedValue([
      {
        groupId: 'group-id',
        groupMemberId: 'member-id',
        groupName: 'Los del Miércoles',
        memberDisplayName: 'Lucas',
      },
    ]);
    create.mockResolvedValue({
      expiresAt: '2026-10-01T00:00:00Z',
      groupId: 'group-id',
      groupMemberId: 'member-id',
      groupName: 'Los del Miércoles',
      memberDisplayName: 'Lucas',
      url: 'https://example.test/invite/raw-token',
    });

    TestBed.configureTestingModule({
      imports: [InvitationAdminPage],
      providers: [
        {
          provide: InvitationService,
          useValue: { copy: vi.fn(), create, listInvitableMembers, share },
        },
      ],
    });
  });

  it('lists only invitable members returned by the secure boundary', async () => {
    const fixture = TestBed.createComponent(InvitationAdminPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lucas');
    expect(fixture.nativeElement.textContent).toContain('Los del Miércoles');
  });

  it('generates and displays a shareable invitation', async () => {
    const fixture = TestBed.createComponent(InvitationAdminPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(create).toHaveBeenCalledWith('member-id');
    expect(fixture.nativeElement.querySelector('#invitation-url').value).toContain(
      '/invite/raw-token',
    );
  });
});
