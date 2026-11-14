import { describe, expect, it } from 'vitest';
import { matchesBodySearch, normalizeBodySearchQuery } from '../src/utils/bodySearch';

describe('Arabic-aware body search', () => {
  it('normalizes common Arabic letter variants and diacritics', () => {
    expect(normalizeBodySearchQuery('إِختبارٌ')).toBe('اختبار');
    expect(normalizeBodySearchQuery('قياسات الأُرداف')).toBe('قياسات الارداف');
  });

  it('matches normalized Arabic words and numbers', () => {
    expect(matchesBodySearch('الارداف', ['محيط الأرداف (الهيبس)'])).toBe(true);
    expect(matchesBodySearch('95', ['قيمة التحليل', 95])).toBe(true);
    expect(matchesBodySearch('الوزن', ['محيط الخصر'])).toBe(false);
  });

  it('treats an empty query as matching all content', () => {
    expect(matchesBodySearch('  ', ['أي محتوى'])).toBe(true);
  });
});
