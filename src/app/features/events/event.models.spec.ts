import { describe, expect, it } from 'vitest';

import {
  WeeklyEvent,
  localDateTimeToIso,
  parseCourtPriceToMinor,
  selectCurrentEvent,
} from './event.models';

describe('event models', () => {
  it('converts Argentine money text to exact minor units without floating-point parsing', () => {
    expect(parseCourtPriceToMinor('50.000')).toBe(5_000_000);
    expect(parseCourtPriceToMinor('50000,25')).toBe(5_000_025);
    expect(parseCourtPriceToMinor('12,345')).toBeNull();
  });

  it('converts a valid local date and time to an instant', () => {
    const iso = localDateTimeToIso('2026-10-07', '21:30');

    expect(iso).toBeTruthy();
    expect(new Date(iso!).getFullYear()).toBe(2026);
    expect(localDateTimeToIso('2026-02-31', '21:30')).toBeNull();
  });

  it('prioritizes an in-progress event over future events and settlement', () => {
    const future = event('future', 'OPEN', '2026-10-14T21:00:00Z');
    const settlement = event('settlement', 'SETTLEMENT', '2026-10-01T21:00:00Z');
    const active = event('active', 'IN_PROGRESS', '2026-10-07T21:00:00Z');

    expect(
      selectCurrentEvent([future, settlement, active], new Date('2026-10-02T00:00:00Z'))?.id,
    ).toBe('active');
  });

  it('falls back to the nearest future non-closed event', () => {
    const later = event('later', 'DRAFT', '2026-10-21T21:00:00Z');
    const next = event('next', 'OPEN', '2026-10-07T21:00:00Z');
    const closed = event('closed', 'CLOSED', '2026-10-03T21:00:00Z');

    expect(selectCurrentEvent([later, closed, next], new Date('2026-10-02T00:00:00Z'))?.id).toBe(
      'next',
    );
  });
});

function event(id: string, status: WeeklyEvent['status'], startsAt: string): WeeklyEvent {
  return {
    courtPriceMinor: 5_000_000,
    createdAt: startsAt,
    createdBy: 'profile-id',
    currencyCode: 'ARS',
    groupId: 'group-id',
    id,
    location: 'La cancha',
    startsAt,
    status,
    title: null,
    updatedAt: startsAt,
  };
}
