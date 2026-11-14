import { BRAND } from '../config/brand';
import { storageScopePrefix } from './storageScope';

/**
 * عزل بيانات كل عيادة على نفس الجهاز.
 * المفاتيح القديمة (nt_v6_egypt_*, smartdiet_*) تُرحَّل مرة واحدة للنسخة الحالية فقط.
 */

function slugify(raw: string): string {
  return String(raw || 'app')
    .toLowerCase()
    .replace(/[^\w\u0600-\u06ff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'app';
}

/** slug ثابت لكل build/عيادة من الهوية */
export function brandStorageSlug(): string {
  return slugify(BRAND.shortName || BRAND.appName || 'app');
}

export function legacyNs(key: string): string {
  return `sd_${brandStorageSlug()}_${key}`;
}

/** Current scope namespace; local mode remains byte-for-byte compatible. */
export function ns(key: string): string {
  return `sd_${brandStorageSlug()}_${storageScopePrefix()}${key}`;
}

/** Key for an explicit scope without mutating the running application's scope. */
export function nsForScope(scope: 'local' | 'guest' | `user:${string}`, key: string): string {
  return `sd_${brandStorageSlug()}_${storageScopePrefix(scope)}${key}`;
}

/** مفاتيح التطبيق بعد العزل */
export const StorageKeys = {
  plan: () => ns('plan'),
  dayPrefix: () => ns('day_'),
  activeFasting: () => ns('active_fasting'),
  notificationSettings: () => ns('notification_settings'),
  lastWaterNotif: () => ns('last_water_notif'),
  firedNotifsToday: () => ns('fired_notifs_today'),
  lastAppBoot: () => ns('last_app_boot'),
  /** Batch 1.5: معرّف فجوة الغياب التي عُرضت لها بطاقة الترحيب (تاريخ آخر نشاط) */
  lastWelcomeBackGapDate: () => ns('last_welcome_back_gap_date'),
  /** Batch 2.1: قائمة تسوق أسبوعية محفوظة لكل بداية أسبوع */
  shoppingListWeek: (weekStartISO: string) => ns(`shopping_list_${weekStartISO}`),
  /** Batch 2.3: المعالم المفتوحة Record<milestoneId, dateISO> */
  milestonesUnlocked: () => ns('milestones_unlocked'),
  /** Batch 2.3: هل سبق تشغيل حساب المعالم على هذا الجهاز؟ (للحساب الرجعي) */
  milestonesInitialized: () => ns('milestones_initialized'),
  /** Batch 2.3: تاريخ أول مشاركة تقرير (وقود معلم «أول تقرير مُشارك») */
  reportSharedAt: () => ns('report_shared_at'),
  /** Batch 2.5: مسودة خطة الاستبيان — مستقلة تمامًا عن الخطة النشطة */
  intakeDraft: () => ns('intake_draft'),
  /** Batch 3.3: سجل تفعيل القالب الموسمي (يشمل لقطة إعدادات الماء قبل التفعيل) */
  seasonalActivation: () => ns('seasonal_activation'),
  accessibilityLargeText: () => ns('accessibility_large_text'),
  accessibilityHighContrast: () => ns('accessibility_high_contrast'),
  darkMode: () => ns('dark_mode'),
  onboardingSeen: () => ns('onboarding_seen'),
  /** إقرار العميل بأنه اطّلع على الوجبة التالية ضمن دليل أول ثلاثة أيام */
  firstDaysMealViewed: () => ns('first_days_meal_viewed'),
  coachOnboardingSeen: () => ns('coach_onboarding_seen'),
  coachSessionToken: () => ns('coach_session_token'),
  coachUnlocked: () => ns('coach_unlocked'),
  /** SHA-256 لهاش PIN بعد أول دخول ناجح عبر السيرفر: ليس الرقم نفسه */
  coachPinHash: () => ns('coach_pin_hash'),
  /** ملح عشوائي لكل جهاز يُخلط مع هاش الـ PIN (v2) */
  coachPinSalt: () => ns('coach_pin_salt'),
  // This marker belongs to the one-time pre-account legacy migration, not a user bucket.
  migratedFlag: () => legacyNs('migrated_v1'),
  photoDbName: () => `${ns('photos_db')}`,
};

/** المفاتيح القديمة قبل white-label / العزل */
const LEGACY = {
  plan: 'nt_v6_egypt_plan',
  dayPrefix: 'nt_v6_egypt_day_',
  activeFasting: 'smartdiet_active_fasting_session',
  notificationSettings: 'nt_notification_settings',
  lastWaterNotif: 'nt_last_water_notif',
  firedNotifsToday: 'nt_fired_notifs_today',
  lastAppBoot: 'nt_last_app_boot_timestamp',
  darkMode: 'nt_dark_mode',
  onboardingSeen: 'smartdiet_onboarding_seen',
  coachOnboardingSeen: 'smartdiet_coach_onboarding_seen',
  coachSessionToken: 'smartdiet_coach_session_token',
  coachUnlocked: 'smartdiet_coach_unlocked',
} as const;

function copyIfMissing(oldKey: string, newKey: string): void {
  try {
    if (localStorage.getItem(newKey) != null) return;
    const val = localStorage.getItem(oldKey);
    if (val != null) localStorage.setItem(newKey, val);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * ترحيل مرة واحدة من المفاتيح العامة القديمة → مفاتيح العيادة الحالية.
 * لا يحذف القديم حتى لا نخسر بيانات لو فيه نسخة قديمة لسه بتتشغّل.
 */
export function migrateLegacyStorageOnce(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(StorageKeys.migratedFlag()) === '1') return;

    copyIfMissing(LEGACY.plan, StorageKeys.plan());
    copyIfMissing(LEGACY.activeFasting, StorageKeys.activeFasting());
    copyIfMissing(LEGACY.notificationSettings, StorageKeys.notificationSettings());
    copyIfMissing(LEGACY.lastWaterNotif, StorageKeys.lastWaterNotif());
    copyIfMissing(LEGACY.firedNotifsToday, StorageKeys.firedNotifsToday());
    copyIfMissing(LEGACY.lastAppBoot, StorageKeys.lastAppBoot());
    copyIfMissing(LEGACY.darkMode, StorageKeys.darkMode());
    copyIfMissing(LEGACY.onboardingSeen, StorageKeys.onboardingSeen());
    copyIfMissing(LEGACY.coachOnboardingSeen, StorageKeys.coachOnboardingSeen());

    const dayPrefixNew = StorageKeys.dayPrefix();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LEGACY.dayPrefix)) continue;
      const dateStr = key.slice(LEGACY.dayPrefix.length);
      copyIfMissing(key, dayPrefixNew + dateStr);
    }

    localStorage.setItem(StorageKeys.migratedFlag(), '1');
  } catch (e) {
    console.warn('storage migration skipped', e);
  }
}

export const LEGACY_PHOTO_DB = 'nt_private_photos_db';


const LEGACY_PATIENT_KEYS = [
  'plan',
  'active_fasting',
  'notification_settings',
  'last_water_notif',
  'fired_notifs_today',
  'last_app_boot',
  'last_welcome_back_gap_date',
  'milestones_unlocked',
  'milestones_initialized',
  'report_shared_at',
  'intake_draft',
  'seasonal_activation',
] as const;

/**
 * Copy only patient-owned legacy data into the confirmed account bucket.
 * Never copies coach PIN/session data, device preferences, ownership markers,
 * or IndexedDB photos. Existing user-scoped values always win.
 */
export function copyLegacyPatientDataToUser(uid: string): {
  copiedKeys: number;
  skippedExisting: number;
} {
  if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid)) {
    throw new Error('معرّف مستخدم غير صالح لنقل البيانات المحلية');
  }
  if (typeof localStorage === 'undefined') {
    throw new Error('التخزين المحلي غير متاح');
  }

  const sourcePrefix = legacyNs('');
  const targetScope = `user:${uid}` as const;
  let copiedKeys = 0;
  let skippedExisting = 0;

  const copyKey = (suffix: string) => {
    const sourceKey = sourcePrefix + suffix;
    const targetKey = nsForScope(targetScope, suffix);
    const sourceValue = localStorage.getItem(sourceKey);
    if (sourceValue == null) return;
    if (localStorage.getItem(targetKey) != null) {
      skippedExisting += 1;
      return;
    }
    localStorage.setItem(targetKey, sourceValue);
    copiedKeys += 1;
  };

  for (const key of LEGACY_PATIENT_KEYS) copyKey(key);

  const dayPrefix = 'day_';
  const shoppingPrefix = 'shopping_list_';
  const sourceKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(sourcePrefix)) continue;
    const suffix = key.slice(sourcePrefix.length);
    if (suffix.startsWith(dayPrefix) || suffix.startsWith(shoppingPrefix)) {
      sourceKeys.push(suffix);
    }
  }
  for (const suffix of sourceKeys) copyKey(suffix);

  return { copiedKeys, skippedExisting };
}

/** True when the legacy patient dataset was previously bound to an account. */
export function hasLegacyPatientData(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const prefix = legacyNs('');
    const known = [...LEGACY_PATIENT_KEYS].map((key) => prefix + key);
    if (known.some((key) => localStorage.getItem(key) != null)) return true;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(prefix + 'day_') || key.startsWith(prefix + 'shopping_list_'))) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

