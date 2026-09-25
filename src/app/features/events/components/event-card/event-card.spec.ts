import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WeeklyEvent } from '../../event.models';
import { EventCard } from './event-card';

describe('EventCard', () => {
  it('presents natural event data and its centralized status label', async () => {
    await TestBed.configureTestingModule({
      imports: [EventCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(EventCard);
    setInput(fixture.componentRef, event());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Abierto');
    expect(fixture.nativeElement.textContent).toContain('Cancha Central');
    expect(fixture.nativeElement.textContent).toContain('50.000');
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/events/event-id');
  });
});

function setInput(component: ComponentRef<EventCard>, value: WeeklyEvent): void {
  component.setInput('event', value);
}

function event(): WeeklyEvent {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: '2026-10-01T10:00:00Z',
    createdBy: 'profile-id',
    currencyCode: 'ARS',
    groupId: 'group-id',
    id: 'event-id',
    location: 'Cancha Central',
    startsAt: '2026-10-08T00:30:00Z',
    status: 'OPEN',
    title: null,
    updatedAt: '2026-10-01T10:00:00Z',
  };
}
