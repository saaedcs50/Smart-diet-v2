import { describe, expect, it } from 'vitest';
import {
  buildClinicActivityFeed,
  type ClinicActivityPatient,
} from '../../src/platform/clinicActivityFeed';

const doctors = new Map([
  ['doctor-a', 'دكتور أحمد'],
  ['doctor-b', 'دكتورة منى'],
]);

function patient(
  overrides: Partial<ClinicActivityPatient> = {},
): ClinicActivityPatient {
  return {
    uid: 'patient-a',
    name: 'مريض أ',
    assignedDoctorUid: 'doctor-a',
    createdAt: '2026-11-10T09:00:00.000Z',
    ...overrides,
  };
}

describe('buildClinicActivityFeed', () => {
  it('combines file creation, plan saves and daily logs in newest-first order', () => {
    const events = buildClinicActivityFeed([
      patient({
        createdAt: '2026-11-10T09:00:00.000Z',
        planUpdatedAt: '2026-11-21T11:30:00.000Z',
        planUpdatedBy: 'doctor-a',
      }),
    ], [
      { patientUid: 'patient-a', date: '2026-11-22' },
    ], doctors);

    expect(events.map((event) => event.kind)).toEqual([
      'daily_log',
      'plan_saved',
      'patient_created',
    ]);
    expect(events[0].assignedDoctorName).toBe('دكتور أحمد');
    expect(events[1].actorName).toBe('دكتور أحمد');
    expect(events[2].patientName).toBe('مريض أ');
  });

  it('does not show a daily log for a patient outside the supplied role scope', () => {
    const events = buildClinicActivityFeed(
      [patient()],
      [
        { patientUid: 'patient-a', date: '2026-11-22' },
        { patientUid: 'patient-outside-scope', date: '2026-11-22' },
      ],
      doctors,
    );
    expect(events.filter((event) => event.kind === 'daily_log')).toHaveLength(1);
    expect(events.every((event) => event.patientUid === 'patient-a')).toBe(true);
  });

  it('ignores invalid dates, missing plan timestamps and unknown patients', () => {
    const events = buildClinicActivityFeed([
      patient({ createdAt: 'not-a-date', planUpdatedAt: null }),
    ], [
      { patientUid: 'patient-a', date: '2026-02-30' },
      { patientUid: 'patient-a', date: '22-11-2026' },
      { patientUid: 'unknown', date: '2026-11-22' },
    ], doctors);
    expect(events).toEqual([]);
  });

  it('deduplicates patients/logs and applies a bounded event limit', () => {
    const events = buildClinicActivityFeed([
      patient(),
      patient({ createdAt: '2026-11-10T09:00:00.000Z' }),
      patient({ uid: 'patient-b', name: 'مريض ب', createdAt: '2026-11-09T09:00:00.000Z' }),
    ], [
      { patientUid: 'patient-a', date: '2026-11-22' },
      { patientUid: 'patient-a', date: '2026-11-22' },
      { patientUid: 'patient-b', date: '2026-11-20' },
    ], doctors, 3);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect(events).toHaveLength(3);
    expect(buildClinicActivityFeed([patient()], [], doctors, 0)).toEqual([]);
  });
});
