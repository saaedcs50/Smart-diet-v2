// اختبارات ترحيل المزامنة بحقن كتّاب وهميين (بلا Firebase ولا شبكة).
import { describe, it, expect } from 'vitest';
import {
  loadSyncStatus,
  migrateLocalToCloud,
  saveSyncStatus,
  summarizeSnapshot,
  type LocalSnapshot,
  type SyncWriters,
} from '../../src/platform/sync';
import type { DayLog, PlanConfig } from '../../src/types/index';

function fakePlan(): PlanConfig {
  return {
    clientName: 'مريض تجريبي',
    dailyWaterGoalMl: 2000,
    heightCm: 170,
    startWeight: 90,
    targetWeight: 75,
    targetWaist: null,
    freezeDaysPerMonth: 2,
    adminPin: '',
    scoreWeights: { checklist: 25, water: 25, sleep: 25, meals: 25 },
    meals: [],
    checklist: [],
    supplements: [],
    tips: [],
    symptomsList: [],
  } as unknown as PlanConfig;
}

function fakeDayLog(weight: number): DayLog {
  return {
    water: 1000,
    waterLogs: 4,
    sleep: '23:00',
    wake: '07:00',
    quality: 'جيد',
    meals: {},
    checks: {},
    supps: {},
    notes: '',
    weight,
    meas: { waist: null, chest: null, hips: null, arm: null, thigh: null, neck: null },
    symptoms: {},
    symNotes: '',
  } as unknown as DayLog;
}

function fakeSnapshot(): LocalSnapshot {
  return {
    plan: fakePlan(),
    dayLogs: {
      '2026-10-20': fakeDayLog(89),
      '2026-10-21': fakeDayLog(88.5),
    },
    activeFasting: null,
    notificationSettings: {} as never,
    milestones: { unlocked: {}, initialized: false, reportSharedAt: null },
    seasonal: null,
    shoppingLists: { '2026-10-20': {} as never },
  };
}

function memoryWriters(options?: {
  existingPlan?: PlanConfig | null;
  failDay?: string;
}): { writers: SyncWriters; store: Record<string, unknown> } {
  const store: Record<string, unknown> = {};
  const writers: SyncWriters = {
    getPatientPlan: async () => options?.existingPlan ?? null,
    savePatientPlan: async (_uid, plan) => {
      store.plan = plan;
    },
    saveDayLog: async (_uid, date, log) => {
      if (options?.failDay === date) throw new Error('write failed');
      (store.dayLogs as Record<string, DayLog> | undefined) ??= {};
      (store.dayLogs as Record<string, DayLog>)[date] = log;
    },
    saveConsent: async () => undefined,
  };
  return { writers, store };
}

describe('summarizeSnapshot', () => {
  it('يحسب الأعداد من اللقطة', () => {
    const summary = summarizeSnapshot(fakeSnapshot());
    expect(summary.dayLogCount).toBe(2);
    expect(summary.shoppingListCount).toBe(1);
    expect(summary.hasPlan).toBe(true);
    expect(summary.hasActiveFasting).toBe(false);
  });
});

describe('migrateLocalToCloud', () => {
  it('يكتب الخطة والأيام عند غياب خطة سحابية (الأقسام غير المدعومة تُسجَّل)', async () => {
    const { writers, store } = memoryWriters();
    const report = await migrateLocalToCloud(fakeSnapshot(), 'patient-1', 'patient-1', writers);
    expect(report.planWritten).toBe(true);
    expect(report.planSkippedCloudExists).toBe(false);
    expect(report.dayLogCount).toBe(2);
    expect(report.dayLogFailed).toEqual([]);
    // SDV2-INT-002: قوائم التسوق غير مدعومة — تُسجَّل في unsupportedSections
    expect(report.shoppingListCount).toBe(0);
    expect(report.unsupportedSections).toContain('shoppingLists');
    expect(report.unsupportedSections).toContain('notificationSettings');
    expect(report.unsupportedSections).toContain('milestones');
    expect(report.errors).toEqual([]);
    expect(store.plan).toBeDefined();
  });

  it('لا يستبدل خطة سحابية موجودة (تعديل الطبيب محفوظ)', async () => {
    const { writers } = memoryWriters({ existingPlan: fakePlan() });
    const report = await migrateLocalToCloud(fakeSnapshot(), 'patient-1', 'patient-1', writers);
    expect(report.planWritten).toBe(false);
    expect(report.planSkippedCloudExists).toBe(true);
    expect(report.dayLogCount).toBe(2);
  });

  it('فشل يوم واحد لا يوقف باقي الأيام ويُبلَّغ عنه', async () => {
    const { writers } = memoryWriters({ failDay: '2026-10-20' });
    const report = await migrateLocalToCloud(fakeSnapshot(), 'patient-1', 'patient-1', writers);
    expect(report.dayLogCount).toBe(1);
    expect(report.dayLogFailed).toEqual(['2026-10-20']);
    expect(report.errors.length).toBeGreaterThan(0);
  });
});

describe('sync status store', () => {
  it('حفظ واسترجاع مع مخزن وهمي، وسقوط آمن على JSON تالف', () => {
    const backing = new Map<string, string>();
    const store = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, value);
      },
    };
    expect(loadSyncStatus(store).state).toBe('idle');
    saveSyncStatus(
      { state: 'success', at: '2026-10-24', dayLogCount: 2, planWritten: true, error: null, unsupportedSections: [] },
      store,
    );
    const loaded = loadSyncStatus(store);
    expect(loaded.state).toBe('success');
    expect(loaded.dayLogCount).toBe(2);
    expect(loaded.unsupportedSections).toEqual([]);
    backing.set('sd_platform_sync_status', '{not json');
    expect(loadSyncStatus(store).state).toBe('idle');
  });

  it('يحفظ ويسترجع حالة المزامنة الجزئية مع الأقسام غير المدعومة (SDV2-P1-2)', () => {
    const backing = new Map<string, string>();
    const store = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, value);
      },
    };
    saveSyncStatus(
      { state: 'partial', at: '2026-11-01', dayLogCount: 3, planWritten: true, error: null, unsupportedSections: ['shoppingLists', 'milestones'] },
      store,
    );
    const loaded = loadSyncStatus(store);
    expect(loaded.state).toBe('partial');
    expect(loaded.unsupportedSections).toEqual(['shoppingLists', 'milestones']);
  });
});
