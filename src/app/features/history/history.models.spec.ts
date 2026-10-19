import { historicalEventDate, historyDateParts } from './history.models';

describe('History date formatting', () => {
  it('uses the established Argentina timezone without UTC day shifts', () => {
    expect(historyDateParts('2026-10-01T01:30:00Z')).toEqual({ day: '30', month: 'SEPT' });
    expect(historicalEventDate('2026-10-01T01:30:00Z')).toContain('30 de septiembre');
  });
});
