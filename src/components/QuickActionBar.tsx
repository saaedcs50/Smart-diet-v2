import React, { useMemo } from 'react';
import { Check, Droplets, Pill, PartyPopper } from 'lucide-react';
import { DayLog, PlanConfig } from '../types';
import {
  getQuickActionState,
  markMealDone,
  markMedicationTaken,
  addWaterCup,
} from '../utils/nextAction';

interface QuickActionBarProps {
  plan: PlanConfig;
  day: DayLog;
  onUpdateDay: (updated: DayLog) => void;
}

/**
 * Batch 1.2 — شريط إجراءات ثابت أسفل تبويب اليوم (فوق شريط التنقل):
 * أهم 3 أفعال سياقية دون أي تمرير. يعيش داخل TodayTab فقط،
 * فلا يظهر في تبويبَي الجسم/التقارير.
 */
export const QuickActionBar: React.FC<QuickActionBarProps> = ({ plan, day, onUpdateDay }) => {
  const state = useMemo(() => getQuickActionState(plan, day), [plan, day]);

  return (
    <div
      dir="rtl"
      className="fixed bottom-20 sm:bottom-24 left-0 right-0 z-30 px-4 pointer-events-none flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-3xl rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-lg shadow-slate-900/10 px-2.5 py-2">
        {state.allDone ? (
          <div className="flex items-center justify-center gap-2 py-1.5 text-peacock-indigo dark:text-peacock-teal">
            <PartyPopper className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-black whitespace-nowrap">يومك مكتمل 🎉</span>
          </div>
        ) : (
          <div className="flex items-stretch gap-1.5">
            {state.nextMeal && (
              <button
                type="button"
                onClick={() => onUpdateDay(markMealDone(day, state.nextMeal!.id))}
                className="flex-1 min-w-0 px-2 py-2 rounded-2xl bg-peacock-blue hover:bg-peacock-indigo text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title={`تعليم «${state.nextMeal.name}» كمأخوذة`}
              >
                <Check className="w-4 h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs font-black truncate whitespace-nowrap">
                  وجبتي التالية: تم ✅
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onUpdateDay(addWaterCup(day, 250))}
              className="flex-1 min-w-0 px-2 py-2 rounded-2xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title="إضافة كوب ماء (250 مل)"
            >
              <Droplets className="w-4 h-4 shrink-0" />
              <span className="text-[11px] sm:text-xs font-black truncate whitespace-nowrap">+ كوب ماء</span>
            </button>

            {state.nextMedication && (
              <button
                type="button"
                onClick={() => onUpdateDay(markMedicationTaken(day, state.nextMedication!.key))}
                className="flex-1 min-w-0 px-2 py-2 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 hover:bg-peacock-pale dark:hover:bg-peacock-ink/40 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-sage/80 dark:border-peacock-indigo-deep/80 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title={`تعليم «${state.nextMedication.medicationName}» كمأخوذ`}
              >
                <Pill className="w-4 h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs font-black truncate whitespace-nowrap">
                  دوائي التالي: تم
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
