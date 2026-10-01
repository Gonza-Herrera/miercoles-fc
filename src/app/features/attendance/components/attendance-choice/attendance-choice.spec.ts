import { TestBed } from '@angular/core/testing';

import { AttendanceChoice } from './attendance-choice';

describe('AttendanceChoice', () => {
  it('exposes selected state accessibly and emits the independent choice', () => {
    const fixture = TestBed.createComponent(AttendanceChoice);
    fixture.componentRef.setInput('accessibleLabel', 'Confirmación para el partido');
    fixture.componentRef.setInput('response', 'YES');
    const emitted: string[] = [];
    fixture.componentInstance.responseChange.subscribe((response) => emitted.push(response));
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    buttons[1].click();
    expect(emitted).toEqual(['NO']);
  });

  it('keeps UNKNOWN distinct and blocks interaction while saving', () => {
    const fixture = TestBed.createComponent(AttendanceChoice);
    fixture.componentRef.setInput('accessibleLabel', 'Confirmación para la cena');
    fixture.componentRef.setInput('response', 'UNKNOWN');
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons.every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});
