import { describe, expect, it } from 'vitest';
import {
  buildAppointmentTimeRange,
  filterAppointmentsForDashboard,
  getClinicAppointmentsQueryRange,
  getClinicMonthRange,
  getClinicWeekRange,
  summarizeAppointmentStatuses,
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


describe('clinic appointment reporting helpers', () => {
  it('returns local calendar-month boundaries with an exclusive end', () => {
    const november = getClinicMonthRange(new Date(2026, 10, 18, 12));
    expect(localDateKey(november.start)).toBe('2026-11-01');
    expect(localDateKey(november.end)).toBe('2026-12-01');

    const december = getClinicMonthRange(new Date(2026, 11, 31, 12));
    expect(localDateKey(december.start)).toBe('2026-12-01');
    expect(localDateKey(december.end)).toBe('2027-01-01');
  });

  it('includes the full current week when it crosses a month boundary', () => {
    const range = getClinicAppointmentsQueryRange(new Date(2026, 9, 31, 12)); // Saturday
    expect(localDateKey(range.start)).toBe('2026-10-01');
    expect(localDateKey(range.end)).toBe('2026-11-07');

    const firstOfMonth = getClinicAppointmentsQueryRange(new Date(2026, 10, 1, 12));
    expect(localDateKey(firstOfMonth.start)).toBe('2026-10-31');
    expect(localDateKey(firstOfMonth.end)).toBe('2026-12-01');
  });

  it('summarizes appointment outcomes without counting cancellations as missed attendance', () => {
    const summary = summarizeAppointmentStatuses([
      { status: 'scheduled' },
      { status: 'confirmed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'cancelled' },
      { status: 'cancelled' },
      { status: 'no_show' },
    ]);
    expect(summary).toEqual({
      total: 8,
      upcoming: 2,
      completed: 3,
      cancelled: 2,
      noShow: 1,
      attendanceRate: 75,
      cancellationRate: 25,
      noShowRate: 25,
    });
  });

  it('does not invent percentages when the denominator is empty', () => {
    expect(summarizeAppointmentStatuses([])).toEqual({
      total: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      attendanceRate: null,
      cancellationRate: null,
      noShowRate: null,
    });
  });
});


describe('filterAppointmentsForDashboard', () => {
  const weekDate = new Date(2026, 10, 22, 12);
  const week = getClinicWeekRange(weekDate);
  const month = getClinicMonthRange(weekDate);
  const today = localDateKey(weekDate);
  const rows = [
    { id: 'today-a', starts_at: new Date(2026, 10, 22, 10).toISOString(), status: 'scheduled' as const, provider_id: 'doctor-a' },
    { id: 'today-b', starts_at: new Date(2026, 10, 22, 11).toISOString(), status: 'confirmed' as const, provider_id: 'doctor-b' },
    { id: 'week-a', starts_at: new Date(2026, 10, 25, 10).toISOString(), status: 'completed' as const, provider_id: 'doctor-a' },
    { id: 'next-month', starts_at: new Date(2026, 11, 2, 10).toISOString(), status: 'scheduled' as const, provider_id: 'doctor-a' },
    { id: 'previous-week', starts_at: new Date(2026, 10, 20, 10).toISOString(), status: 'scheduled' as const, provider_id: 'doctor-a' },
  ];

  it('filters the week by provider without including adjacent-week rows', () => {
    const filtered = filterAppointmentsForDashboard(rows, {
      view: 'week',
      todayKey: today,
      weekStart: week.start,
      weekEnd: week.end,
      monthStart: month.start,
      monthEnd: month.end,
      providerId: 'doctor-a',
    });
    expect(filtered.map((item) => item.id)).toEqual(['today-a', 'week-a']);
  });

  it('supports month view and excludes the exclusive month end', () => {
    const filtered = filterAppointmentsForDashboard(rows, {
      view: 'month',
      todayKey: today,
      weekStart: week.start,
      weekEnd: week.end,
      monthStart: month.start,
      monthEnd: month.end,
      providerId: 'all',
    });
    expect(filtered.map((item) => item.id)).toEqual(['today-a', 'today-b', 'week-a']);
  });

  it('keeps today and unconfirmed views scoped to this week', () => {
    const common = {
      todayKey: today,
      weekStart: week.start,
      weekEnd: week.end,
      monthStart: month.start,
      monthEnd: month.end,
    };
    expect(filterAppointmentsForDashboard(rows, { ...common, view: 'today' }).map((item) => item.id))
      .toEqual(['today-a', 'today-b']);
    expect(filterAppointmentsForDashboard(rows, { ...common, view: 'unconfirmed' }).map((item) => item.id))
      .toEqual(['today-a']);
  });
});
