import { describe, expect, it } from 'vitest';
import { normalizePatientJournalComment } from '../../src/platform/patientJournalComments';

describe('patient journal staff comments', () => {
  it('trims the message before saving', () => {
    expect(normalizePatientJournalComment('  متابعة ممتازة، استمر  ')).toBe('متابعة ممتازة، استمر');
  });

  it('preserves line breaks in longer notes', () => {
    expect(normalizePatientJournalComment('النقطة الأولى\nالنقطة الثانية')).toBe('النقطة الأولى\nالنقطة الثانية');
  });

  it('rejects empty messages', () => {
    expect(() => normalizePatientJournalComment('   ')).toThrow('اكتب الملاحظة');
  });

  it('rejects notes above 1200 characters', () => {
    expect(() => normalizePatientJournalComment('x'.repeat(1201))).toThrow('1200 حرف');
  });

  it('accepts the maximum supported length', () => {
    expect(normalizePatientJournalComment('x'.repeat(1200))).toHaveLength(1200);
  });
});
