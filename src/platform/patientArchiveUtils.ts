export type PatientArchiveView = 'active' | 'archived';

export interface PatientArchiveItem {
  uid: string;
  doc: { archivedAt?: string | null };
}

export function filterPatientsByArchiveView<T extends PatientArchiveItem>(
  patients: readonly T[],
  view: PatientArchiveView,
): T[] {
  return patients.filter(({ doc }) => {
    const archived = Boolean(doc.archivedAt);
    return view === 'archived' ? archived : !archived;
  });
}

export function isPatientArchived(archivedAt: string | null | undefined): boolean {
  return typeof archivedAt === 'string' && archivedAt.trim().length > 0;
}
