export type ClinicActivityKind = 'patient_created' | 'plan_saved' | 'daily_log';

export interface ClinicActivityPatient {
  uid: string;
  name: string;
  assignedDoctorUid?: string | null;
  createdAt?: string | null;
  planUpdatedAt?: string | null;
  planUpdatedBy?: string | null;
}

export interface ClinicActivityLog {
  patientUid: string;
  date: string;
}

export interface ClinicActivityEvent {
  id: string;
  kind: ClinicActivityKind;
  patientUid: string;
  patientName: string;
  assignedDoctorName: string | null;
  actorName: string | null;
  occurredAt: string;
  dateOnly: boolean;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseLocalDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

/**
 * Builds an activity feed only from patients and logs already scoped by the
 * caller's role. It reports recorded events; it does not infer plan edits
 * from generic patient-row updates or classify clinical weight changes.
 */
export function buildClinicActivityFeed(
  patients: readonly ClinicActivityPatient[],
  dailyLogs: readonly ClinicActivityLog[],
  doctorNameByUid: ReadonlyMap<string, string>,
  limit = 12,
): ClinicActivityEvent[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const safeLimit = Math.min(50, Math.floor(limit));
  if (safeLimit < 1) return [];

  const patientByUid = new Map<string, ClinicActivityPatient>();
  for (const patient of patients) {
    if (patient.uid.trim() && !patientByUid.has(patient.uid)) {
      patientByUid.set(patient.uid, patient);
    }
  }

  const events: Array<{ event: ClinicActivityEvent; sortAt: number }> = [];
  for (const patient of patientByUid.values()) {
    const assignedDoctorName = patient.assignedDoctorUid
      ? doctorNameByUid.get(patient.assignedDoctorUid) ?? 'طبيب غير متاح'
      : 'بلا طبيب معيّن';

    const createdAt = parseTimestamp(patient.createdAt);
    if (createdAt != null) {
      events.push({
        event: {
          id: 'patient-created:' + patient.uid,
          kind: 'patient_created',
          patientUid: patient.uid,
          patientName: patient.name || 'مريض',
          assignedDoctorName,
          actorName: null,
          occurredAt: new Date(createdAt).toISOString(),
          dateOnly: false,
        },
        sortAt: createdAt,
      });
    }

    const planUpdatedAt = parseTimestamp(patient.planUpdatedAt);
    if (planUpdatedAt != null) {
      events.push({
        event: {
          id: 'plan-saved:' + patient.uid + ':' + new Date(planUpdatedAt).toISOString(),
          kind: 'plan_saved',
          patientUid: patient.uid,
          patientName: patient.name || 'مريض',
          assignedDoctorName,
          actorName: patient.planUpdatedBy
            ? doctorNameByUid.get(patient.planUpdatedBy) ?? 'فريق العيادة'
            : 'فريق العيادة',
          occurredAt: new Date(planUpdatedAt).toISOString(),
          dateOnly: false,
        },
        sortAt: planUpdatedAt,
      });
    }
  }

  for (const log of dailyLogs) {
    const patient = patientByUid.get(log.patientUid);
    if (!patient) continue;
    const timestamp = parseLocalDate(log.date);
    if (timestamp == null) continue;
    events.push({
      event: {
        id: 'daily-log:' + log.patientUid + ':' + log.date,
        kind: 'daily_log',
        patientUid: log.patientUid,
        patientName: patient.name || 'مريض',
        assignedDoctorName: patient.assignedDoctorUid
          ? doctorNameByUid.get(patient.assignedDoctorUid) ?? 'طبيب غير متاح'
          : 'بلا طبيب معيّن',
        actorName: null,
        occurredAt: new Date(timestamp).toISOString(),
        dateOnly: true,
      },
      sortAt: timestamp,
    });
  }

  const unique = new Map<string, { event: ClinicActivityEvent; sortAt: number }>();
  for (const entry of events) {
    if (!unique.has(entry.event.id)) unique.set(entry.event.id, entry);
  }

  return [...unique.values()]
    .sort((a, b) => b.sortAt - a.sortAt || a.event.id.localeCompare(b.event.id))
    .slice(0, safeLimit)
    .map((entry) => entry.event);
}
