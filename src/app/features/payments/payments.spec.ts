import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { EventService } from '../events/event.service';
import { GroupContextService } from '../groups/group-context.service';
import { GroupService } from '../groups/group.service';
import { DinnerSettlementView } from './dinner-settlement.models';
import { DinnerSettlementService } from './dinner-settlement.service';
import { MatchSettlementView } from './match-settlement.models';
import { MatchSettlementService } from './match-settlement.service';
import { EventPaymentsView, PaymentOperationError } from './payment.models';
import { PaymentService } from './payment.service';
import { Payments } from './payments';

describe('Payments Match Settlement', () => {
  const get = vi.fn();
  const finalize = vi.fn();
  const getDinner = vi.fn();
  const finalizeDinner = vi.fn();
  const getPayments = vi.fn();
  const setStatus = vi.fn();

  beforeEach(() => {
    get.mockReset();
    finalize.mockReset();
    getDinner.mockReset();
    finalizeDinner.mockReset();
    getPayments.mockReset();
    setStatus.mockReset();
  });

  it('renders court price, actual-player count and 50,000 / 9 preview', async () => {
    const fixture = await setup(previewView());
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('$ 50.000');
    expect(text).toContain('9');
    expect(text).toContain('≈ $ 5.555,56');
    expect(text).toContain('$ 5.555,55');
    expect(text).toContain('Martín');
    expect(text).toContain('Invitado');
    expect(text).not.toContain('Lucas');
  });

  it('distinguishes unrecorded attendance from an explicit zero', async () => {
    const unrecorded = await setup(unavailable('ATTENDANCE_NOT_RECORDED', false));
    expect(unrecorded.nativeElement.textContent).toContain(
      'Primero registrá quiénes jugaron realmente.',
    );
    TestBed.resetTestingModule();
    const zero = await setup(unavailable('NO_ACTUAL_PLAYERS', true));
    expect(zero.nativeElement.textContent).toContain('No hay jugadores reales');
    expect(zero.nativeElement.textContent).not.toContain('NaN');
    expect(zero.nativeElement.textContent).not.toContain('Infinity');
  });

  it('requires deliberate confirmation before ADMIN finalization', async () => {
    mockDialog();
    const fixture = await setup(previewView());
    clickButton(fixture, 'Generar liquidación de cancha');
    expect(fixture.nativeElement.textContent).toContain(
      'Se generará una obligación para cada jugador real.',
    );
    expect(finalize).not.toHaveBeenCalled();
  });

  it('uses the authoritative finalized snapshot after success', async () => {
    mockDialog();
    const finalized = finalizedView();
    finalize.mockResolvedValue(finalized);
    const fixture = await setup(previewView());
    clickButton(fixture, 'Generar liquidación de cancha');
    clickButton(fixture, 'Generar liquidación');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(finalize).toHaveBeenCalledWith('event-1');
      expect(fixture.nativeElement.textContent).toContain('Liquidación de cancha generada.');
      expect(fixture.nativeElement.textContent).toContain('Estado por jugador');
    });
  });

  it('keeps MEMBER preview read-only', async () => {
    const fixture = await setup(previewView({ canFinalize: false }));
    expect(fixture.nativeElement.textContent).toContain('Solo un administrador');
    expect(button(fixture, 'Generar liquidación de cancha')).toBeUndefined();
  });

  it('renders an independent Dinner preview with exact 100,000 / 11 allocation', async () => {
    const text = (await setup(previewView())).nativeElement.textContent;
    expect(text).toContain('Cena');
    expect(text).toContain('$ 100.000');
    expect(text).toContain('11');
    expect(text).toContain('≈ $ 9.090,91');
    expect(text).toContain('$ 9.090,90');
    expect(text).toContain('Martín cena');
    expect(text).not.toContain('Lucas cena');
  });

  it('requires a separate deliberate confirmation for Dinner finalization', async () => {
    mockDialog();
    const fixture = await setup(previewView());
    clickButton(fixture, 'Generar liquidación de cena');
    expect(fixture.nativeElement.textContent).toContain(
      'Se generará una obligación para cada persona que realmente cenó.',
    );
    expect(finalizeDinner).not.toHaveBeenCalled();
  });

  it('handles unrecorded Dinner, zero diners and zero expenses without invalid numbers', async () => {
    getDinner.mockResolvedValue(dinnerUnavailable('ATTENDANCE_NOT_RECORDED', false));
    let fixture = await setup(previewView());
    expect(fixture.nativeElement.textContent).toContain(
      'Primero registrá quiénes cenaron realmente.',
    );
    TestBed.resetTestingModule();
    getDinner.mockResolvedValue(dinnerUnavailable('NO_ACTUAL_DINERS', true));
    fixture = await setup(previewView());
    expect(fixture.nativeElement.textContent).toContain('No hay comensales reales');
    expect(fixture.nativeElement.textContent).not.toContain('NaN');
    expect(fixture.nativeElement.textContent).not.toContain('Infinity');
    TestBed.resetTestingModule();
    getDinner.mockResolvedValue(dinnerUnavailable('NO_DINNER_EXPENSES', true));
    fixture = await setup(previewView());
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay gastos reales');
  });

  it('renders independent Match and Dinner payment states without a combined total', async () => {
    getDinner.mockResolvedValue(dinnerFinalizedView());
    const text = (await setup(finalizedView())).nativeElement.textContent;
    expect(text).toContain('GonzaloMatch');
    expect(text).toContain('Pagado');
    expect(text).toContain('GonzaloDinner');
    expect(text).toContain('Pendiente');
    expect(text).not.toContain('Total general');
  });

  it('requires confirmation and sends the exact obligation identity', async () => {
    mockDialog();
    getDinner.mockResolvedValue(dinnerFinalizedView());
    const updated = paymentsView();
    setStatus.mockResolvedValue(updated);
    const fixture = await setup(finalizedView());
    clickButton(fixture, 'Marcar pagado');
    expect(fixture.nativeElement.textContent).toContain('Confirmar pago');
    clickButton(fixture, 'Marcar como pagado');
    await vi.waitFor(() => {
      expect(setStatus).toHaveBeenCalledWith('DINNER', 'dinner-item-1', 'PAID', null);
    });
  });

  it('renders MEMBER payments read-only without mutation controls', async () => {
    getDinner.mockResolvedValue(dinnerFinalizedView());
    getPayments.mockResolvedValue({ ...paymentsView(), canManage: false });
    const fixture = await setup(finalizedView());

    expect(fixture.nativeElement.textContent).toContain('solo lectura');
    expect(button(fixture, 'Marcar pagado')).toBeUndefined();
    expect(button(fixture, 'Marcar pendiente')).toBeUndefined();
  });

  it('shows guests and the all-paid state textually', async () => {
    getDinner.mockResolvedValue(dinnerFinalizedView());
    const view = paymentsView();
    getPayments.mockResolvedValue({
      ...view,
      dinner: {
        ...view.dinner,
        obligations: [
          {
            ...view.dinner.obligations[0],
            displayName: 'Martín',
            isCurrentUser: false,
            isGuest: true,
            paidAt: '2026-10-09T20:00:00Z',
            status: 'PAID',
            updatedAt: '2026-10-09T20:00:00Z',
          },
        ],
        summary: {
          ...view.dinner.summary,
          collectedAmountMinor: 909_091,
          outstandingAmountMinor: 0,
          paidCount: 1,
          pendingCount: 0,
        },
      },
    });

    const text = (await setup(finalizedView())).nativeElement.textContent;
    expect(text).toContain('Martín');
    expect(text).toContain('Invitado');
    expect(text.match(/Todos pagaron\./g)).toHaveLength(2);
  });

  it('requires deliberate confirmation before reverting PAID to PENDING', async () => {
    mockDialog();
    getDinner.mockResolvedValue(dinnerFinalizedView());
    setStatus.mockResolvedValue(paymentsView());
    const fixture = await setup(finalizedView());

    clickButton(fixture, 'Marcar pendiente');
    expect(fixture.nativeElement.textContent).toContain('Corregir pago');
    expect(setStatus).not.toHaveBeenCalled();
    clickButton(fixture, 'Volver a pendiente');

    await vi.waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith(
        'COURT',
        'match-item-1',
        'PENDING',
        '2026-10-09T20:00:00Z',
      ),
    );
  });

  it('reloads authoritative state after a stale mutation failure', async () => {
    mockDialog();
    getDinner.mockResolvedValue(dinnerFinalizedView());
    setStatus.mockRejectedValue(new PaymentOperationError('CONFLICT'));
    const fixture = await setup(finalizedView());

    clickButton(fixture, 'Marcar pagado');
    clickButton(fixture, 'Marcar como pagado');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPayments).toHaveBeenCalledTimes(2);
      expect(fixture.nativeElement.textContent).toContain('El estado de este pago cambió');
      expect(fixture.nativeElement.textContent).toContain('Pendiente');
    });
  });

  async function setup(view: MatchSettlementView): Promise<ComponentFixture<Payments>> {
    get.mockResolvedValue(view);
    if (!getDinner.getMockImplementation()) getDinner.mockResolvedValue(dinnerPreviewView());
    if (!finalize.getMockImplementation()) finalize.mockResolvedValue(view);
    if (!finalizeDinner.getMockImplementation())
      finalizeDinner.mockResolvedValue(dinnerPreviewView());
    if (!getPayments.getMockImplementation()) getPayments.mockResolvedValue(paymentsView());
    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [
        { provide: MatchSettlementService, useValue: { finalize, get } },
        {
          provide: DinnerSettlementService,
          useValue: { finalize: finalizeDinner, get: getDinner },
        },
        { provide: PaymentService, useValue: { get: getPayments, setStatus } },
        {
          provide: GroupContextService,
          useValue: { current: () => null, selectedGroupId: () => null },
        },
        {
          provide: GroupService,
          useValue: { list: vi.fn().mockResolvedValue([{ id: 'group-1' }]) },
        },
        { provide: EventService, useValue: { current: vi.fn().mockResolvedValue(event()) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Payments);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Preparando las liquidaciones…');
    });
    return fixture;
  }
});

function previewView(overrides: Partial<MatchSettlementView> = {}): MatchSettlementView {
  const amounts = [555_556, 555_556, 555_556, 555_556, 555_556, 555_555, 555_555, 555_555, 555_555];
  const names = ['Gonzalo', 'Carla', 'Matías', 'Martín', 'Nico', 'Fede', 'Pablo', 'Santi', 'Diego'];
  return {
    actualPlayerCount: 9,
    attendanceRecorded: true,
    canFinalize: true,
    courtAmountMinor: 5_000_000,
    currencyCode: 'ARS',
    eventId: 'event-1',
    eventStatus: 'SETTLEMENT',
    preview: {
      allocations: names.map((displayName, index) => ({
        allocationOrder: index,
        amountMinor: amounts[index],
        displayName,
        eventParticipantId: `p-${index}`,
        isGuest: displayName === 'Martín',
      })),
      displayAverageMinor: 555_556,
      totalAllocatedMinor: 5_000_000,
    },
    settlement: null,
    unavailableReason: null,
    ...overrides,
  };
}

function paymentsView(): EventPaymentsView {
  return {
    canManage: true,
    currencyCode: 'ARS',
    dinner: {
      finalized: true,
      obligations: [
        {
          amountMinor: 909_091,
          avatarUrl: null,
          displayName: 'GonzaloDinner',
          eventParticipantId: 'd-0',
          id: 'dinner-item-1',
          isCurrentUser: true,
          isGuest: false,
          paidAt: null,
          status: 'PENDING',
          updatedAt: null,
        },
      ],
      summary: {
        collectedAmountMinor: 0,
        outstandingAmountMinor: 909_091,
        paidCount: 0,
        pendingCount: 1,
        totalAmountMinor: 909_091,
        totalCount: 1,
      },
    },
    eventId: 'event-1',
    eventStatus: 'SETTLEMENT',
    match: {
      finalized: true,
      obligations: [
        {
          amountMinor: 555_556,
          avatarUrl: null,
          displayName: 'GonzaloMatch',
          eventParticipantId: 'p-0',
          id: 'match-item-1',
          isCurrentUser: true,
          isGuest: false,
          paidAt: '2026-10-09T20:00:00Z',
          status: 'PAID',
          updatedAt: '2026-10-09T20:00:00Z',
        },
      ],
      summary: {
        collectedAmountMinor: 555_556,
        outstandingAmountMinor: 0,
        paidCount: 1,
        pendingCount: 0,
        totalAmountMinor: 555_556,
        totalCount: 1,
      },
    },
  };
}

function dinnerPreviewView(overrides: Partial<DinnerSettlementView> = {}): DinnerSettlementView {
  const amounts = Array.from({ length: 11 }, (_, index) => (index < 10 ? 909_091 : 909_090));
  const names = [
    'Gonzalo cena',
    'Carla cena',
    'Matías cena',
    'Martín cena',
    'Nico cena',
    'Fede cena',
    'Pablo cena',
    'Santi cena',
    'Diego cena',
    'Juan cena',
    'Ana cena',
  ];
  return {
    actualDinerCount: 11,
    attendanceRecorded: true,
    canFinalize: true,
    currencyCode: 'ARS',
    eventId: 'event-1',
    eventStatus: 'SETTLEMENT',
    expenseTotalMinor: 10_000_000,
    preview: {
      allocations: names.map((displayName, index) => ({
        allocationOrder: index,
        amountMinor: amounts[index],
        displayName,
        eventParticipantId: `d-${index}`,
        isGuest: displayName === 'Martín cena',
      })),
      displayAverageMinor: 909_091,
      totalAllocatedMinor: 10_000_000,
    },
    settlement: null,
    unavailableReason: null,
    ...overrides,
  };
}

function dinnerUnavailable(
  reason: 'ATTENDANCE_NOT_RECORDED' | 'NO_ACTUAL_DINERS' | 'NO_DINNER_EXPENSES',
  recorded: boolean,
): DinnerSettlementView {
  return {
    ...dinnerPreviewView(),
    actualDinerCount: reason === 'NO_DINNER_EXPENSES' ? 3 : 0,
    attendanceRecorded: recorded,
    canFinalize: false,
    expenseTotalMinor: reason === 'NO_DINNER_EXPENSES' ? 0 : 10_000_000,
    preview: null,
    unavailableReason: reason,
  };
}

function dinnerFinalizedView(): DinnerSettlementView {
  const preview = dinnerPreviewView();
  return {
    ...preview,
    canFinalize: false,
    preview: null,
    settlement: {
      actualDinerCount: preview.actualDinerCount,
      allocations: preview.preview!.allocations,
      currencyCode: preview.currencyCode,
      eventId: preview.eventId,
      expenseTotalMinor: preview.expenseTotalMinor,
      finalizedAt: '2026-10-08T23:00:00Z',
      id: 'dinner-settlement-1',
      totalAllocatedMinor: preview.expenseTotalMinor,
    },
  };
}

function finalizedView(): MatchSettlementView {
  const preview = previewView();
  return {
    ...preview,
    canFinalize: false,
    preview: null,
    settlement: {
      actualPlayerCount: preview.actualPlayerCount,
      allocations: preview.preview!.allocations,
      courtAmountMinor: preview.courtAmountMinor,
      currencyCode: preview.currencyCode,
      eventId: preview.eventId,
      finalizedAt: '2026-10-07T23:00:00Z',
      id: 'settlement-1',
      totalAllocatedMinor: preview.courtAmountMinor,
    },
  };
}

function unavailable(
  reason: 'ATTENDANCE_NOT_RECORDED' | 'NO_ACTUAL_PLAYERS',
  recorded: boolean,
): MatchSettlementView {
  return {
    ...previewView(),
    actualPlayerCount: 0,
    attendanceRecorded: recorded,
    canFinalize: false,
    preview: null,
    unavailableReason: reason,
  };
}

function event() {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: '',
    createdBy: '',
    currencyCode: 'ARS',
    groupId: 'group-1',
    id: 'event-1',
    location: 'Cancha',
    startsAt: '2026-10-07T21:00:00-03:00',
    status: 'SETTLEMENT',
    title: null,
    updatedAt: '',
  };
}

function button(fixture: ComponentFixture<Payments>, label: string): HTMLButtonElement | undefined {
  return [...fixture.nativeElement.querySelectorAll('button')]
    .filter((candidate) => candidate.textContent?.includes(label))
    .at(-1) as HTMLButtonElement | undefined;
}

function clickButton(fixture: ComponentFixture<Payments>, label: string): void {
  button(fixture, label)?.click();
  fixture.detectChanges();
}

function mockDialog(): void {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}
