import React, { useEffect, useState } from 'react';
import { Bell, Check, ChevronDown, Scale, Utensils } from 'lucide-react';
import type { PlanConfig } from '../types';
import { getAllStoredDayLogs } from '../utils/storage';
import { getNotificationPermission, loadNotificationSettings } from '../utils/notifications';
import { StorageKeys } from '../utils/storageKeys';
import { onStorageScopeChanged } from '../utils/storageScope';
import { getFirstActivityDate, getFirstThreeDaysGuideState } from '../utils/firstThreeDays';

function readScopedStartDate(todayDate: string): string {
  try {
    const saved = localStorage.getItem(StorageKeys.firstDaysStartedAt());
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) && saved <= todayDate) return saved;
  } catch {
    // Start from the best date available when storage is unavailable.
  }
  const firstActivity = getFirstActivityDate(getAllStoredDayLogs(), todayDate);
  const resolved = firstActivity ?? todayDate;
  try {
    localStorage.setItem(StorageKeys.firstDaysStartedAt(), resolved);
  } catch {
    // The guide remains functional for this session if storage is unavailable.
  }
  return resolved;
}

interface FirstThreeDaysGuideProps {
  todayDate: string;
  plan: PlanConfig;
  onOpenNotifications?: () => void;
}

/** A short-lived, account-scoped starter checklist for the patient's first three days. */
export const FirstThreeDaysGuide: React.FC<FirstThreeDaysGuideProps> = ({
  todayDate,
  plan,
  onOpenNotifications,
}) => {
  const [mealViewed, setMealViewed] = useState(() => {
    try {
      return localStorage.getItem(StorageKeys.firstDaysMealViewed()) === 'true';
    } catch {
      return false;
    }
  });
  const [startedAtDate, setStartedAtDate] = useState(() => readScopedStartDate(todayDate));
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(StorageKeys.firstDaysStartedAt(), startedAtDate);
    } catch {
      // Keep the resolved date in memory if local storage is unavailable.
    }
  }, [startedAtDate]);

  useEffect(() => onStorageScopeChanged(() => {
    try {
      setMealViewed(localStorage.getItem(StorageKeys.firstDaysMealViewed()) === 'true');
    } catch {
      setMealViewed(false);
    }
    setStartedAtDate(readScopedStartDate(todayDate));
  }), [todayDate]);

  // Re-read on every parent render so permission, settings, and a newly
  // recorded weight are reflected immediately after the user changes them.
  let notificationsEnabled = false;
  try {
    notificationsEnabled = typeof Notification !== 'undefined' &&
      getNotificationPermission() === 'granted' &&
      loadNotificationSettings().enabled;
  } catch {
    notificationsEnabled = false;
  }

  const progress = getFirstThreeDaysGuideState({
    todayDate,
    dayLogs: getAllStoredDayLogs(),
    startedAtDate,
    notificationsEnabled,
    mealViewed,
  });

  if (!progress.visible || !plan.meals?.length) return null;

  const acknowledgeMeal = () => {
    try {
      localStorage.setItem(StorageKeys.firstDaysMealViewed(), 'true');
    } catch {
      // The checklist remains usable if local storage is unavailable.
    }
    setMealViewed(true);
    document.getElementById('next-meal-spotlight')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const done = progress.completedCount === 3;

  return (
    <section
      aria-label="دليل أول ثلاثة أيام"
      className="rounded-3xl border border-peacock-sage/80 bg-white/95 p-4 shadow-sm dark:border-peacock-indigo-deep/70 dark:bg-slate-900/95"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-right"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <div>
          <p className="text-sm font-black text-slate-800 dark:text-slate-100">
            {done ? 'اكتملت خطوات البداية' : 'بداية منظّمة — أول 3 أيام'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            اليوم {progress.dayNumber} من 3 · {progress.completedCount} من 3 خطوات
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-peacock-mist px-2.5 py-1 text-[11px] font-black text-peacock-indigo dark:bg-peacock-ink-deep dark:text-peacock-teal-light">
            {Math.round(progress.completedCount / 3 * 100)}%
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <ol className="mt-3 space-y-2">
          <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-peacock-indigo dark:bg-slate-900 dark:text-peacock-teal">
              {progress.weightLogged ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">سجّل وزنك</span>
              <span className="block text-[11px] text-slate-500">يُحتسب تلقائيًا عند تسجيل وزن خلال أول 3 أيام</span>
            </span>
            {progress.weightLogged && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">تم</span>}
          </li>

          <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-peacock-indigo dark:bg-slate-900 dark:text-peacock-teal">
              {progress.notificationsEnabled ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">فعّل التنبيهات</span>
              <span className="block text-[11px] text-slate-500">يجب السماح بإشعارات الجهاز وتفعيل التنبيهات داخل التطبيق</span>
            </span>
            {progress.notificationsEnabled
              ? <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">تم</span>
              : onOpenNotifications && (
                <button
                  type="button"
                  className="rounded-xl border border-peacock-sage px-3 py-2 text-[11px] font-bold text-peacock-indigo dark:border-peacock-indigo-deep dark:text-peacock-teal-light"
                  onClick={onOpenNotifications}
                >
                  الإعداد
                </button>
              )}
          </li>

          <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-peacock-indigo dark:bg-slate-900 dark:text-peacock-teal">
              {progress.mealViewed ? <Check className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">اعرف وجبتك التالية</span>
              <span className="block text-[11px] text-slate-500">افتح الوجبة المقترحة وتعرّف على تفاصيلها</span>
            </span>
            {progress.mealViewed
              ? <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">تم</span>
              : (
                <button
                  type="button"
                  className="rounded-xl border border-peacock-sage px-3 py-2 text-[11px] font-bold text-peacock-indigo dark:border-peacock-indigo-deep dark:text-peacock-teal-light"
                  onClick={acknowledgeMeal}
                >
                  عرض الوجبة
                </button>
              )}
          </li>
        </ol>
      )}
    </section>
  );
};
