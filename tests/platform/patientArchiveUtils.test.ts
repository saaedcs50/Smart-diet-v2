import { describe, expect, it } from 'vitest';
import {
  filterPatientsByArchiveView,
  isPatientArchived,
  type PatientArchiveItem,
} from '../../src/platform/patientArchiveUtils';

const patients: PatientArchiveItem[] = [
  { uid: 'active-a', doc: {} },
  { uid: 'archived-a', doc: { archivedAt: '2026-11-22T10:00:00.000Z' } },
  { uid: 'active-b', doc: { archivedAt: null } },
];

describe('patient archive visibility', () => {
  it('shows active records by default and excludes archived records', () => {
    expect(filterPatientsByArchiveView(patients, 'active').map((p) => p.uid)).toEqual([
      'active-a',
      'active-b',
    ]);
  });

  it('shows archived records only in the archive view', () => {
    expect(filterPatientsByArchiveView(patients, 'archived').map((p) => p.uid)).toEqual([
      'archived-a',
    ]);
  });

  it('treats null, empty and whitespace timestamps as active', () => {
    expect(isPatientArchived(null)).toBe(false);
    expect(isPatientArchived('')).toBe(false);
    expect(isPatientArchived('  ')).toBe(false);
  });

  it('recognizes a stored archive timestamp', () => {
    expect(isPatientArchived('2026-11-22T10:00:00.000Z')).toBe(true);
  });

  it('handles an empty list without mutating the source', () => {
    expect(filterPatientsByArchiveView([], 'active')).toEqual([]);
    expect(patients).toHaveLength(3);
  });
});
