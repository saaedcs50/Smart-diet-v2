import { describe, expect, it } from 'vitest';
import {
  buildAppointmentTimeRange,
  getClinicWeekRange,
  localDateKey,
  parseDateTimeLocal,
  toDateTimeLocalValue,
} from '../../src/platform/appointmentUtils';

describe('clinic appointment date helpers', () => {
  it('starts the clinic week on Saturday and uses an exclusive seven-day end', () => {
    const date = new Date(2026, 10, 18, 12, 0, 0); // Wednesday
    const range = getClinicWeekRange(date);
    expect(localDateKey(range.start)).toBe('2026-11-14');
    expect(localDateKey(range.end)).toBe('2026-11-21');
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getHours()).toBe(0);
  });

  it('round-trips a local datetime value without shifting its calendar fields', () => {
    const value = '2026-11-14T09:45';
    const parsed = parseDateTimeLocal(value);
    expect(parsed).not.toBeNull();
    expect(toDateTimeLocalValue(parsed!)).toBe(value);
  });

  it('rejects impossible and malformed local datetime values', () => {
    expect(parseDateTimeLocal('2026-02-30T10:00')).toBeNull();
    expect(parseDateTimeLocal('2026-11-14T25:00')).toBeNull();
    expect(parseDateTimeLocal('not-a-date')).toBeNull();
  });

  it('builds a valid ISO range only for supported durations', () => {
    const range = buildAppointmentTimeRange('2026-11-14T09:00', 45);
    expect(range).not.toBeNull();
    expect(new Date(range!.endsAt).getTime() - new Date(range!.startsAt).getTime()).toBe(45 * 60_000);
    expect(buildAppointmentTimeRange('2026-11-14T09:00', 10)).toBeNull();
    expect(buildAppointmentTimeRange('2026-11-14T09:00', 181)).toBeNull();
    expect(buildAppointmentTimeRange('2026-02-30T09:00', 30)).toBeNull();
  });
});
