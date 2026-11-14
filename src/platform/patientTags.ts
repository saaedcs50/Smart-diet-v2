export const PATIENT_TAG_COLORS = [
  'slate',
  'blue',
  'green',
  'amber',
  'rose',
  'violet',
  'teal',
] as const;

export type PatientTagColor = (typeof PATIENT_TAG_COLORS)[number];

export interface PatientTag {
  id: string;
  label: string;
  color: PatientTagColor;
}

export const MAX_PATIENT_TAGS = 20;
export const MAX_PATIENT_TAG_LABEL_LENGTH = 32;

const allowedColors = new Set<string>(PATIENT_TAG_COLORS);

/** Safely normalizes tags read from the database or supplied to the save function. */
export function normalizePatientTags(value: unknown): PatientTag[] {
  if (!Array.isArray(value)) return [];
  const tags: PatientTag[] = [];
  const seenIds = new Set<string>();

  for (const item of value) {
    if (tags.length >= MAX_PATIENT_TAGS) break;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.label !== 'string') continue;
    const id = candidate.id.trim().slice(0, 64);
    const label = candidate.label.trim().replace(/\s+/g, ' ').slice(0, MAX_PATIENT_TAG_LABEL_LENGTH);
    if (!id || !label || seenIds.has(id)) continue;

    const color: PatientTagColor =
      typeof candidate.color === 'string' && allowedColors.has(candidate.color)
        ? candidate.color as PatientTagColor
        : 'slate';

    seenIds.add(id);
    tags.push({ id, label, color });
  }

  return tags;
}

export function patientTagColorClass(color: PatientTagColor): string {
  const classes: Record<PatientTagColor, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900',
    green: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900',
    amber: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900',
    rose: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-900',
    violet: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-900',
    teal: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-900',
  };
  return classes[color];
}
