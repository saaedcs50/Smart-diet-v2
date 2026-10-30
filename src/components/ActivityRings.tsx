import React from 'react';
import { Utensils, Droplets, Sparkles, Flame, Snowflake, Trophy, Share2 } from 'lucide-react';
import { ScoreBreakdown } from '../utils/calculations';
import { PlanConfig, DayLog, MealLogState } from '../types';

interface ActivityRingsProps {
  score: ScoreBreakdown;
  streak: number;
  isFreeze: boolean;
  plan: PlanConfig;
  day: DayLog;
  onToggleFreeze: () => void;
  onOpenReportModal: () => void;
  onOpenStoryCard: () => void;
}

export const ActivityRings: React.FC<ActivityRingsProps> = ({
  score,
  streak,
  isFreeze,
  plan,
  day,
  onToggleFreeze,
  onOpenReportModal,
  onOpenStoryCard,
}) => {
  // Calculations for individual rings:
  // 1. Meals Ring (0 - 100%)
  const totalMeals = plan.meals?.length || 1;
  const committedMealsCount = Object.values(day.meals || {}).filter(m => (m as MealLogState)?.eval === 'yes').length;
  const mealsPercent = Math.min(100, Math.round((committedMealsCount / totalMeals) * 100));

  // 2. Water Ring (0 - 100%)
  const waterGoal = plan.waterGoalMl || 2500;
  const currentWater = day.water || 0;
  const waterPercent = Math.min(100, Math.round((currentWater / waterGoal) * 100));

  // 3. Habits & Wellness Ring (0 - 100%)
  const totalChecklist = plan.checklist?.length || 0;
  const checkedCount = (plan.checklist || []).filter(c => day.checks?.[c.id]).length;
  const habitsPercent = totalChecklist > 0 
    ? Math.min(100, Math.round((checkedCount / totalChecklist) * 100))
    : (day.sleepHours ? 100 : 0);

  // SVG Concentric Circles Math
  // Center is (90, 90)
  // Ring 1 (Meals): R=72 -> C = 2 * PI * 72 = 452.39
  const r1 = 72;
  const c1 = 2 * Math.PI * r1;
  const offset1 = c1 - (mealsPercent / 100) * c1;

  // Ring 2 (Water): R=56 -> C = 2 * PI * 56 = 351.86
  const r2 = 56;
  const c2 = 2 * Math.PI * r2;
  const offset2 = c2 - (waterPercent / 100) * c2;

  // Ring 3 (Habits): R=40 -> C = 2 * PI * 40 = 251.33
  const r3 = 40;
  const c3 = 2 * Math.PI * r3;
  const offset3 = c3 - (habitsPercent / 100) * c3;

  // Clear adherence status
  let feedback = 'متابعة الالتزام بالخطة المحددة اليوم.';
  if (isFreeze) {
    feedback = 'يوم راحة مسجل (Free Day)';
  } else if (score.total >= 90) {
    feedback = 'اكتمل الالتزام بالخطة اليومية.';
  } else if (score.total >= 70) {
    feedback = 'مستوى الالتزام مرتفع اليوم.';
  } else if (score.total >= 40) {
    feedback = 'جاري استكمال تسجيل الوجبات والماء اليوم.';
  }

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-sm transition-all space-y-5">
      {/* Top Banner: Streak & Freeze Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {streak >= 1 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
              <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>{streak} {streak === 1 ? 'يوم' : streak === 2 ? 'يومان' : 'أيام'} متتالية</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
              <Trophy className="w-3.5 h-3.5 text-peacock-indigo" />
              <span>سلسلة الالتزام</span>
            </div>
          )}
        </div>

        {/* Free Day Button */}
        <button
          type="button"
          onClick={onToggleFreeze}
          className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            isFreeze
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
          }`}
          title="تسجيل يوم استراحة لا يكسر السلسلة"
        >
          <Snowflake className={`w-3.5 h-3.5 ${isFreeze ? 'text-white' : 'text-sky-500'}`} />
          <span>{isFreeze ? 'يوم راحة نشط' : 'يوم راحة (Free)'}</span>
        </button>
      </div>

      {/* Main Rings + Metrics Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* The 3 Concentric Activity Rings (Apple Fitness Style) */}
        <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
            {/* Background Tracks */}
            <circle
              cx="90"
              cy="90"
              r={r1}
              stroke="currentColor"
              strokeWidth="11"
              fill="none"
              className="text-peacock-blue-light dark:text-peacock-ink-deep/40"
            />
            <circle
              cx="90"
              cy="90"
              r={r2}
              stroke="currentColor"
              strokeWidth="11"
              fill="none"
              className="text-sky-100 dark:text-sky-950/40"
            />
            <circle
              cx="90"
              cy="90"
              r={r3}
              stroke="currentColor"
              strokeWidth="11"
              fill="none"
              className="text-peacock-pale dark:text-peacock-ink-deep/40"
            />

            {/* Active Concentric Rings with Rounded Caps */}
            {/* 1. Meals (Rose / Coral) */}
            <circle
              cx="90"
              cy="90"
              r={r1}
              stroke="#F43F5E"
              strokeWidth="11"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c1}
              strokeDashoffset={offset1}
              className="transition-all duration-500 ease-out"
            />

            {/* 2. Water (Sky Blue) */}
            <circle
              cx="90"
              cy="90"
              r={r2}
              stroke="#0284C7"
              strokeWidth="11"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c2}
              strokeDashoffset={offset2}
              className="transition-all duration-500 ease-out"
            />

            {/* 3. Habits (Emerald Mint) */}
            <circle
              cx="90"
              cy="90"
              r={r3}
              stroke="#10B981"
              strokeWidth="11"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c3}
              strokeDashoffset={offset3}
              className="transition-all duration-500 ease-out"
            />
          </svg>

          {/* Ring Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white leading-none">
              {score.total}%
            </span>
            <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-400 mt-1">
              الالتزام
            </span>
          </div>
        </div>

        {/* Breakdown Badges (Noom / Lifesum Style) */}
        <div className="flex-1 w-full space-y-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              حلقات النشاط اليومية
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {feedback}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {/* Meals Metric */}
            <div className="p-2.5 rounded-2xl bg-peacock-pale/60 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-ink/50 flex items-center sm:flex-col sm:items-start gap-2.5 sm:gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-peacock-indigo-dark dark:text-peacock-blue-light">
                <span className="w-2.5 h-2.5 rounded-full bg-peacock-teal shrink-0" />
                <Utensils className="w-3.5 h-3.5" />
                <span>الوجبات</span>
              </div>
              <div className="text-sm font-black text-slate-800 dark:text-slate-100 mr-auto sm:mr-0">
                {committedMealsCount} <span className="text-xs font-normal text-slate-500">من {totalMeals}</span>
              </div>
            </div>

            {/* Water Metric */}
            <div className="p-2.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 flex items-center sm:flex-col sm:items-start gap-2.5 sm:gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                <Droplets className="w-3.5 h-3.5" />
                <span>الماء</span>
              </div>
              <div className="text-sm font-black text-slate-800 dark:text-slate-100 mr-auto sm:mr-0">
                {currentWater} <span className="text-xs font-normal text-slate-500">مل</span>
              </div>
            </div>

            {/* Habits Metric */}
            <div className="p-2.5 rounded-2xl bg-peacock-mist/60 dark:bg-peacock-ink-deep/30 border border-peacock-pale dark:border-peacock-ink/50 flex items-center sm:flex-col sm:items-start gap-2.5 sm:gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-peacock-indigo-dark dark:text-peacock-teal-light">
                <span className="w-2.5 h-2.5 rounded-full bg-peacock-blue shrink-0" />
                <Sparkles className="w-3.5 h-3.5" />
                <span>العادات</span>
              </div>
              <div className="text-sm font-black text-slate-800 dark:text-slate-100 mr-auto sm:mr-0">
                {habitsPercent}% <span className="text-xs font-normal text-slate-500">تمت</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Footer: Share Story / Report */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onOpenStoryCard}
          className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-peacock-indigo dark:hover:text-peacock-teal font-bold transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-peacock-blue" />
          <span>مشاركة كرت الإنجاز كصورة 📸</span>
        </button>

        <button
          type="button"
          onClick={onOpenReportModal}
          className="inline-flex items-center gap-1.5 text-peacock-indigo dark:text-peacock-teal hover:text-peacock-indigo font-bold transition-colors cursor-pointer"
        >
          <span>إرسال تقرير اليوم للأخصائي ↗</span>
        </button>
      </div>
    </div>
  );
};
