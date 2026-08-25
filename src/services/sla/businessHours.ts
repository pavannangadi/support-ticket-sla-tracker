import { DateTime } from 'luxon';

export interface BusinessHoursConfig {
  timezone: string;
  startHour: number;
  endHour: number;
}

export const defaultBusinessHoursConfig: BusinessHoursConfig = {
  timezone: process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata',
  startHour: 9,
  endHour: 18,
};

function toHolidaySet(holidayDates: Date[]): Set<string> {
  return new Set(
    holidayDates.map((d) => DateTime.fromJSDate(d, { zone: 'utc' }).toFormat('yyyy-MM-dd'))
  );
}

function isWeekday(date: DateTime): boolean {
  return date.weekday >= 1 && date.weekday <= 5;
}

function isHoliday(date: DateTime, holidaySet: Set<string>): boolean {
  return holidaySet.has(date.toFormat('yyyy-MM-dd'));
}

function isBusinessDay(date: DateTime, holidaySet: Set<string>): boolean {
  return isWeekday(date) && !isHoliday(date, holidaySet);
}

function startOfBusinessDay(date: DateTime, config: BusinessHoursConfig): DateTime {
  return date.set({ hour: config.startHour, minute: 0, second: 0, millisecond: 0 });
}

function endOfBusinessDay(date: DateTime, config: BusinessHoursConfig): DateTime {
  return date.set({ hour: config.endHour, minute: 0, second: 0, millisecond: 0 });
}

/**
 * Adds N business hours to a starting UTC timestamp, skipping nights,
 * weekends, and configured holidays. Returns the resulting UTC timestamp.
 */
export function addBusinessHours(
  startUtc: Date,
  hoursToAdd: number,
  holidayDates: Date[],
  config: BusinessHoursConfig = defaultBusinessHoursConfig
): Date {
  const holidaySet = toHolidaySet(holidayDates);
  let current: DateTime = DateTime.fromJSDate(startUtc, { zone: 'utc' }).setZone(config.timezone);
  let remainingHours = hoursToAdd;

  while (remainingHours > 0) {
    if (!isBusinessDay(current, holidaySet)) {
      current = startOfBusinessDay(current.plus({ days: 1 }), config);
      continue;
    }

    const dayStart = startOfBusinessDay(current, config);
    const dayEnd = endOfBusinessDay(current, config);
    const effectiveStart = current < dayStart ? dayStart : current;

    if (effectiveStart >= dayEnd) {
      current = startOfBusinessDay(current.plus({ days: 1 }), config);
      continue;
    }

    const availableHoursToday = dayEnd.diff(effectiveStart, 'hours').hours;

    if (availableHoursToday >= remainingHours) {
      const result = effectiveStart.plus({ hours: remainingHours });
      return result.toUTC().toJSDate();
    }

    remainingHours -= availableHoursToday;
    current = startOfBusinessDay(current.plus({ days: 1 }), config);
  }

  return current.toUTC().toJSDate();
}

/**
 * Computes the number of business minutes that elapse between two UTC
 * timestamps, respecting business hours, weekends, and holidays.
 * Returns a negative value if `toUtc` is before `fromUtc`.
 */
export function businessMinutesBetween(
  fromUtc: Date,
  toUtc: Date,
  holidayDates: Date[],
  config: BusinessHoursConfig = defaultBusinessHoursConfig
): number {
  const holidaySet = toHolidaySet(holidayDates);

  let start = DateTime.fromJSDate(fromUtc, { zone: 'utc' }).setZone(config.timezone);
  let end = DateTime.fromJSDate(toUtc, { zone: 'utc' }).setZone(config.timezone);
  let sign = 1;

  if (end < start) {
    const temp = start;
    start = end;
    end = temp;
    sign = -1;
  }

  let totalMinutes = 0;
  let cursor: DateTime = start;

  while (cursor < end) {
    if (!isBusinessDay(cursor, holidaySet)) {
      cursor = startOfBusinessDay(cursor.plus({ days: 1 }), config);
      continue;
    }

    const dayStart = startOfBusinessDay(cursor, config);
    const dayEnd = endOfBusinessDay(cursor, config);
    const segmentStart = cursor < dayStart ? dayStart : cursor;
    const segmentEnd = end < dayEnd ? end : dayEnd;

    if (segmentStart < segmentEnd) {
      totalMinutes += segmentEnd.diff(segmentStart, 'minutes').minutes;
    }

    if (end <= dayEnd) {
      break;
    }

    cursor = startOfBusinessDay(cursor.plus({ days: 1 }), config);
  }

  return sign * totalMinutes;
}