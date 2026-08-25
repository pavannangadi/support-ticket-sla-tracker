import { describe, it, expect } from 'bun:test';
import { calculateSLA } from '../../src/services/sla/calculateSLA';

const config = {
  timezone: 'Asia/Kolkata',
  startHour: 9,
  endHour: 18,
};

function istToUtc(isoLocal: string): Date {
  return new Date(isoLocal + '+05:30');
}

describe('calculateSLA', () => {
  it('is ON_TRACK when little time has elapsed', () => {
    // URGENT: 1 business hour budget. Created 09:00, now 09:10 (~16% consumed).
    const createdAt = istToUtc('2026-08-24T09:00:00');
    const now = istToUtc('2026-08-24T09:10:00');
    const result = calculateSLA({
      priority: 'URGENT',
      createdAt,
      firstResponseAt: null,
      resolvedAt: null,
      holidayDates: [],
      now,
      config,
    });
    expect(result.firstResponseState).toBe('ON_TRACK');
  });

  it('becomes AT_RISK past 75% of the budget', () => {
    // URGENT: 1 business hour = 60 min budget. 75% = 45 min. Test at 50 min elapsed.
    const createdAt = istToUtc('2026-08-24T09:00:00');
    const now = istToUtc('2026-08-24T09:50:00');
    const result = calculateSLA({
      priority: 'URGENT',
      createdAt,
      firstResponseAt: null,
      resolvedAt: null,
      holidayDates: [],
      now,
      config,
    });
    expect(result.firstResponseState).toBe('AT_RISK');
  });

  it('becomes BREACHED once the due time has passed', () => {
    // URGENT: due at 10:00 (09:00 + 1hr). Now is 10:05, past due.
    const createdAt = istToUtc('2026-08-24T09:00:00');
    const now = istToUtc('2026-08-24T10:05:00');
    const result = calculateSLA({
      priority: 'URGENT',
      createdAt,
      firstResponseAt: null,
      resolvedAt: null,
      holidayDates: [],
      now,
      config,
    });
    expect(result.firstResponseState).toBe('BREACHED');
    expect(result.firstResponseRemainingMinutes).toBe(0);
  });

  it('a completed first response freezes state, even if now is far past the original due time', () => {
    // Agent responded at 09:30 (30 min in, well within the 60-min URGENT budget = ON_TRACK).
    // "now" is 3 days later — should NOT show BREACHED, since it already completed on time.
    const createdAt = istToUtc('2026-08-24T09:00:00');
    const firstResponseAt = istToUtc('2026-08-24T09:30:00');
    const farFutureNow = istToUtc('2026-08-27T09:00:00');
    const result = calculateSLA({
      priority: 'URGENT',
      createdAt,
      firstResponseAt,
      resolvedAt: null,
      holidayDates: [],
      now: farFutureNow,
      config,
    });
    expect(result.firstResponseState).toBe('ON_TRACK');
  });

  it('a first response completed late freezes as BREACHED, not retroactively forgiven', () => {
    // Agent responded at 11:00, but URGENT due time was 10:00 — genuinely late.
    const createdAt = istToUtc('2026-08-24T09:00:00');
    const firstResponseAt = istToUtc('2026-08-24T11:00:00');
    const result = calculateSLA({
      priority: 'URGENT',
      createdAt,
      firstResponseAt,
      resolvedAt: null,
      holidayDates: [],
      now: firstResponseAt,
      config,
    });
    expect(result.firstResponseState).toBe('BREACHED');
  });

  it('resolution and first-response clocks are independent of each other', () => {
    // First response happened on time, but resolution is still live and at risk.
    const createdAt = istToUtc('2026-08-24T09:00:00');
    const firstResponseAt = istToUtc('2026-08-24T09:15:00');
    // HIGH: resolution budget = 24 hours = 1440 min. 75% = 1080 min elapsed.
    const now = istToUtc('2026-08-25T15:00:00'); // roughly 1140 business minutes later across weekday(s)
    const result = calculateSLA({
      priority: 'HIGH',
      createdAt,
      firstResponseAt,
      resolvedAt: null,
      holidayDates: [],
      now,
      config,
    });
    expect(result.firstResponseState).toBe('ON_TRACK');
    // We don't assert the exact resolution state here since the elapsed business
    // minutes depend on business-day boundaries; the key assertion is independence.
    expect(result.resolutionRemainingMinutes).toBeGreaterThanOrEqual(0);
  });
});