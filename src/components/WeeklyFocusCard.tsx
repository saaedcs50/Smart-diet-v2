import React, { useMemo } from 'react';
import { Target, CheckCircle2 } from 'lucide-react';
import { DayLog, PlanConfig } from '../types';
import { getAllStoredDayLogs } from '../utils/storage';
import {
  WEEKLY_FOCUS_TYPE_LABELS,
  WEEKLY_FOCUS_UNITS,
  computeWeeklyFocusProgress,
  getWeeklyFocusVisibility,
} from '../utils/weeklyFocus';

interface WeeklyFocusCardProps {
  plan: PlanConfig;
  day: DayLog;
  currentDate: string;
  onUpdateDay: (updated: DayLog) => void;
}

/**
 * Batch 2.4 — بطاقة هدف الأسبوع أعلى تبويب اليوم.
 * بلا هدف مضبوط أو خارج نافذة العرض: لا تُرسم إطلاقًا (لا فراغ مشوّه).
 */
export const WeeklyFocusCard: React.FC<WeeklyFocusCardProps> = ({ plan, day, currentDate, onUpdateDay }) => {
  const focus = plan.weeklyFocus;
  const visibility = getWeeklyFocusVisibility(focus, currentDate);

  const progress = useMemo(() => {
    if (!focus || visibility === 'hidden') return null;
    return computeWeeklyFocusProgress(focus, plan, getAllStoredDayLogs());
    // day في الاعتماديات حتى يُعاد الحساب فور أي تسجيل جديد
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, plan, visibility, day, currentDate]);

  if (!focus || visibility === 'hidden' || !progress) return null;

  const isFinalDay = visibility === 'final-day';
  const label = focus.type === 'custom' ? focus.label || 'هدف الأسبوع' : WEEKLY_FOCUS_TYPE_LABELS[focus.type];
  const unit = WEEKLY_FOCUS_UNITS[focus.type];
  const showCustomButton = focus.type === 'custom' && !isFinalDay && !day.focusDone && currentDate >= focus.weekStartISO;

  return (
    <div
      className={`p-4 rounded-3xl border space-y-2.5 animate-in fade-in duration-200 ${
        isFinalDay
          ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60'
          : 'bg-white/90 dark:bg-slate-900/90 border-peacock-sage/80 dark:border-peacock-indigo-deep/60'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-peacock-mist dark:bg-peacock-ink-deep/40 text-peacock-indigo dark:text-peacock-teal flex items-center justify-center shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm truncate">
              {isFinalDay ? 'نتيجة هدف الأسبوع الماضي' : 'هدف الأسبوع'}: {label}
            </h3>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              أسبوع يبدأ {focus.weekStartISO}
            </span>
          </div>
        </div>
        <span className="text-sm font-black text-peacock-indigo dark:text-peacock-teal shrink-0">{progress.percent}%</span>
      </div>

      <div className="w-full bg-peacock-pale/70 dark:bg-peacock-ink-deep/60 h-2.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${progress.completed ? 'bg-peacock-blue' : 'bg-peacock-blue'}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {progress.current} / {progress.target} {unit}
          {progress.completed ? ' — اكتمل الهدف 🎉' : isFinalDay ? ' — انتهى الأسبوع' : ' — كمّل، أنت قريب!'}
        </p>
        {showCustomButton && (
          <button
            type="button"
            onClick={() => onUpdateDay({ ...day, focusDone: true })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-peacock-blue hover:bg-peacock-indigo text-white text-xs font-black cursor-pointer shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            أنجزت اليوم
          </button>
        )}
        {focus.type === 'custom' && day.focusDone && !isFinalDay && (
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">تم إنجاز اليوم ✅</span>
        )}
      </div>
    </div>
  );
};
