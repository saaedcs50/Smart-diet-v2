import {
  appointmentChannelLabel,
  appointmentStatusLabel,
  appointmentVisitTypeLabel,
} from './appointmentUtils';

export interface AppointmentExportRow {
  startsAt: string;
  endsAt: string;
  patientName: string;
  providerName: string;
  visitType: 'initial_consultation' | 'follow_up' | 'measurement_review';
  channel: 'in_person' | 'video' | 'phone';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
}

function safeCsvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  const protectedText = /^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text;
  return '"' + protectedText.replace(/"/g, '""') + '"';
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/** Builds a clinic-scoped export without notes, clinical details, or internal identifiers. */
export function buildAppointmentsCsv(rows: readonly AppointmentExportRow[]): string {
  const headers = [
    'تاريخ ووقت البداية',
    'تاريخ ووقت النهاية',
    'المريض',
    'الطبيب',
    'نوع الزيارة',
    'طريقة الجلسة',
    'الحالة',
  ];
  const lines = [
    headers.map(safeCsvCell).join(','),
    ...rows.map((row) => [
      formatTimestamp(row.startsAt),
      formatTimestamp(row.endsAt),
      row.patientName,
      row.providerName,
      appointmentVisitTypeLabel(row.visitType),
      appointmentChannelLabel(row.channel),
      appointmentStatusLabel(row.status),
    ].map(safeCsvCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
