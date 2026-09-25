import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { InvitationService } from '../../../invitations/invitation.service';
import { GroupContextService } from '../../group-context.service';
import { GroupService } from '../../group.service';
import { GroupDetailPage } from './group-detail-page';

describe('GroupDetailPage', () => {
  const create = vi.fn();
  const get = vi.fn();

  beforeEach(() => {
    create.mockReset();
    get.mockReset();
    TestBed.configureTestingModule({
      imports: [GroupDetailPage],
      providers: [
        provideRouter([]),
        GroupContextService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ groupId: 'group-id' }) } },
        },
        { provide: GroupService, useValue: { deactivate: vi.fn(), get, reactivate: vi.fn() } },
        { provide: InvitationService, useValue: { copy: vi.fn(), create, share: vi.fn() } },
      ],
    });
  });

  it('shows management and invitation actions to an ADMIN', async () => {
    get.mockResolvedValue(group('ADMIN'));
    const fixture = TestBed.createComponent(GroupDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Los del Miércoles');
    expect(fixture.nativeElement.textContent).toContain('Admin');
    expect(fixture.nativeElement.textContent).toContain('Asistente');
    expect(fixture.nativeElement.textContent).toContain('Invitar');
    expect(fixture.nativeElement.textContent).toContain('Agregar miembro');
  });

  it('hides administrative actions from a MEMBER', async () => {
    get.mockResolvedValue(group('MEMBER'));
    const fixture = TestBed.createComponent(GroupDetailPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Editar grupo');
    expect(fixture.nativeElement.textContent).not.toContain('Agregar miembro');
    expect(fixture.nativeElement.textContent).not.toContain('Invitar');
  });
});

function group(role: 'ADMIN' | 'MEMBER') {
  const membership = member('admin-id', 'Gonzalo', role, 'profile-id');
  return {
    avatarPath: null,
    avatarUrl: null,
    description: 'Partido y cena',
    id: 'group-id',
    membership,
    members: [membership, member('lucas-id', 'Lucas', 'MEMBER', null)],
    name: 'Los del Miércoles',
  };
}

function member(
  id: string,
  displayName: string,
  role: 'ADMIN' | 'MEMBER',
  profileId: string | null,
) {
  return {
    avatarPath: null,
    avatarUrl: null,
    deactivatedAt: null,
    displayName,
    groupId: 'group-id',
    id,
    invitation: profileId ? ('LINKED' as const) : ('NOT_LINKED' as const),
    nickname: null,
    profileId,
    role,
  };
}
