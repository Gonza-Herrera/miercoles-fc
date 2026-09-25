import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { GroupContextService } from '../../group-context.service';
import { GroupService } from '../../group.service';
import { GroupListPage } from './group-list-page';

describe('GroupListPage', () => {
  const list = vi.fn();

  beforeEach(() => {
    list.mockReset();
    TestBed.configureTestingModule({
      imports: [GroupListPage],
      providers: [
        provideRouter([]),
        GroupContextService,
        { provide: GroupService, useValue: { list } },
      ],
    });
  });

  it('renders accessible groups and role labels', async () => {
    list.mockResolvedValue([
      {
        avatarPath: null,
        avatarUrl: null,
        description: null,
        id: 'group-id',
        memberCount: 5,
        name: 'Los del Miércoles',
        role: 'ADMIN',
      },
    ]);
    const fixture = TestBed.createComponent(GroupListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Los del Miércoles');
    expect(fixture.nativeElement.textContent).toContain('5 miembros · Admin');
  });

  it('renders the intentional empty state', async () => {
    list.mockResolvedValue([]);
    const fixture = TestBed.createComponent(GroupListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Todavía no tenés grupos');
    expect(fixture.nativeElement.textContent).toContain('Crear mi primer grupo');
  });
});
