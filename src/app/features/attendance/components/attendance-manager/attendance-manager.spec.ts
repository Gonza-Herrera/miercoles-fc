import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AttendanceService } from '../../attendance.service';
import { AttendanceManager } from './attendance-manager';

describe('AttendanceManager', () => {
  const list = vi.fn();
  const setDinner = vi.fn();
  const setFootball = vi.fn();

  beforeEach(() => {
    list.mockReset().mockResolvedValue([ownAttendance()]);
    setDinner.mockReset();
    setFootball.mockReset();
    TestBed.configureTestingModule({
      imports: [AttendanceManager],
      providers: [{ provide: AttendanceService, useValue: { list, setDinner, setFootball } }],
    });
  });

  it('allows an active member to answer while OPEN and preserves dinner state', async () => {
    setFootball.mockResolvedValue({
      dinnerResponse: 'NO',
      footballResponse: 'YES',
      groupMemberId: 'member-id',
      participantId: 'participant-id',
    });
    const fixture = await createFixture('OPEN');

    buttons(fixture.nativeElement)
      .find((button) => button.textContent?.includes('Voy'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setFootball).toHaveBeenCalledWith('event-id', 'YES');
    expect(fixture.nativeElement.textContent).toContain('Guardamos tu respuesta para el partido.');
    expect(fixture.nativeElement.textContent).toContain('🍽️ No');
  });

  it('renders planned confirmation read-only from IN_PROGRESS onward', async () => {
    const fixture = await createFixture('IN_PROGRESS');

    expect(buttons(fixture.nativeElement).every((button) => button.disabled)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('ya comenzó');
  });

  async function createFixture(status: 'IN_PROGRESS' | 'OPEN') {
    const fixture = TestBed.createComponent(AttendanceManager);
    fixture.componentRef.setInput('eventId', 'event-id');
    fixture.componentRef.setInput('eventStatus', status);
    fixture.componentRef.setInput('mode', 'both');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
});

function buttons(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll('button')];
}

function ownAttendance() {
  return {
    avatarPath: null,
    avatarUrl: null,
    dinnerResponse: 'NO',
    displayName: 'Lucas',
    eventId: 'event-id',
    footballResponse: 'UNKNOWN',
    groupMemberId: 'member-id',
    isCurrentUser: true,
    isGuest: false,
    membershipActive: true,
    participantId: null,
  };
}
