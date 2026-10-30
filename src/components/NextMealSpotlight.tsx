import React, { useState } from 'react';
import { Utensils, Check, Sparkles, ChevronDown, ChevronUp, Flame, CheckCircle2 } from 'lucide-react';
import { MealItem, MealLogState, PlanConfig, DayLog } from '../types';

interface NextMealSpotlightProps {
  plan: PlanConfig;
  day: DayLog;
  onUpdateDay: (updated: DayLog) => void;
}

export const NextMealSpotlight: React.FC<NextMealSpotlightProps> = ({
  plan,
  day,
  onUpdateDay,
}) => {
  const [showAlts, setShowAlts] = useState(false);

  if (!plan.meals || plan.meals.length === 0) {
    return null;
  }

  // Find the first meal that hasn't been logged yet (eval is not 'yes' or 'no')
  const unloggedMeal = plan.meals.find(meal => {
    const log = day.meals?.[meal.id];
    return !log || (!log.eval && log.type !== 'alt');
  });

  // If all logged, pick the last meal or show congratulation state
  const targetMeal = unloggedMeal || plan.meals[0];
  const allMealsLogged = !unloggedMeal;
  const currentLog = (targetMeal ? day.meals?.[targetMeal.id] : undefined) || {};

  const handleCommitMeal = (mealId: string) => {
    onUpdateDay({
      ...day,
      meals: {
        ...day.meals,
        [mealId]: {
          ...(day.meals?.[mealId] || {}),
          eval: 'yes',
          type: 'default',
          protein: true,
          veggies: true,
        },
      },
    });
  };

  const handleSelectAlternative = (mealId: string, altText: string) => {
    onUpdateDay({
      ...day,
      meals: {
        ...day.meals,
        [mealId]: {
          ...(day.meals?.[mealId] || {}),
          type: 'alt',
          detail: altText,
          eval: 'yes',
        },
      },
    });
    setShowAlts(false);
  };

  if (allMealsLogged) {
    return (
      <div className="bg-gradient-to-br from-peacock-blue/10 via-peacock-blue/5 to-transparent border border-peacock-teal-light/60 dark:border-peacock-indigo-deep/60 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-peacock-blue text-white flex items-center justify-center shrink-0 shadow-sm shadow-peacock-blue/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
              تم تسجيل جميع وجبات اليوم المقررة
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              تم توثيق كافة وجبات الخطة اليومية.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white via-rose-50/20 to-peacock-mist/20 dark:from-slate-900 dark:via-rose-950/10 dark:to-peacock-ink-deep/10 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm transition-all space-y-3.5">
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-black">
            <Sparkles className="w-3.5 h-3.5" />
            <span>الوجبة التالية</span>
          </span>
          {targetMeal.calories && (
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400">
              ~{targetMeal.calories} سعرة
            </span>
          )}
        </div>

        {targetMeal.alternatives && targetMeal.alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAlts(!showAlts)}
            className="text-xs font-bold text-peacock-indigo dark:text-peacock-teal hover:text-peacock-indigo flex items-center gap-1 cursor-pointer"
          >
            <span>البدائل</span>
            {showAlts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Meal Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
            {targetMeal.name}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-medium">
            {targetMeal.items}
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => handleCommitMeal(targetMeal.id)}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-peacock-blue to-peacock-indigo hover:from-peacock-indigo hover:to-peacock-indigo text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-peacock-blue/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Check className="w-4 h-4" />
          <span>تسجيل الوجبة</span>
        </button>
      </div>

      {/* Expandable Alternatives */}
      {showAlts && targetMeal.alternatives && targetMeal.alternatives.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 animate-in fade-in duration-150">
          <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
            اختر بديلاً معتمداً لهذه الوجبة:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {targetMeal.alternatives.map((alt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectAlternative(targetMeal.id, alt)}
                className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/40 border border-slate-200/80 dark:border-slate-700/80 hover:border-peacock-teal-light text-right transition-all cursor-pointer flex items-center justify-between gap-2"
              >
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{alt}</span>
                <span className="text-[11px] font-bold text-peacock-indigo shrink-0">اختيار ←</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
