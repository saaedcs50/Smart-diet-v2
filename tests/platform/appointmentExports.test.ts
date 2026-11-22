import { describe, expect, it } from 'vitest';
import { buildAppointmentsCsv } from '../../src/platform/appointmentExports';

describe('buildAppointmentsCsv', () => {
  it('exports only the defined scheduling fields with an Arabic header and UTF-8 BOM', () => {
    const csv = buildAppointmentsCsv([{
      startsAt: '2026-11-22T08:00:00.000Z',
      endsAt: '2026-11-22T08:30:00.000Z',
      patientName: 'مريض تجريبي',
      providerName: 'دكتور أحمد',
      visitType: 'follow_up',
      channel: 'in_person',
      status: 'confirmed',
    }]);

    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('"تاريخ ووقت البداية"');
    expect(csv).toContain('"المريض"');
    expect(csv).toContain('"دكتور أحمد"');
    expect(csv).toContain('"متابعة"');
    expect(csv).toContain('"حضوري"');
    expect(csv).toContain('"مؤكد"');
    expect(csv).not.toMatch(/clinical_note|diagnosis|patient_id|clinic_id/i);
  });

  it('quotes commas, quotes and line breaks in names', () => {
    const csv = buildAppointmentsCsv([{
      startsAt: '2026-11-22T08:00:00.000Z',
      endsAt: '2026-11-22T08:30:00.000Z',
      patientName: 'مريض، "تجريبي"\nسطر ثانٍ',
      providerName: 'دكتور، أحمد',
      visitType: 'initial_consultation',
      channel: 'video',
      status: 'scheduled',
    }]);

    expect(csv).toContain('"مريض، ""تجريبي""\nسطر ثانٍ"');
    expect(csv).toContain('"دكتور، أحمد"');
  });

  it('neutralizes spreadsheet formula prefixes in untrusted names', () => {
    const csv = buildAppointmentsCsv([{
      startsAt: '2026-11-22T08:00:00.000Z',
      endsAt: '2026-11-22T08:30:00.000Z',
      patientName: '=HYPERLINK("https://example.invalid")',
      providerName: '+SUM(1,1)',
      visitType: 'follow_up',
      channel: 'phone',
      status: 'scheduled',
    }]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+SUM");
  });

  it('returns headers only for an empty result set', () => {
    const csv = buildAppointmentsCsv([]);
    expect(csv).toContain('"تاريخ ووقت البداية"');
    expect(csv.trim().split('\r\n')).toHaveLength(1);
  });
});
