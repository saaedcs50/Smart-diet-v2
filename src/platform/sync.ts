// ============================================================================
// مزامنة الترحيل: من التخزين المحلي الحالي إلى Firestore — المرحلة الثانية
// ----------------------------------------------------------------------------
// - opt-in صريح فقط: لا تعمل هذه الدالة تلقائيًا أبدًا، بل عند ضغط المريض
//   زر «مزامنة بيانات جهازي» بعد تأكيد موافقة صريحة (تُحفظ في
//   consents/sync قبل الرفع — انظر PlatformApp). بلا موافقة: التطبيق
//   يعمل محليًا فقط كما اليوم (دراسة §٦).
// - سياسة التعارض (دراسة §٧): آخر كتابة تفوز على مستوى المستند. سجلات
//   الأيام تُستبدل كاملة (وحدة التعارض = يوم واحد). الخطة تُكتب فقط إن
//   لم توجد خطة سحابية بعد؛ إن وجدت، تُترك كما هي ويُبلَّغ بذلك في التقرير
//   (تعديل الطبيب للخطة لا يُمحى بترحيل جهازي).
// - ما يُرحَّل (دراسة §٤): الخطة + سجلات الأيام + جلسة الصيام الجارية +
//   إعدادات التنبيهات + المعالم + القالب الموسمي + قوائم التسوق. ما يبقى
//   محليًا أبدًا: تفضيلات الواجهة، أعلام الإعداد، حالة الإشعارات، هاش
//   الـ PIN وملحه، مسودات الاستبيان (مسودات جهازية لا تُرفع).
// - لا تُرحَّل أي بيانات حقيقية من هنا: هذه الدالة تُستدعى من واجهة
//   المريض نفسه على جهازه فقط، واختباراتها ببيانات وهمية محقونة.
// - مؤشر الحالة: آخر نتيجة تُحفظ محليًا (مفتاح واجهة فقط، لا بيانات
//   صحية) وتُعرض في الواجهة.
// ============================================================================

import {
  getActiveFastingSession,
  getAllStoredDayLogs,
  loadPlanFromStorage,
} from '../utils/storage';
import {
  loadNotificationSettings,
  type NotificationSettings,
} from '../utils/notifications';
import { StorageKeys } from '../utils/storageKeys';
import { loadSeasonalActivation } from '../utils/seasonalTemplate';
import type { ActiveFastingSession, DayLog, PlanConfig } from '../types/index';
import type { SeasonalActivation } from '../utils/seasonalTemplate';
import type { ShoppingListState } from '../utils/shoppingList';
import type { MilestonesDoc } from './firestore';
import {
  getPatientPlan,
  saveActiveFasting,
  saveConsent,
  saveDayLog,
  saveMilestones,
  saveNotificationSettings,
  savePatientPlan,
  saveSeasonal,
  saveShoppingList,
} from './firestore';

export interface LocalSnapshot {
  plan: PlanConfig;
  dayLogs: Record<string, DayLog>;
  activeFasting: ActiveFastingSession | null;
  notificationSettings: NotificationSettings;
  milestones: MilestonesDoc;
  seasonal: SeasonalActivation | null;
  shoppingLists: Record<string, ShoppingListState>;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// قراءة لقطة محلية من جهاز المريض نفسه. كل قراءة محمية بـ try/catch
// حتى لا تُفشل قيمة تالفة واحدة الترحيل كله.
export function readLocalSnapshot(): LocalSnapshot {
  const shoppingLists: Record<string, ShoppingListState> = {};
  try {
    const prefix = StorageKeys.shoppingListWeek('');
    const store = globalThis.localStorage;
    if (store) {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && key.startsWith(prefix)) {
          const weekStart = key.slice(prefix.length);
          const parsed = readJson<ShoppingListState | null>(key, null);
          if (parsed) shoppingLists[weekStart] = parsed;
        }
      }
    }
  } catch {
    // تُترك القوائم فارغة عند أي عطل — لا بيانات حرجة هنا.
  }
  return {
    plan: loadPlanFromStorage(),
    dayLogs: getAllStoredDayLogs(),
    activeFasting: getActiveFastingSession(),
    notificationSettings: loadNotificationSettings(),
    milestones: {
      unlocked: readJson(StorageKeys.milestonesUnlocked(), {}),
      initialized: readJson(StorageKeys.milestonesInitialized(), false),
      reportSharedAt: readJson(StorageKeys.reportSharedAt(), null),
    },
    seasonal: loadSeasonalActivation(),
    shoppingLists,
  };
}

export interface SyncReport {
  planWritten: boolean;
  planSkippedCloudExists: boolean;
  dayLogCount: number;
  dayLogFailed: string[];
  activeFastingWritten: boolean;
  notificationSettingsWritten: boolean;
  milestonesWritten: boolean;
  seasonalWritten: boolean;
  shoppingListCount: number;
  errors: string[];
}

export interface SyncWriters {
  getPatientPlan: (uid: string) => Promise<PlanConfig | null>;
  savePatientPlan: (uid: string, plan: PlanConfig, editorUid: string) => Promise<void>;
  saveDayLog: (uid: string, date: string, log: DayLog, editorUid: string) => Promise<void>;
  saveActiveFasting: (uid: string, session: ActiveFastingSession, editorUid: string) => Promise<void>;
  saveNotificationSettings: (uid: string, settings: NotificationSettings, editorUid: string) => Promise<void>;
  saveMilestones: (uid: string, state: MilestonesDoc, editorUid: string) => Promise<void>;
  saveSeasonal: (uid: string, state: SeasonalActivation | null, editorUid: string) => Promise<void>;
  saveShoppingList: (uid: string, weekStart: string, state: ShoppingListState, editorUid: string) => Promise<void>;
  saveConsent: (uid: string, type: string, consent: { text: string; grantedAt: string | null; revokedAt: string | null; version: string }, editorUid: string) => Promise<void>;
}

export const defaultSyncWriters: SyncWriters = {
  getPatientPlan,
  savePatientPlan,
  saveDayLog,
  saveActiveFasting,
  saveNotificationSettings,
  saveMilestones,
  saveSeasonal,
  saveShoppingList,
  saveConsent,
};

export const SYNC_CONSENT_TEXT =
  'أوافق على رفع نسخة من بيانات جهازي (خطتي وسجلاتي اليومية) إلى حسابي السحابي في عيادتي، حتى أتابعها من أي جهاز وحتى يراها طبيبي. يمكنني سحب الموافقة في أي وقت فيوقف الرفع فورًا.';
export const SYNC_CONSENT_VERSION = '1';

// ملخص خالص للقطة (قابل للاختبار بلا شبكة ولا تخزين).
export function summarizeSnapshot(snapshot: LocalSnapshot): {
  dayLogCount: number;
  shoppingListCount: number;
  hasPlan: boolean;
  hasActiveFasting: boolean;
} {
  return {
    dayLogCount: Object.keys(snapshot.dayLogs).length,
    shoppingListCount: Object.keys(snapshot.shoppingLists).length,
    hasPlan: snapshot.plan.clientName.length > 0,
    hasActiveFasting: snapshot.activeFasting !== null,
  };
}

// الترحيل نفسه: يكتب كل عنصر على حدة، ويجمع الأخطاء بدل التوقف عند
// أول فشل — فشل يوم واحد لا يمنع باقي الأيام.
export async function migrateLocalToCloud(
  snapshot: LocalSnapshot,
  patientUid: string,
  editorUid: string,
  writers: SyncWriters = defaultSyncWriters,
): Promise<SyncReport> {
  const report: SyncReport = {
    planWritten: false,
    planSkippedCloudExists: false,
    dayLogCount: 0,
    dayLogFailed: [],
    activeFastingWritten: false,
    notificationSettingsWritten: false,
    milestonesWritten: false,
    seasonalWritten: false,
    shoppingListCount: 0,
    errors: [],
  };

  try {
    const existingPlan = await writers.getPatientPlan(patientUid);
    if (existingPlan) {
      report.planSkippedCloudExists = true;
    } else {
      await writers.savePatientPlan(patientUid, snapshot.plan, editorUid);
      report.planWritten = true;
    }
  } catch (error) {
    report.errors.push(`plan: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  for (const [date, log] of Object.entries(snapshot.dayLogs)) {
    try {
      await writers.saveDayLog(patientUid, date, log, editorUid);
      report.dayLogCount += 1;
    } catch (error) {
      report.dayLogFailed.push(date);
      report.errors.push(
        `dayLog ${date}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  const optionalWrites: Array<[string, () => Promise<void>, () => void]> = [
    [
      'activeFasting',
      async () => {
        if (snapshot.activeFasting) {
          await writers.saveActiveFasting(patientUid, snapshot.activeFasting, editorUid);
        }
      },
      () => {
        report.activeFastingWritten = snapshot.activeFasting !== null;
      },
    ],
    [
      'notificationSettings',
      async () => {
        await writers.saveNotificationSettings(patientUid, snapshot.notificationSettings, editorUid);
      },
      () => {
        report.notificationSettingsWritten = true;
      },
    ],
    [
      'milestones',
      async () => {
        await writers.saveMilestones(patientUid, snapshot.milestones, editorUid);
      },
      () => {
        report.milestonesWritten = true;
      },
    ],
    [
      'seasonal',
      async () => {
        await writers.saveSeasonal(patientUid, snapshot.seasonal, editorUid);
      },
      () => {
        report.seasonalWritten = true;
      },
    ],
  ];
  for (const [label, write, mark] of optionalWrites) {
    try {
      await write();
      mark();
    } catch (error) {
      report.errors.push(`${label}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  for (const [weekStart, state] of Object.entries(snapshot.shoppingLists)) {
    try {
      await writers.saveShoppingList(patientUid, weekStart, state, editorUid);
      report.shoppingListCount += 1;
    } catch (error) {
      report.errors.push(
        `shoppingList ${weekStart}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// مؤشر حالة المزامنة (محلي فقط — لا بيانات صحية، مجرد أعداد وتوقيت)
// ---------------------------------------------------------------------------

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncStatus {
  state: SyncState;
  at: string | null;
  dayLogCount: number;
  planWritten: boolean;
  error: string | null;
}

type MinimalStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function resolveStore(provided?: MinimalStore): MinimalStore | null {
  if (provided) return provided;
  try {
    const store = (globalThis as { localStorage?: MinimalStore }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

export function loadSyncStatus(store?: MinimalStore): SyncStatus {
  const fallback: SyncStatus = {
    state: 'idle',
    at: null,
    dayLogCount: 0,
    planWritten: false,
    error: null,
  };
  const resolved = resolveStore(store);
  if (!resolved) return fallback;
  try {
    const value = resolved.getItem('sd_platform_sync_status');
    if (!value) return fallback;
    const parsed = JSON.parse(value) as Partial<SyncStatus>;
    if (parsed.state !== 'idle' && parsed.state !== 'syncing' && parsed.state !== 'success' && parsed.state !== 'error') {
      return fallback;
    }
    return {
      state: parsed.state,
      at: typeof parsed.at === 'string' ? parsed.at : null,
      dayLogCount: typeof parsed.dayLogCount === 'number' ? parsed.dayLogCount : 0,
      planWritten: parsed.planWritten === true,
      error: typeof parsed.error === 'string' ? parsed.error : null,
    };
  } catch {
    return fallback;
  }
}

export function saveSyncStatus(status: SyncStatus, store?: MinimalStore): void {
  const resolved = resolveStore(store);
  if (!resolved) return;
  try {
    resolved.setItem('sd_platform_sync_status', JSON.stringify(status));
  } catch {
    // حالة واجهة فقط — فشل حفظها لا يوقف المزامنة.
  }
}
