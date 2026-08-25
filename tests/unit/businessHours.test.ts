import { describe, it, expect } from 'bun:test';
import { addBusinessHours } from '../../src/services/sla/businessHours';

const config = {
  timezone: 'Asia/Kolkata',
  startHour: 9,
  endHour: 18,
};

// Helper: create a UTC Date from an IST wall-clock time for readable test setup.
// IST is UTC+5:30, so we subtract that offset to get the equivalent UTC instant.
function istToUtc(isoLocal: string): Date {
  const local = new Date(isoLocal + '+05:30');
  return local;
}

describe('addBusinessHours', () => {
  it('normal weekday calculation within the same day', () => {
    // Monday 10:00 + 3 hours = Monday 13:00
    const start = istToUtc('2026-08-24T10:00:00');
    const result = addBusinessHours(start, 3, [], config);
    const expected = istToUtc('2026-08-24T13:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('ticket created before business hours starts counting at 09:00', () => {
    // Monday 07:00 + 1 hour = Monday 10:00 (counting starts at 09:00)
    const start = istToUtc('2026-08-24T07:00:00');
    const result = addBusinessHours(start, 1, [], config);
    const expected = istToUtc('2026-08-24T10:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('ticket created after business hours rolls to next day 09:00', () => {
    // Monday 20:00 + 1 hour = Tuesday 10:00
    const start = istToUtc('2026-08-24T20:00:00');
    const result = addBusinessHours(start, 1, [], config);
    const expected = istToUtc('2026-08-25T10:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('friday evening: only one minute-equivalent hour counts before weekend', () => {
    // Friday 17:59 + 1 min (~0.0166 hours) stays Friday; but let's test the
    // documented spec example instead: HIGH priority, Friday 17:00 + 4 hours = Monday 12:00
    const start = istToUtc('2026-08-21T17:00:00'); // a Friday
    const result = addBusinessHours(start, 4, [], config);
    const expected = istToUtc('2026-08-24T12:00:00'); // the following Monday
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('weekend: ticket created Saturday begins counting from next business day', () => {
    // Saturday (any time) + 24 hours = Wednesday 15:00 (per our hand-traced example)
    const start = istToUtc('2026-08-22T14:00:00'); // a Saturday
    const result = addBusinessHours(start, 24, [], config);
    const expected = istToUtc('2026-08-26T15:00:00'); // Wednesday
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('public holiday is excluded from business-hour calculations', () => {
    // Friday 17:00 + 4 hours, with Monday as a holiday = Tuesday 12:00
    const start = istToUtc('2026-08-21T17:00:00'); // Friday
    const monday = new Date('2026-08-24T00:00:00.000Z'); // the holiday date
    const result = addBusinessHours(start, 4, [monday], config);
    const expected = istToUtc('2026-08-25T12:00:00'); // Tuesday
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('weekend + holiday combination', () => {
    // Friday 17:00 + 4 hours, with BOTH Monday holiday, contributes zero either way
    // (weekend already contributes zero, so this should behave identically to
    // the holiday-only test above)
    const start = istToUtc('2026-08-21T17:00:00');
    const monday = new Date('2026-08-24T00:00:00.000Z');
    const result = addBusinessHours(start, 4, [monday], config);
    const expected = istToUtc('2026-08-25T12:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('SLA crossing multiple business days', () => {
    // Monday 09:00 + 20 hours (more than 2 full 9-hour days) = Wednesday 11:00
    // Mon: 9 hours (budget 20-9=11), Tue: 9 hours (budget 11-9=2), Wed: 09:00+2=11:00
    const start = istToUtc('2026-08-24T09:00:00');
    const result = addBusinessHours(start, 20, [], config);
    const expected = istToUtc('2026-08-26T11:00:00');
    expect(result.getTime()).toBe(expected.getTime());
  });
});


import { businessMinutesBetween } from '../../src/services/sla/businessHours';

describe('businessMinutesBetween', () => {
  it('is the inverse of addBusinessHours for a same-day case', () => {
    const start = istToUtc('2026-08-24T10:00:00');
    const deadline = addBusinessHours(start, 3, [], config);
    const minutes = businessMinutesBetween(start, deadline, [], config);
    expect(minutes).toBe(3 * 60);
  });

  it('is the inverse of addBusinessHours across a weekend', () => {
    const start = istToUtc('2026-08-21T17:00:00'); // Friday
    const deadline = addBusinessHours(start, 4, [], config);
    const minutes = businessMinutesBetween(start, deadline, [], config);
    expect(minutes).toBe(4 * 60);
  });

  it('is the inverse of addBusinessHours across a holiday', () => {
    const start = istToUtc('2026-08-21T17:00:00'); // Friday
    const monday = new Date('2026-08-24T00:00:00.000Z');
    const deadline = addBusinessHours(start, 4, [monday], config);
    const minutes = businessMinutesBetween(start, deadline, [monday], config);
    expect(minutes).toBe(4 * 60);
  });

  it('returns negative minutes when the second timestamp is earlier', () => {
    const later = istToUtc('2026-08-24T13:00:00');
    const earlier = istToUtc('2026-08-24T10:00:00');
    const minutes = businessMinutesBetween(later, earlier, [], config);
    expect(minutes).toBe(-3 * 60);
  });

  it('returns zero business minutes entirely within a weekend', () => {
    const satMorning = istToUtc('2026-08-22T08:00:00');
    const satEvening = istToUtc('2026-08-22T20:00:00');
    const minutes = businessMinutesBetween(satMorning, satEvening, [], config);
    expect(minutes).toBe(0);
  });
});
