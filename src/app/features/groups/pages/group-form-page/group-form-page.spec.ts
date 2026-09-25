import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { GroupService } from '../../group.service';
import { GroupFormPage } from './group-form-page';

describe('GroupFormPage', () => {
  const create = vi.fn();

  beforeEach(() => {
    create.mockReset();
    TestBed.configureTestingModule({
      imports: [GroupFormPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
        { provide: GroupService, useValue: { create, uploadGroupAvatar: vi.fn() } },
      ],
    });
  });

  it('does not submit an empty group name', async () => {
    const fixture = TestBed.createComponent(GroupFormPage);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Ingresá un nombre para el grupo.');
  });

  it('creates a group and navigates to it', async () => {
    create.mockResolvedValue('group-id');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(GroupFormPage);
    fixture.detectChanges();
    const name = fixture.nativeElement.querySelector('#group-name') as HTMLInputElement;
    name.value = 'Los del Miércoles';
    name.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith({ description: '', name: 'Los del Miércoles' });
    expect(navigate).toHaveBeenCalledWith(['/groups', 'group-id']);
  });
});
