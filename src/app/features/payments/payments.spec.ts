import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { EventService } from '../events/event.service';
import { GroupContextService } from '../groups/group-context.service';
import { GroupService } from '../groups/group.service';
import { MatchSettlementView } from './match-settlement.models';
import { MatchSettlementService } from './match-settlement.service';
import { Payments } from './payments';

describe('Payments Match Settlement', () => {
  const get = vi.fn();
  const finalize = vi.fn();

  beforeEach(() => {
    get.mockReset();
    finalize.mockReset();
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
    clickButton(fixture, 'Generar liquidación');
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
    clickButton(fixture, 'Generar liquidación');
    clickButton(fixture, 'Generar liquidación');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(finalize).toHaveBeenCalledWith('event-1');
      expect(fixture.nativeElement.textContent).toContain('Liquidación de cancha generada.');
      expect(fixture.nativeElement.textContent).toContain('Obligaciones finales');
    });
  });

  it('keeps MEMBER preview read-only', async () => {
    const fixture = await setup(previewView({ canFinalize: false }));
    expect(fixture.nativeElement.textContent).toContain('Solo un administrador');
    expect(button(fixture, 'Generar liquidación')).toBeUndefined();
  });

  it('does not expose payment-state controls or Dinner settlement', async () => {
    const text = (await setup(finalizedView())).nativeElement.textContent;
    expect(text).not.toContain('Registrar pago');
    expect(text).not.toContain('Marcar como pagado');
    expect(text).not.toContain('Método de pago');
    expect(text).not.toContain('Cena');
  });

  async function setup(view: MatchSettlementView): Promise<ComponentFixture<Payments>> {
    get.mockResolvedValue(view);
    if (!finalize.getMockImplementation()) finalize.mockResolvedValue(view);
    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [
        { provide: MatchSettlementService, useValue: { finalize, get } },
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
      expect(fixture.nativeElement.textContent).not.toContain('Preparando la liquidación…');
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
