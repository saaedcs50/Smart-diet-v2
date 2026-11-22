export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentVisitType =
  | 'initial_consultation'
  | 'follow_up'
  | 'measurement_review';

export type AppointmentChannel = 'in_person' | 'video' | 'phone';

export interface AppointmentTimeRange {
  startsAt: string;
  endsAt: string;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The clinic work week starts on Saturday (Egypt local calendar). */
export function getClinicWeekRange(date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceSaturday = (start.getDay() + 1) % 7;
  start.setDate(start.getDate() - daysSinceSaturday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/** Calendar-month range in the clinic's local timezone; end is exclusive. */
export function getClinicMonthRange(date = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

/** Covers both the current calendar month and any week days crossing its edges. */
export function getClinicAppointmentsQueryRange(date = new Date()): { start: Date; end: Date } {
  const week = getClinicWeekRange(date);
  const month = getClinicMonthRange(date);
  return {
    start: week.start < month.start ? week.start : month.start,
    end: week.end > month.end ? week.end : month.end,
  };
}

export interface AppointmentStatusSummary {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  attendanceRate: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
}

export type AppointmentDashboardView = 'today' | 'week' | 'month' | 'unconfirmed';

export interface AppointmentDashboardFilterOptions {
  view: AppointmentDashboardView;
  todayKey: string;
  weekStart: Date;
  weekEnd: Date;
  monthStart: Date;
  monthEnd: Date;
  providerId?: string | null;
}

/** Filters already role-scoped appointment rows by date view and optional doctor. */
export function filterAppointmentsForDashboard<T extends {
  starts_at: string;
  status: AppointmentStatus;
  provider_id: string;
}>(
  appointments: readonly T[],
  options: AppointmentDashboardFilterOptions,
): T[] {
  const rangeStart = options.view === 'month'
    ? options.monthStart.getTime()
    : options.weekStart.getTime();
  const rangeEnd = options.view === 'month'
    ? options.monthEnd.getTime()
    : options.weekEnd.getTime();

  return appointments.filter((appointment) => {
    const startsAt = new Date(appointment.starts_at);
    const timestamp = startsAt.getTime();
    if (!Number.isFinite(timestamp) || timestamp < rangeStart || timestamp >= rangeEnd) {
      return false;
    }
    if (options.view === 'today' && localDateKey(startsAt) !== options.todayKey) {
      return false;
    }
    if (options.view === 'unconfirmed' && appointment.status !== 'scheduled') {
      return false;
    }
    if (options.providerId && options.providerId !== 'all' &&
        appointment.provider_id !== options.providerId) {
      return false;
    }
    return true;
  });
}

/**
 * Rates are descriptive booking outcomes:
 * - attendance = completed / (completed + no-show), excluding cancellations
 * - cancellation = cancelled / all appointments in the selected period
 * - no-show = no-show / (completed + no-show), excluding cancellations
 */
export function summarizeAppointmentStatuses(
  appointments: readonly { status: AppointmentStatus }[],
): AppointmentStatusSummary {
  const scheduled = appointments.filter((item) => item.status === 'scheduled').length;
  const confirmed = appointments.filter((item) => item.status === 'confirmed').length;
  const completed = appointments.filter((item) => item.status === 'completed').length;
  const cancelled = appointments.filter((item) => item.status === 'cancelled').length;
  const noShow = appointments.filter((item) => item.status === 'no_show').length;
  const attendanceDenominator = completed + noShow;
  const total = appointments.length;

  const percentage = (numerator: number, denominator: number): number | null =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;

  return {
    total,
    upcoming: scheduled + confirmed,
    completed,
    cancelled,
    noShow,
    attendanceRate: percentage(completed, attendanceDenominator),
    cancellationRate: percentage(cancelled, total),
    noShowRate: percentage(noShow, attendanceDenominator),
  };
}

export function toDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Parse datetime-local without a UTC offset; reject impossible calendar values. */
export function parseDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) return null;
  return date;
}

export function buildAppointmentTimeRange(
  startsAtLocal: string,
  durationMinutes: number,
): AppointmentTimeRange | null {
  const start = parseDateTimeLocal(startsAtLocal);
  if (!start || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 180) {
    return null;
  }
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

export function appointmentStatusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled': return 'بانتظار التأكيد';
    case 'confirmed': return 'مؤكد';
    case 'completed': return 'مكتمل';
    case 'cancelled': return 'ملغي';
    case 'no_show': return 'لم يحضر';
  }
}

export function appointmentVisitTypeLabel(type: AppointmentVisitType): string {
  switch (type) {
    case 'initial_consultation': return 'استشارة أولى';
    case 'follow_up': return 'متابعة';
    case 'measurement_review': return 'مراجعة قياسات';
  }
}

export function appointmentChannelLabel(channel: AppointmentChannel): string {
  switch (channel) {
    case 'in_person': return 'حضوري';
    case 'video': return 'مكالمة فيديو';
    case 'phone': return 'مكالمة هاتفية';
  }
}
