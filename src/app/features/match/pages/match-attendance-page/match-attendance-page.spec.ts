import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AttendanceRecord } from '../../../attendance/attendance.models';
import { AttendanceService } from '../../../attendance/attendance.service';
import { GroupMemberRole } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { WeeklyEvent } from '../../../events/event.models';
import { EventService } from '../../../events/event.service';
import { MatchAttendancePage } from './match-attendance-page';

describe('MatchAttendancePage', () => {
  let recordMatchAttendanceMock: ReturnType<typeof vi.fn>;
  let navigateMock: ReturnType<typeof vi.fn>;

  it('loads players and intelligently preselects confirmed players', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees());

    expect(fixture.nativeElement.textContent).toContain('¿Quiénes jugaron?');
    expect(fixture.nativeElement.textContent).toContain('Gonzalo');
    expect(fixture.nativeElement.textContent).toContain('Matías');
    expect(fixture.nativeElement.textContent).toContain('Lucas');

    // Gonzalo had footballResponse YES, so preselected -> 2 checked (Gonzalo, Franco who had actualFootball YES)
    const checkedItems = fixture.nativeElement.querySelectorAll('.match-attendance__item--checked');
    expect(checkedItems.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('2 presentes');
  });

  it('toggles player attendance on row click and updates present count', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees());

    const items = fixture.nativeElement.querySelectorAll(
      '.match-attendance__item',
    ) as NodeListOf<HTMLElement>;

    // Click Lucas (who was unchecked)
    const lucasItem = [...items].find((el) => el.textContent?.includes('Lucas'));
    lucasItem?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('3 presentes');
    expect(lucasItem?.classList.contains('match-attendance__item--checked')).toBe(true);

    // Click Lucas again to uncheck
    lucasItem?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2 presentes');
    expect(lucasItem?.classList.contains('match-attendance__item--checked')).toBe(false);
  });

  it('allows bulk selecting all and deselecting all', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees());

    const bulkButtons = fixture.nativeElement.querySelectorAll(
      '.match-attendance__link-button',
    ) as NodeListOf<HTMLButtonElement>;
    const selectAllBtn = [...bulkButtons].find((b) => b.textContent?.includes('Todos'));
    const deselectAllBtn = [...bulkButtons].find((b) => b.textContent?.includes('Ninguno'));

    selectAllBtn?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3 presentes');

    deselectAllBtn?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0 presentes');
  });

  it('prevents non-admins from managing match attendance', async () => {
    const fixture = await setupFixture('MEMBER', sampleAttendees());

    expect(fixture.nativeElement.textContent).toContain(
      'Solo los administradores pueden marcar presentes.',
    );
  });

  it('saves match attendance and navigates with feedback', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees());

    const saveButton = fixture.nativeElement.querySelector(
      '.match-attendance__footer button',
    ) as HTMLButtonElement;
    saveButton.click();
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(recordMatchAttendanceMock).toHaveBeenCalledWith('event-id', [
        { attended: true, groupMemberId: 'm-1', participantId: 'p-1' },
        { attended: false, groupMemberId: 'm-3', participantId: 'p-3' },
        { attended: true, groupMemberId: 'm-2', participantId: 'p-2' },
      ]);
      expect(navigateMock).toHaveBeenCalledWith(['/events', 'event-id'], {
        state: {
          eventFeedback: 'Se guardó la lista de presentes (2 jugadores).',
        },
      });
    });
  });

  it('shows error banner when saving fails', async () => {
    const fixture = await setupFixture('ADMIN', sampleAttendees());
    recordMatchAttendanceMock.mockRejectedValue(new Error('Network error'));

    const saveButton = fixture.nativeElement.querySelector(
      '.match-attendance__footer button',
    ) as HTMLButtonElement;
    saveButton.click();
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(fixture.nativeElement.textContent).toContain('No pudimos guardar los presentes');
    });
  });

  async function setupFixture(
    role: GroupMemberRole,
    attendees: readonly AttendanceRecord[],
  ): Promise<ComponentFixture<MatchAttendancePage>> {
    recordMatchAttendanceMock = vi.fn().mockResolvedValue(undefined);
    navigateMock = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [MatchAttendancePage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ eventId: 'event-id' }) } },
        },
        {
          provide: Router,
          useValue: { navigate: navigateMock },
        },
        {
          provide: EventService,
          useValue: {
            get: vi.fn().mockResolvedValue(sampleEvent()),
          },
        },
        {
          provide: GroupService,
          useValue: {
            get: vi.fn().mockResolvedValue({
              avatarPath: null,
              avatarUrl: null,
              description: null,
              id: 'group-id',
              members: [],
              membership: {
                avatarPath: null,
                avatarUrl: null,
                deactivatedAt: null,
                displayName: 'Gonzalo',
                groupId: 'group-id',
                id: 'm-1',
                invitation: 'LINKED',
                nickname: null,
                profileId: 'profile-id',
                role,
              },
              name: 'Los del Miércoles',
            }),
          },
        },
        {
          provide: AttendanceService,
          useValue: {
            list: vi.fn().mockResolvedValue(attendees),
            recordMatchAttendance: recordMatchAttendanceMock,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MatchAttendancePage);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Cargando jugadores…');
    });
    return fixture;
  }
});

function sampleEvent(): WeeklyEvent {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: '2026-10-01T10:00:00Z',
    createdBy: 'profile-id',
    currencyCode: 'ARS',
    groupId: 'group-id',
    id: 'event-id',
    location: 'La Canchita',
    startsAt: '2026-10-08T00:30:00Z',
    status: 'OPEN',
    title: null,
    updatedAt: '2026-10-01T10:00:00Z',
  };
}

function sampleAttendees(): readonly AttendanceRecord[] {
  return [
    {
      actualDinner: 'UNSET',
      actualFootball: 'UNSET',
      avatarPath: null,
      avatarUrl: null,
      dinnerResponse: 'YES',
      displayName: 'Gonzalo',
      eventId: 'event-id',
      footballResponse: 'YES', // Pre-selected
      groupMemberId: 'm-1',
      isCurrentUser: true,
      isGuest: false,
      membershipActive: true,
      participantId: 'p-1',
    },
    {
      actualDinner: 'UNSET',
      actualFootball: 'YES', // Already recorded as YES
      avatarPath: null,
      avatarUrl: null,
      dinnerResponse: 'NO',
      displayName: 'Matías',
      eventId: 'event-id',
      footballResponse: 'NO',
      groupMemberId: 'm-2',
      isCurrentUser: false,
      isGuest: false,
      membershipActive: true,
      participantId: 'p-2',
    },
    {
      actualDinner: 'UNSET',
      actualFootball: 'UNSET',
      avatarPath: null,
      avatarUrl: null,
      dinnerResponse: 'YES',
      displayName: 'Lucas',
      eventId: 'event-id',
      footballResponse: 'NO', // Unchecked
      groupMemberId: 'm-3',
      isCurrentUser: false,
      isGuest: false,
      membershipActive: true,
      participantId: 'p-3',
    },
  ];
}
