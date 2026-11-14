import { describe, expect, it } from 'vitest';
import {
  MAX_PATIENT_TAGS,
  normalizePatientTags,
  patientTagColorClass,
} from '../src/platform/patientTags';

describe('patient custom tags', () => {
  it('normalizes labels, trims text, and accepts only supported colors', () => {
    expect(normalizePatientTags([
      { id: 'a', label: ' متابعة   أسبوعية ', color: 'blue' },
      { id: 'b', label: ' يحتاج اتصال ', color: 'not-a-color' },
    ])).toEqual([
      { id: 'a', label: 'متابعة أسبوعية', color: 'blue' },
      { id: 'b', label: 'يحتاج اتصال', color: 'slate' },
    ]);
  });

  it('rejects invalid rows, empty labels and duplicate IDs', () => {
    expect(normalizePatientTags([
      null,
      'bad',
      { id: 'a', label: 'وسم', color: 'rose' },
      { id: 'a', label: 'تكرار', color: 'green' },
      { id: 'b', label: '   ', color: 'blue' },
      { id: 12, label: 'غير صالح', color: 'blue' },
    ])).toEqual([{ id: 'a', label: 'وسم', color: 'rose' }]);
  });

  it('limits the array to 20 entries and truncates labels to 32 characters', () => {
    const tags = Array.from({ length: MAX_PATIENT_TAGS + 5 }, (_, index) => ({
      id: `tag-${index}`,
      label: 'س'.repeat(50),
      color: 'teal',
    }));
    const normalized = normalizePatientTags(tags);
    expect(normalized).toHaveLength(MAX_PATIENT_TAGS);
    expect(normalized[0].label).toHaveLength(32);
  });

  it('provides fixed classes for each supported color', () => {
    expect(patientTagColorClass('rose')).toContain('rose');
    expect(patientTagColorClass('teal')).toContain('teal');
  });
});
