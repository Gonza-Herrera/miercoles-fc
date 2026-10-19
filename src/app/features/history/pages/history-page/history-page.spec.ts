import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { GroupService } from '../../../groups/group.service';
import { HistoryService } from '../../history.service';
import { HistoryPage } from './history-page';

describe('HistoryPage', () => {
  it('renders only the closed history page with actual counts and detail links', async () => {
    const fixture = await setup([
      item('event-30', '2026-10-01T01:00:00Z', 9, 11),
      item('event-23', '2026-09-24T01:00:00Z', 12, 8),
    ]);

    expect(fixture.nativeElement.textContent).toContain('Los miércoles que compartimos.');
    expect(fixture.nativeElement.textContent).toContain('9 jugadores');
    expect(fixture.nativeElement.textContent).toContain('11 personas');
    expect(
      fixture.nativeElement.querySelector('a[href="/groups/group-1/history/event-30"]'),
    ).toBeTruthy();
  });

  it('renders the historical empty state without fabricated cards', async () => {
    const fixture = await setup([]);

    expect(fixture.nativeElement.textContent).toContain('No hay miércoles anteriores todavía.');
    expect(fixture.nativeElement.querySelector('.history-card-link')).toBeFalsy();
  });
});

async function setup(
  items: readonly ReturnType<typeof item>[],
): Promise<ComponentFixture<HistoryPage>> {
  await TestBed.configureTestingModule({
    imports: [HistoryPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ groupId: 'group-1' }) } },
      },
      { provide: GroupService, useValue: { get: vi.fn().mockResolvedValue(group()) } },
      {
        provide: HistoryService,
        useValue: { list: vi.fn().mockResolvedValue({ hasMore: false, items, nextCursor: null }) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HistoryPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Los del Miércoles');
  });
  return fixture;
}

function item(
  eventId: string,
  startsAt: string,
  actualPlayerCount: number,
  actualDinerCount: number,
) {
  return {
    actualDinerCount,
    actualPlayerCount,
    closedAt: startsAt,
    eventId,
    groupId: 'group-1',
    startsAt,
    status: 'CLOSED' as const,
    title: null,
  };
}

function group() {
  return {
    avatarPath: null,
    avatarUrl: null,
    description: null,
    id: 'group-1',
    membership: {
      avatarPath: null,
      avatarUrl: null,
      deactivatedAt: null,
      displayName: 'Gonzalo',
      groupId: 'group-1',
      id: 'member-1',
      invitation: 'LINKED',
      nickname: null,
      profileId: 'profile-1',
      role: 'ADMIN',
    },
    members: [],
    name: 'Los del Miércoles',
  };
}
