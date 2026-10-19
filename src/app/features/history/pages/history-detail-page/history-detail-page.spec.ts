import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { GroupContextService } from '../../../groups/group-context.service';
import { GroupDetail } from '../../../groups/group.models';
import { GroupService } from '../../../groups/group.service';
import { HistoricalEventDetail } from '../../history.models';
import { HistoryService } from '../../history.service';
import { HistoryDetailPage } from './history-detail-page';

describe('HistoryDetailPage', () => {
  it('restores the Group context when opened from a direct historical URL', async () => {
    const currentGroup = group();
    const context = { set: vi.fn() };
    const fixture = await setup(currentGroup, context);

    expect(context.set).toHaveBeenCalledWith(currentGroup);
    expect(fixture.nativeElement.textContent).toContain('Evento finalizado');
    expect(fixture.nativeElement.textContent).toContain('Equipo C');
    expect(fixture.nativeElement.textContent).toContain('DT: Gazpar');
    expect(fixture.nativeElement.textContent).toContain('Invitado');
    expect(fixture.nativeElement.textContent).toContain('Menú: Asado');
    expect(fixture.nativeElement.textContent).toContain('Carbón');
    expect(fixture.nativeElement.textContent).toContain('Leña');
    expect(fixture.nativeElement.textContent).toContain('Pagó');
    expect(fixture.nativeElement.textContent).toContain('Hay pagos pendientes');
    expect(fixture.nativeElement.querySelector('a[href="/payments?eventId=event-1"]')).toBeTruthy();
  });
});

async function setup(
  currentGroup: GroupDetail,
  context: { readonly set: ReturnType<typeof vi.fn> },
): Promise<ComponentFixture<HistoryDetailPage>> {
  await TestBed.configureTestingModule({
    imports: [HistoryDetailPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ eventId: 'event-1', groupId: 'group-1' }),
          },
        },
      },
      { provide: GroupContextService, useValue: context },
      { provide: GroupService, useValue: { get: vi.fn().mockResolvedValue(currentGroup) } },
      { provide: HistoryService, useValue: { getDetail: vi.fn().mockResolvedValue(detail()) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HistoryDetailPage);
  fixture.detectChanges();
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Evento finalizado');
  });
  return fixture;
}

function group(): GroupDetail {
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

function detail(): HistoricalEventDetail {
  const summary = {
    collectedAmountMinor: 0,
    outstandingAmountMinor: 10_000,
    paidCount: 0,
    pendingCount: 1,
    totalAmountMinor: 10_000,
    totalCount: 1,
  };
  return {
    attendance: [
      {
        actualDinner: 'YES',
        actualFootball: 'YES',
        avatarUrl: null,
        dinnerResponse: 'YES',
        displayName: 'Invitado histórico',
        footballResponse: 'YES',
        groupMemberId: null,
        isGuest: true,
        participantId: 'participant-guest',
      },
    ],
    closure: {
      blocker: null,
      canClose: false,
      canManagePayments: true,
      dinner: {
        actualCount: 0,
        attendanceRecorded: true,
        collectedAmountMinor: 0,
        expenseTotalMinor: 0,
        occurred: false,
        outstandingAmountMinor: 0,
        paidCount: 0,
        settlementFinalized: false,
        totalCount: 0,
      },
      event: {
        closedAt: '2026-10-01T03:00:00Z',
        closedBy: 'profile-1',
        currencyCode: 'ARS',
        groupId: 'group-1',
        id: 'event-1',
        location: 'Cancha Central',
        startsAt: '2026-10-01T00:00:00Z',
        status: 'CLOSED',
        title: null,
      },
      financial: {
        collectedAmountMinor: 0,
        collectionComplete: false,
        outstandingAmountMinor: 10_000,
        totalAmountMinor: 10_000,
      },
      match: {
        actualCount: 0,
        attendanceRecorded: true,
        collectedAmountMinor: 0,
        courtAmountMinor: 10_000,
        occurred: true,
        outstandingAmountMinor: 10_000,
        paidCount: 0,
        settlementFinalized: false,
        totalCount: 1,
      },
    },
    dinnerPlanning: {
      plan: {
        menu: 'Asado',
        plannedPurchases: [{ id: 'purchase-1', name: 'Carbón' }],
        purchaseOwner: { displayName: 'Lucas', nickname: null },
      },
    },
    dinnerReality: {
      expenses: [{ amountMinor: 4_000, description: 'Leña', id: 'expense-1' }],
      totalExpenseMinor: 4_000,
    },
    dinnerSettlement: { settlement: { currencyCode: 'ARS' } },
    event: {
      courtPriceMinor: 10_000,
      createdAt: '2026-09-01T00:00:00Z',
      createdBy: 'profile-1',
      currencyCode: 'ARS',
      groupId: 'group-1',
      id: 'event-1',
      location: 'Cancha Central',
      startsAt: '2026-10-01T00:00:00Z',
      status: 'CLOSED',
      title: null,
      updatedAt: '2026-10-01T03:00:00Z',
    },
    lineup: {
      eventId: 'event-1',
      teams: [
        {
          manager: { displayName: 'Gaspar', nickname: 'Gazpar' },
          name: 'Equipo C',
          players: [
            {
              displayName: 'Invitado histórico',
              eventParticipantId: 'participant-guest',
              isGuest: true,
              nickname: null,
            },
          ],
          teamId: 'team-c',
        },
      ],
    },
    matchSettlement: { settlement: { currencyCode: 'ARS' } },
    payments: {
      canManage: true,
      currencyCode: 'ARS',
      dinner: {
        finalized: true,
        obligations: [
          {
            amountMinor: 4_000,
            displayName: 'Invitado histórico',
            id: 'dinner-obligation',
            isGuest: true,
            status: 'PAID',
          },
        ],
        summary: {
          ...summary,
          outstandingAmountMinor: 0,
          pendingCount: 0,
          totalAmountMinor: 0,
          totalCount: 0,
        },
      },
      eventId: 'event-1',
      eventStatus: 'CLOSED',
      match: {
        finalized: true,
        obligations: [
          {
            amountMinor: 10_000,
            displayName: 'Invitado histórico',
            id: 'match-obligation',
            isGuest: true,
            status: 'PENDING',
          },
        ],
        summary,
      },
    },
  } as unknown as HistoricalEventDetail;
}
