import type { PatientProgressSummary } from './patientProgressSummary';

export interface PatientFollowUpCandidate {
  uid: string;
  name: string;
  progress: PatientProgressSummary | null;
  doctorName?: string | null;
  whatsappPhone?: string | null;
  whatsappConsentAt?: string | null;
}

/** Prioritizes patients with no recent record, then the oldest last record. */
function compareFollowUpCandidates(
  left: PatientFollowUpCandidate,
  right: PatientFollowUpCandidate,
): number {
  const leftDays = left.progress?.daysSinceLastLog ?? null;
  const rightDays = right.progress?.daysSinceLastLog ?? null;

  if (leftDays == null && rightDays != null) return -1;
  if (rightDays == null && leftDays != null) return 1;
  if (leftDays != null && rightDays != null && leftDays !== rightDays) {
    return rightDays - leftDays;
  }

  const leftCompletion = left.progress?.completion7d ?? null;
  const rightCompletion = right.progress?.completion7d ?? null;
  if (leftCompletion == null && rightCompletion != null) return 1;
  if (rightCompletion == null && leftCompletion != null) return -1;
  if (leftCompletion != null && rightCompletion != null && leftCompletion !== rightCompletion) {
    return leftCompletion - rightCompletion;
  }

  return left.name.localeCompare(right.name, 'ar');
}

/**
 * Keeps this panel role-scoped: callers must supply only the patient rows
 * already loaded for their authenticated role. Missing progress is not
 * interpreted as a follow-up requirement.
 */
export function buildPatientFollowUpQueue(
  candidates: readonly PatientFollowUpCandidate[],
  limit = 8,
): PatientFollowUpCandidate[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const safeLimit = Math.min(50, Math.floor(limit));
  if (safeLimit < 1) return [];

  const unique = new Map<string, PatientFollowUpCandidate>();
  for (const candidate of candidates) {
    if (!candidate.uid.trim() || candidate.progress?.needsFollowUp !== true) continue;
    const previous = unique.get(candidate.uid);
    if (!previous || compareFollowUpCandidates(candidate, previous) < 0) {
      unique.set(candidate.uid, candidate);
    }
  }

  return [...unique.values()]
    .sort(compareFollowUpCandidates)
    .slice(0, safeLimit);
}
