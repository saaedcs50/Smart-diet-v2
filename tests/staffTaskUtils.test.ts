import { describe, expect, it } from 'vitest';
import {
  countStaffTasksByStatus,
  isStaffTaskOverdue,
  normalizeStaffTaskTitle,
} from '../src/platform/staffTaskUtils';

describe('staff task helpers', () => {
  it('trims whitespace and collapses repeated spaces', () => {
    expect(normalizeStaffTaskTitle('  متابعة   ملف   العيادة  ')).toBe('متابعة ملف العيادة');
  });

  it('rejects empty titles', () => {
    expect(() => normalizeStaffTaskTitle('   ')).toThrow('اكتب عنوان المهمة أولًا.');
  });

  it('rejects titles longer than 140 characters', () => {
    expect(() => normalizeStaffTaskTitle('x'.repeat(141))).toThrow('140 حرفًا');
  });

  it('marks only unfinished past-due tasks as overdue', () => {
    expect(isStaffTaskOverdue('2026-11-20', 'open', '2026-11-22')).toBe(true);
    expect(isStaffTaskOverdue('2026-11-22', 'open', '2026-11-22')).toBe(false);
    expect(isStaffTaskOverdue('2026-11-20', 'completed', '2026-11-22')).toBe(false);
    expect(isStaffTaskOverdue(null, 'in_progress', '2026-11-22')).toBe(false);
  });

  it('counts open, in-progress and completed tasks independently', () => {
    expect(countStaffTasksByStatus([
      { status: 'open' },
      { status: 'open' },
      { status: 'in_progress' },
      { status: 'completed' },
    ])).toEqual({ open: 2, in_progress: 1, completed: 1 });
  });
});
