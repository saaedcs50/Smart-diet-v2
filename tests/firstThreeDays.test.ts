import { describe, expect, it } from 'vitest';
import { createEmptyDayLog } from '../src/utils/storage';
import { getFirstThreeDaysGuideState } from '../src/utils/firstThreeDays';

describe('first three days starter guide', () => {
  it('starts on the first real activity date and counts a weight logged during the first three days', () => {
    const logs = {
      '2026-11-12': { ...createEmptyDayLog(), water: 500 },
      '2026-11-13': { ...createEmptyDayLog(), weight: 82.6 },
    };
    const state = getFirstThreeDaysGuideState({
      todayDate: '2026-11-14',
      dayLogs: logs,
      notificationsEnabled: true,
      mealViewed: false,
    });

    expect(state.visible).toBe(true);
    expect(state.startDate).toBe('2026-11-12');
    expect(state.dayNumber).toBe(3);
    expect(state.weightLogged).toBe(true);
    expect(state.completedCount).toBe(2);
  });

  it('does not show the guide to an established account with older activity', () => {
    const logs = {
      '2026-11-10': { ...createEmptyDayLog(), weight: 82 },
      '2026-11-11': { ...createEmptyDayLog(), water: 500 },
    };
    const state = getFirstThreeDaysGuideState({
      todayDate: '2026-11-14',
      dayLogs: logs,
      notificationsEnabled: false,
      mealViewed: false,
    });
    expect(state.visible).toBe(false);
  });

  it('starts a brand-new account on day one with no previous records', () => {
    const state = getFirstThreeDaysGuideState({
      todayDate: '2026-11-14',
      dayLogs: {},
      notificationsEnabled: false,
      mealViewed: false,
    });
    expect(state.visible).toBe(true);
    expect(state.dayNumber).toBe(1);
    expect(state.startDate).toBe('2026-11-14');
  });

  it('counts weight only when the reading is positive and falls in the first three days', () => {
    const logs = {
      '2026-11-14': { ...createEmptyDayLog(), weight: 0 },
    };
    const state = getFirstThreeDaysGuideState({
      todayDate: '2026-11-14',
      dayLogs: logs,
      notificationsEnabled: false,
      mealViewed: false,
    });
    expect(state.weightLogged).toBe(false);
  });

  it('keeps the onboarding window anchored to its persisted start date before any activity exists', () => {
    const state = getFirstThreeDaysGuideState({
      todayDate: '2026-11-14',
      startedAtDate: '2026-11-12',
      dayLogs: {},
      notificationsEnabled: false,
      mealViewed: false,
    });
    expect(state.startDate).toBe('2026-11-12');
    expect(state.dayNumber).toBe(3);
    expect(state.visible).toBe(true);
  });

  it('does not restart the onboarding window when the first activity is logged later', () => {
    const logs = {
      '2026-11-14': { ...createEmptyDayLog(), weight: 82 },
    };
    const state = getFirstThreeDaysGuideState({
      todayDate: '2026-11-14',
      startedAtDate: '2026-11-12',
      dayLogs: logs,
      notificationsEnabled: false,
      mealViewed: false,
    });
    expect(state.startDate).toBe('2026-11-12');
    expect(state.dayNumber).toBe(3);
  });

  it('hides after the persisted three-day window ends even if no activity was recorded', () => {
    const state = getFirstThreeDaysGuideState({
      todayDate: '2026-11-15',
      startedAtDate: '2026-11-12',
      dayLogs: {},
      notificationsEnabled: false,
      mealViewed: false,
    });
    expect(state.dayNumber).toBe(4);
    expect(state.visible).toBe(false);
  });
});
