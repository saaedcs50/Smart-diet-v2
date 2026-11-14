import React, { useMemo } from 'react';
import { Activity, Target } from 'lucide-react';
import type { DayLog, PlanConfig } from '../types';
import { calculateGoalProgressSummary } from '../utils/goalProgress';

interface GoalProgressStripProps {
  plan: PlanConfig;
  currentDate: string;
  day: DayLog;
}

/** A persistent, non-clinical summary of weight-to-target and recorded adherence. */
export const GoalProgressStrip: React.FC<GoalProgressStripProps> = ({
  plan,
  currentDate,
  day,
}) => {
  const progress = useMemo(
    () => calculateGoalProgressSummary(plan, currentDate),
    // day changes after each save and must refresh the seven-day average.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, currentDate, day],
  );

  if (progress.targetWeight === null || progress.currentWeight === null) return null;

  let weightMessage = 'تم الوصول إلى الوزن المستهدف';
  if (progress.remainingKg !== null) {
    weightMessage = `باقي ${progress.remainingKg.toFixed(1)} كجم على هدفك`;
  } else if (progress.passedTargetKg !== null) {
    weightMessage = `وزنك أقل من الرقم المستهدف بـ ${progress.passedTargetKg.toFixed(1)} كجم`;
  }

  return (
    <section
      aria-label="ملخص التقدم نحو الهدف"
      className="sticky top-2 z-20 rounded-2xl border border-peacock-sage/80 dark:border-peacock-indigo-deep/70 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-3.5 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Target className="h-4 w-4 shrink-0 text-peacock-indigo dark:text-peacock-teal" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-slate-800 dark:text-slate-100">
              {weightMessage}
            </p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              آخر وزن مسجّل: {progress.currentWeight.toFixed(1)} كجم · الهدف: {progress.targetWeight.toFixed(1)} كجم
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/50 px-2.5 py-1.5">
          <Activity className="h-3.5 w-3.5 text-peacock-indigo dark:text-peacock-teal" aria-hidden="true" />
          <span className="text-[11px] font-black text-peacock-indigo dark:text-peacock-teal-light">
            {progress.weeklyAdherence === null
              ? 'لا توجد سجلات هذا الأسبوع'
              : `التزام الأسبوع ${progress.weeklyAdherence}%`}
          </span>
        </div>
      </div>
    </section>
  );
};
