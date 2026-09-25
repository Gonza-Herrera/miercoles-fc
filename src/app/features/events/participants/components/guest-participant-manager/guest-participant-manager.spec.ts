import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { GuestParticipantService } from '../../data-access/guest-participant.service';
import { GuestOperationError } from '../../models/participant.models';
import { GuestParticipantManager } from './guest-participant-manager';

describe('GuestParticipantManager', () => {
  const add = vi.fn();
  const cancel = vi.fn();
  const list = vi.fn();
  const update = vi.fn();

  beforeEach(() => {
    add.mockReset();
    cancel.mockReset();
    list.mockReset();
    update.mockReset();
    list.mockResolvedValue([guest()]);
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    TestBed.configureTestingModule({
      imports: [GuestParticipantManager],
      providers: [
        {
          provide: GuestParticipantService,
          useValue: { add, cancel, list, update },
        },
      ],
    });
  });

  it('shows administrative actions only to an ADMIN', async () => {
    const memberFixture = TestBed.createComponent(GuestParticipantManager);
    memberFixture.componentRef.setInput('eventId', 'event-id');
    memberFixture.componentRef.setInput('isAdmin', false);
    memberFixture.detectChanges();
    await memberFixture.whenStable();
    memberFixture.detectChanges();
    expect(memberFixture.nativeElement.textContent).not.toContain('Agregar invitado');
    expect(memberFixture.nativeElement.querySelector('.participant__actions')).toBeNull();

    const adminFixture = TestBed.createComponent(GuestParticipantManager);
    adminFixture.componentRef.setInput('eventId', 'event-id');
    adminFixture.componentRef.setInput('isAdmin', true);
    adminFixture.detectChanges();
    await adminFixture.whenStable();
    adminFixture.detectChanges();
    expect(adminFixture.nativeElement.textContent).toContain('Agregar invitado');
    expect(adminFixture.nativeElement.querySelector('.participant__actions')).not.toBeNull();
  });

  it('requires confirmation before cancelling and keeps the stable row', async () => {
    cancel.mockResolvedValue(guest({ cancelledAt: '2026-09-25T12:00:00Z' }));
    const fixture = TestBed.createComponent(GuestParticipantManager);
    fixture.componentRef.setInput('eventId', 'event-id');
    fixture.componentRef.setInput('isAdmin', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === 'Quitar')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('¿Quitar a Martín del evento?');
    expect(cancel).not.toHaveBeenCalled();

    buttonsFor(fixture.nativeElement)
      .find((button) => button.textContent?.trim() === 'Quitar invitado')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(cancel).toHaveBeenCalledWith('participant-id');
    expect(fixture.nativeElement.textContent).toContain('Martín fue quitado del evento.');
  });

  it('loads edit state and reports successful changes', async () => {
    update.mockResolvedValue(guest({ displayName: 'Martín editado' }));
    const fixture = await createAdminFixture();

    buttonsFor(fixture.nativeElement)
      .find((button) => button.textContent?.trim() === 'Editar')!
      .click();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const name = element.querySelector<HTMLInputElement>('input[type="text"]')!;
    expect(name.value).toBe('Martín');
    name.value = 'Martín editado';
    name.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith('participant-id', {
      displayName: 'Martín editado',
      dines: true,
      plays: true,
    });
    expect(fixture.nativeElement.textContent).toContain('Invitado actualizado.');
  });

  it('maps a closed-event failure to friendly copy', async () => {
    add.mockRejectedValue(new GuestOperationError('CLOSED'));
    const fixture = await createAdminFixture();

    buttonsFor(fixture.nativeElement)
      .find((button) => button.textContent?.trim() === 'Agregar invitado')!
      .click();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const name = element.querySelector<HTMLInputElement>('input[type="text"]')!;
    name.value = 'Santi';
    name.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Este evento ya no permite modificar participantes.',
    );
  });

  async function createAdminFixture() {
    const fixture = TestBed.createComponent(GuestParticipantManager);
    fixture.componentRef.setInput('eventId', 'event-id');
    fixture.componentRef.setInput('isAdmin', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
});

function buttonsFor(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll('button')];
}

function guest(overrides: Record<string, unknown> = {}) {
  return {
    cancelledAt: null,
    dinnerResponse: 'YES',
    displayName: 'Martín',
    eventId: 'event-id',
    footballResponse: 'YES',
    id: 'participant-id',
    ...overrides,
  };
}
