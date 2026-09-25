import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { GroupService } from '../../group.service';
import { MemberFormPage } from './member-form-page';

describe('MemberFormPage', () => {
  const addMember = vi.fn();
  const get = vi.fn();

  beforeEach(() => {
    addMember.mockReset();
    get.mockReset();
    get.mockResolvedValue({ membership: { role: 'ADMIN' }, members: [] });
    TestBed.configureTestingModule({
      imports: [MemberFormPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ groupId: 'group-id' }) } },
        },
        {
          provide: GroupService,
          useValue: { addMember, get, uploadMemberAvatar: vi.fn() },
        },
      ],
    });
  });

  it('creates an unlinked member as MEMBER by default with an optional nickname', async () => {
    addMember.mockResolvedValue('member-id');
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MemberFormPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const name = fixture.nativeElement.querySelector('#member-name') as HTMLInputElement;
    name.value = 'Lucas';
    name.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(addMember).toHaveBeenCalledWith('group-id', {
      displayName: 'Lucas',
      nickname: '',
      role: 'MEMBER',
    });
  });
});
