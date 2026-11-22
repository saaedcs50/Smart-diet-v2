export const MAX_OPEN_PATIENT_HUBS = 3;

/**
 * Opens a patient hub without duplicates and keeps the most recently opened
 * hubs when the dock reaches its visible window limit.
 */
export function addPatientHub(
  current: readonly string[],
  patientUid: string,
  max = MAX_OPEN_PATIENT_HUBS,
): string[] {
  const uid = String(patientUid ?? '').trim();
  const limit = Number.isFinite(max) ? Math.max(1, Math.min(5, Math.floor(max))) : MAX_OPEN_PATIENT_HUBS;
  if (!uid) return [...current].slice(-limit);
  if (current.includes(uid)) return [...current].slice(-limit);
  return [...current, uid].slice(-limit);
}

export function removePatientHub(
  current: readonly string[],
  patientUid: string,
): string[] {
  return current.filter((uid) => uid !== patientUid);
}
