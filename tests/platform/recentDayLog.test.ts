import { describe, expect, it } from 'vitest';
import { isNewDailyLog, NEW_DAILY_LOG_WINDOW_MS } from '../../src/platform/recentDayLog';

describe('new daily log badge', () => {
  const now = new Date('2026-11-22T12:00:00.000Z');

  it('marks a log created within the last 24 hours as new', () => {
    expect(isNewDailyLog('2026-11-22T11:59:00.000Z', now)).toBe(true);
    expect(isNewDailyLog('2026-11-21T12:01:00.000Z', now)).toBe(true);
  });

  it('stops showing the badge at exactly 24 hours', () => {
    const boundary = new Date(now.getTime() - NEW_DAILY_LOG_WINDOW_MS).toISOString();
    expect(isNewDailyLog(boundary, now)).toBe(false);
  });

  it('does not mark older, future, malformed or missing timestamps as new', () => {
    expect(isNewDailyLog('2026-11-21T11:59:59.999Z', now)).toBe(false);
    expect(isNewDailyLog('2026-11-22T12:00:01.000Z', now)).toBe(false);
    expect(isNewDailyLog('not-a-date', now)).toBe(false);
    expect(isNewDailyLog(null, now)).toBe(false);
    expect(isNewDailyLog(undefined, now)).toBe(false);
  });
});
