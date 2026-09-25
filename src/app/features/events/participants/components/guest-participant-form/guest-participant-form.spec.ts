import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { GuestParticipantForm } from './guest-participant-form';

describe('GuestParticipantForm', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [GuestParticipantForm] }));

  it('requires a non-blank name and trims the submitted value', () => {
    const fixture = TestBed.createComponent(GuestParticipantForm);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.detectChanges();

    setName(fixture.nativeElement, '   ');
    submit(fixture.nativeElement);
    fixture.detectChanges();
    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Escribí el nombre del invitado.');

    setName(fixture.nativeElement, '  Martín  ');
    submit(fixture.nativeElement);
    expect(submitted).toHaveBeenCalledWith({ displayName: 'Martín', dines: false, plays: true });
  });

  it('accepts football-only, dinner-only, or both activities', () => {
    const fixture = TestBed.createComponent(GuestParticipantForm);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.detectChanges();
    setName(fixture.nativeElement, 'Martín');
    const [plays, dines] = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');

    submit(fixture.nativeElement);
    plays.click();
    dines.click();
    submit(fixture.nativeElement);
    plays.click();
    submit(fixture.nativeElement);

    expect(submitted.mock.calls.map(([value]) => value)).toEqual([
      { displayName: 'Martín', dines: false, plays: true },
      { displayName: 'Martín', dines: true, plays: false },
      { displayName: 'Martín', dines: true, plays: true },
    ]);
  });

  it('rejects no activity and communicates loading state', () => {
    const fixture = TestBed.createComponent(GuestParticipantForm);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.detectChanges();
    setName(fixture.nativeElement, 'Martín');
    fixture.nativeElement.querySelector('input[type="checkbox"]').click();
    submit(fixture.nativeElement);
    fixture.detectChanges();

    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Seleccioná al menos una actividad.');

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Guardando…');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });
});

function setName(element: HTMLElement, value: string): void {
  const input = element.querySelector<HTMLInputElement>('input[type="text"]')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submit(element: HTMLElement): void {
  element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
}
