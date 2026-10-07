import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DinnerRealityView } from '../../dinner-reality.models';
import { DinnerRealityService } from '../../dinner-reality.service';
import { DinnerReality } from './dinner-reality';

describe('DinnerReality', () => {
  const get = vi.fn();
  const saveAttendance = vi.fn();
  const createExpense = vi.fn();
  const updateExpense = vi.fn();
  const deleteExpense = vi.fn();

  beforeEach(() => {
    get.mockReset();
    saveAttendance.mockReset();
    createExpense.mockReset();
    updateExpense.mockReset();
    deleteExpense.mockReset();
  });

  it('keeps confirmations as context while rendering independent actual states and a Guest', async () => {
    const fixture = await setup(realityView());
    const text = fixture.nativeElement.textContent;
    const selected = fixture.nativeElement.querySelectorAll('.attendance__person--selected');

    expect(text).toContain('Gonzalo');
    expect(text).toContain('Lucas');
    expect(text).toContain('Carla');
    expect(text).toContain('Matías');
    expect(text).toContain('Martín');
    expect(text).toContain('Había dicho que no');
    expect(text).toContain('No había respondido');
    expect(text).toContain('Invitado');
    expect(selected.length).toBe(4);
  });

  it('distinguishes UNRECORDED from an explicitly recorded zero', async () => {
    const unrecorded = await setup(
      realityView({
        actualDinerCount: 0,
        attendanceRecorded: false,
        attendanceRecordedAt: null,
        participants: [],
      }),
    );
    expect(unrecorded.nativeElement.textContent).toContain('Sin registrar');
    expect(unrecorded.nativeElement.textContent).not.toContain('0 comieron');

    TestBed.resetTestingModule();
    const zero = await setup(realityView({ actualDinerCount: 0, participants: [] }));
    expect(zero.nativeElement.textContent).toContain('0 comieron');
    expect(zero.nativeElement.textContent).not.toContain('Asistencia de la cena sin registrar');
  });

  it('saves one complete atomic review and accepts confirmation/actual mismatches', async () => {
    const authoritative = realityView({ actualDinerCount: 4 });
    saveAttendance.mockResolvedValue(authoritative);
    const fixture = await setup(realityView());

    clickParticipant(fixture, 'Lucas');
    clickButton(fixture, 'Guardar asistencia');

    await vi.waitFor(() => {
      expect(saveAttendance).toHaveBeenCalledWith(
        'event-1',
        [
          expect.objectContaining({ attended: true, groupMemberId: 'm-gonzalo' }),
          expect.objectContaining({ attended: true, groupMemberId: 'm-lucas' }),
          expect.objectContaining({ attended: true, groupMemberId: 'm-carla' }),
          expect.objectContaining({ attended: true, groupMemberId: 'm-matias' }),
          expect.objectContaining({ attended: true, participantId: 'p-guest' }),
        ],
        '2026-10-07T23:00:00Z',
      );
    });
  });

  it('preserves local attendance selection after a failed save', async () => {
    saveAttendance.mockRejectedValue(new Error('network'));
    const fixture = await setup(realityView());
    clickParticipant(fixture, 'Lucas');
    clickButton(fixture, 'Guardar asistencia');

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No pudimos guardar quiénes comieron.');
      expect(participantElement(fixture, 'Lucas').classList).toContain(
        'attendance__person--selected',
      );
    });
  });

  it('derives and formats the exact $100.000 expense total without settlement UI', async () => {
    const fixture = await setup(realityView());
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Carne');
    expect(text).toContain('$ 50.000');
    expect(text).toContain('$ 100.000');
    expect(text).not.toContain('c/u');
    expect(text).not.toContain('debe');
    expect(text).not.toContain('Pagó');
  });

  it('validates expense input and creates exact minor units', async () => {
    createExpense.mockResolvedValue(realityView());
    const fixture = await setup(realityView());
    clickButton(fixture, '+ Agregar gasto');
    clickButton(fixture, 'Guardar gasto');
    expect(fixture.nativeElement.textContent).toContain('Ingresá un concepto');

    setInput(fixture, '#expense-description', 'Hielo');
    setInput(fixture, '#expense-amount', '5.000');
    clickButton(fixture, 'Guardar gasto');

    await vi.waitFor(() =>
      expect(createExpense).toHaveBeenCalledWith('event-1', {
        amountMinor: 500_000,
        description: 'Hielo',
      }),
    );
  });

  it('requires deliberate delete confirmation', async () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
    const fixture = await setup(realityView());
    const deleteButton = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.getAttribute('aria-label')?.includes('Eliminar gasto Carne'),
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('¿Querés eliminar este gasto?');
    expect(deleteExpense).not.toHaveBeenCalled();
  });

  it('keeps MEMBER and pre-reality views read-only', async () => {
    const fixture = await setup(realityView({ canEdit: false, eventStatus: 'OPEN' }));
    expect(fixture.nativeElement.textContent).toContain(
      'La asistencia real se registra cuando comienza el miércoles.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Guardar asistencia');
    expect(fixture.nativeElement.textContent).not.toContain('+ Agregar gasto');
  });

  async function setup(view: DinnerRealityView): Promise<ComponentFixture<DinnerReality>> {
    get.mockResolvedValue(view);
    if (!saveAttendance.getMockImplementation()) saveAttendance.mockResolvedValue(view);
    if (!createExpense.getMockImplementation()) createExpense.mockResolvedValue(view);
    if (!updateExpense.getMockImplementation()) updateExpense.mockResolvedValue(view);
    if (!deleteExpense.getMockImplementation()) deleteExpense.mockResolvedValue(view);
    await TestBed.configureTestingModule({
      imports: [DinnerReality],
      providers: [
        {
          provide: DinnerRealityService,
          useValue: { createExpense, deleteExpense, get, saveAttendance, updateExpense },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DinnerReality);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain(
        'Cargando asistencia y gastos reales…',
      );
    });
    return fixture;
  }
});

function clickButton(fixture: ComponentFixture<DinnerReality>, label: string): void {
  const button = [...fixture.nativeElement.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  ) as HTMLButtonElement;
  button.click();
  fixture.detectChanges();
}

function participantElement(
  fixture: ComponentFixture<DinnerReality>,
  name: string,
): HTMLButtonElement {
  return [...fixture.nativeElement.querySelectorAll('.attendance__person')].find((candidate) =>
    candidate.textContent?.includes(name),
  ) as HTMLButtonElement;
}

function clickParticipant(fixture: ComponentFixture<DinnerReality>, name: string): void {
  participantElement(fixture, name).click();
  fixture.detectChanges();
}

function setInput(fixture: ComponentFixture<DinnerReality>, selector: string, value: string): void {
  const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function realityView(overrides: Partial<DinnerRealityView> = {}): DinnerRealityView {
  return {
    actualDinerCount: 4,
    attendanceRecorded: true,
    attendanceRecordedAt: '2026-10-07T23:00:00Z',
    canEdit: true,
    currencyCode: 'ARS',
    eventId: 'event-1',
    eventStatus: 'IN_PROGRESS',
    expenses: [
      expense('expense-1', 'Carne', 5_000_000),
      expense('expense-2', 'Verduras', 1_000_000),
      expense('expense-3', 'Bebidas', 3_000_000),
      expense('expense-4', 'Pan', 1_000_000),
    ],
    participants: [
      participant('Gonzalo', 'm-gonzalo', 'p-gonzalo', 'YES', 'YES'),
      participant('Lucas', 'm-lucas', 'p-lucas', 'YES', 'NO'),
      participant('Carla', 'm-carla', 'p-carla', 'NO', 'YES'),
      participant('Matías', 'm-matias', 'p-matias', 'UNKNOWN', 'YES'),
      {
        ...participant('Martín', null, 'p-guest', 'NO', 'YES'),
        isGuest: true,
      },
    ],
    totalExpenseMinor: 10_000_000,
    ...overrides,
  };
}

function participant(
  displayName: string,
  groupMemberId: string | null,
  participantId: string,
  dinnerConfirmation: 'YES' | 'NO' | 'UNKNOWN',
  actualDinnerAttendance: 'YES' | 'NO',
) {
  return {
    actualDinnerAttendance,
    avatarPath: null,
    avatarUrl: null,
    dinnerConfirmation,
    displayName,
    groupMemberId,
    isGuest: false,
    participantId,
  };
}

function expense(id: string, description: string, amountMinor: number) {
  return {
    amountMinor,
    createdAt: '2026-10-07T23:00:00Z',
    description,
    eventId: 'event-1',
    id,
    updatedAt: '2026-10-07T23:00:00Z',
  };
}
