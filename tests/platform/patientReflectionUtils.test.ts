import { describe, expect, it } from 'vitest';
import {
  normalizePatientReflectionDraft,
  type PatientReflectionDraft,
} from '../../src/platform/patientReflectionUtils';

const valid: PatientReflectionDraft = {
  entryDate: '2026-11-22',
  content: '  شعرت بطاقة أفضل اليوم.  ',
  mood: 4,
  symptoms: '  لا توجد أعراض جديدة. ',
  visibility: 'private',
};

describe('patient private/shared reflections', () => {
  it('trims free text and keeps a private default-compatible draft', () => {
    expect(normalizePatientReflectionDraft(valid)).toEqual({
      ...valid,
      content: 'شعرت بطاقة أفضل اليوم.',
      symptoms: 'لا توجد أعراض جديدة.',
    });
  });

  it('accepts an entry containing only a mood score', () => {
    expect(normalizePatientReflectionDraft({
      ...valid,
      content: '',
      symptoms: '',
      mood: 3,
    }).mood).toBe(3);
  });

  it('rejects an empty entry', () => {
    expect(() => normalizePatientReflectionDraft({
      ...valid,
      content: ' ',
      symptoms: '',
      mood: null,
    })).toThrow('أضف ملاحظة');
  });

  it('rejects invalid mood values', () => {
    expect(() => normalizePatientReflectionDraft({ ...valid, mood: 6 })).toThrow('1 إلى 5');
    expect(() => normalizePatientReflectionDraft({ ...valid, mood: 2.5 })).toThrow('1 إلى 5');
  });

  it('rejects oversized content and symptoms', () => {
    expect(() => normalizePatientReflectionDraft({ ...valid, content: 'x'.repeat(2001) })).toThrow('2000 حرف');
    expect(() => normalizePatientReflectionDraft({ ...valid, symptoms: 'x'.repeat(1001) })).toThrow('1000 حرف');
  });

  it('rejects impossible dates and unsupported visibility values', () => {
    expect(() => normalizePatientReflectionDraft({ ...valid, entryDate: '2026-02-30' })).toThrow('تاريخ');
    expect(() => normalizePatientReflectionDraft({ ...valid, visibility: 'everyone' as 'private' })).toThrow('خصوصية');
  });

  it('preserves explicit shared visibility', () => {
    expect(normalizePatientReflectionDraft({ ...valid, visibility: 'shared' }).visibility).toBe('shared');
  });
});
