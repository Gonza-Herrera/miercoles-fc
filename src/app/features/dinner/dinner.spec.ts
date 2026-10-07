import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AttendanceService } from '../attendance/attendance.service';
import { EventService } from '../events/event.service';
import { GroupService } from '../groups/group.service';
import { DinnerPlanningView } from './dinner-planning.models';
import { DinnerPlanningService } from './dinner-planning.service';
import { DinnerRealityService } from './dinner-reality.service';
import { Dinner } from './dinner';

describe('Dinner', () => {
  const getPlanning = vi.fn();
  const savePlanning = vi.fn();

  beforeEach(() => {
    getPlanning.mockReset();
    savePlanning.mockReset();
  });

  it('renders count, persisted plan, purchases and owner', async () => {
    const fixture = await setup(planningView());
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('3 confirmados');
    expect(text).toContain('Asado');
    expect(text).toContain('Carne');
    expect(text).toContain('Gonzalo');
    expect(text).not.toContain('debe');
  });

  it('renders non-financial empty states', async () => {
    const fixture = await setup(planningView({ plan: null }));
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Menú por definir');
    expect(text).toContain('Todavía no hay compras previstas.');
    expect(text).toContain('Sin asignar');
  });

  it('lets an ADMIN edit locally, cancel, and save atomically', async () => {
    const fixture = await setup(planningView());
    clickButton(fixture, 'Editar planificación');
    const menu = fixture.nativeElement.querySelector('#dinner-menu') as HTMLInputElement;
    menu.value = 'Pizzas';
    menu.dispatchEvent(new Event('input'));
    clickButton(fixture, 'Cancelar');
    expect(fixture.nativeElement.textContent).toContain('Asado');

    clickButton(fixture, 'Editar planificación');
    const editedMenu = fixture.nativeElement.querySelector('#dinner-menu') as HTMLInputElement;
    editedMenu.value = 'Pizzas';
    editedMenu.dispatchEvent(new Event('input'));
    clickButton(fixture, 'Guardar');

    await vi.waitFor(() => expect(savePlanning).toHaveBeenCalled());
    expect(savePlanning.mock.calls[0][1].menu).toBe('Pizzas');
  });

  it('keeps MEMBER plans read-only', async () => {
    const memberFixture = await setup(planningView({ canEdit: false }));
    expect(memberFixture.nativeElement.textContent).not.toContain('Editar planificación');
  });

  it('keeps settled plans historical and read-only', async () => {
    const settledFixture = await setup(
      planningView({ canEdit: false, eventStatus: 'SETTLEMENT' }),
      'SETTLEMENT',
    );
    expect(settledFixture.nativeElement.textContent).toContain('histórica');
  });

  async function setup(
    view: DinnerPlanningView,
    status: 'OPEN' | 'SETTLEMENT' = 'OPEN',
  ): Promise<ComponentFixture<Dinner>> {
    getPlanning.mockResolvedValue(view);
    savePlanning.mockImplementation(async (_eventId, draft) => ({
      ...view,
      plan: view.plan ? { ...view.plan, menu: draft.menu } : view.plan,
    }));
    await TestBed.configureTestingModule({
      imports: [Dinner],
      providers: [
        {
          provide: DinnerPlanningService,
          useValue: { get: getPlanning, save: savePlanning },
        },
        {
          provide: DinnerRealityService,
          useValue: { get: vi.fn().mockResolvedValue(realityView()) },
        },
        {
          provide: EventService,
          useValue: {
            current: vi.fn().mockResolvedValue({
              courtPriceMinor: 0,
              createdAt: '',
              createdBy: '',
              currencyCode: 'ARS',
              groupId: 'group-1',
              id: 'event-1',
              location: 'Cancha',
              startsAt: '2026-10-07T21:00:00-03:00',
              status,
              title: null,
              updatedAt: '',
            }),
          },
        },
        {
          provide: GroupService,
          useValue: {
            list: vi.fn().mockResolvedValue([{ id: 'group-1' }]),
            get: vi.fn().mockResolvedValue({
              id: 'group-1',
              members: [member()],
              membership: member(),
              name: 'Miércoles FC',
            }),
          },
        },
        {
          provide: AttendanceService,
          useValue: {
            list: vi.fn().mockResolvedValue([
              {
                actualDinner: 'UNSET',
                actualFootball: 'UNSET',
                avatarPath: null,
                avatarUrl: null,
                dinnerResponse: 'YES',
                displayName: 'Gonzalo',
                eventId: 'event-1',
                footballResponse: 'NO',
                groupMemberId: 'member-1',
                isCurrentUser: true,
                isGuest: false,
                membershipActive: true,
                participantId: 'participant-1',
              },
            ]),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Dinner);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Preparando la planificación…');
    });
    return fixture;
  }
});

function clickButton(fixture: ComponentFixture<Dinner>, label: string): void {
  const button = [...fixture.nativeElement.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  button?.click();
  fixture.detectChanges();
}

function member() {
  return {
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
  };
}

function planningView(overrides: Partial<DinnerPlanningView> = {}): DinnerPlanningView {
  return {
    canEdit: true,
    confirmedDinerCount: 3,
    eventId: 'event-1',
    eventStatus: 'OPEN',
    plan: {
      eventId: 'event-1',
      id: 'plan-1',
      menu: 'Asado',
      plannedPurchases: [{ id: 'purchase-1', name: 'Carne', sortOrder: 0 }],
      purchaseOwner: {
        active: true,
        avatarPath: null,
        avatarUrl: null,
        displayName: 'Gonzalo',
        groupMemberId: 'member-1',
        nickname: null,
      },
      updatedAt: '2026-10-03T18:00:00Z',
    },
    ...overrides,
  };
}

function realityView() {
  return {
    actualDinerCount: 0,
    attendanceRecorded: false,
    attendanceRecordedAt: null,
    canEdit: false,
    currencyCode: 'ARS',
    eventId: 'event-1',
    eventStatus: 'OPEN',
    expenses: [],
    participants: [],
    totalExpenseMinor: 0,
  };
}
