import React, { useMemo, useState } from 'react';
import { Award, Share2, Lock } from 'lucide-react';
import { DayLog, PlanConfig } from '../types';
import { loadDayLog, getTodayDateString, getAllStoredDayLogs } from '../utils/storage';
import {
  MILESTONE_DEFINITIONS,
  MilestoneDefinition,
  computeMilestones,
  loadMilestonesUnlocked,
  getNextMilestone,
  getReportSharedAt,
} from '../utils/milestones';
import { VisualReportCard } from './VisualReportCard';

interface MilestonesSectionProps {
  plan: PlanConfig;
  compact?: boolean;
  onNotify: (msg: string) => void;
}

/**
 * Batch 2.3 — قسم «إنجازاتي»: شبكة المعالم كاملة في التقارير، أو بطاقة
 * مختصرة في تبويب الجسم. المشاركة كصورة عبر VisualReportCard بمتغير
 * «milestone» (لون/عنوان مختلفان).
 */
export const MilestonesSection: React.FC<MilestonesSectionProps> = ({ plan, compact = false, onNotify }) => {
  const [sharing, setSharing] = useState<MilestoneDefinition | null>(null);

  const unlocked = useMemo(() => {
    const stored = loadMilestonesUnlocked();
    if (Object.keys(stored).length > 0) return stored;
    // قبل أول تهيئة (تتم في تبويب اليوم) نعرض المحسوب مباشرة
    return computeMilestones(plan, getAllStoredDayLogs(), getReportSharedAt());
  }, [plan]);

  const unlockedCount = MILESTONE_DEFINITIONS.filter((d) => d.id in unlocked).length;
  const next = getNextMilestone(unlocked);
  const todayLog: DayLog = useMemo(() => loadDayLog(getTodayDateString()), []);

  if (compact) {
    return (
      <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-brand-text dark:text-peacock-pale text-sm">
            <Award className="w-4 h-4 text-amber-500" />
            إنجازاتي
          </span>
          <span className="text-xs font-black text-brand-hero dark:text-peacock-indigo-light">
            {unlockedCount} من {MILESTONE_DEFINITIONS.length}
          </span>
        </div>
        {unlockedCount > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {MILESTONE_DEFINITIONS.filter((d) => d.id in unlocked).map((d) => (
              <span
                key={d.id}
                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              >
                {d.icon} {d.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-medium text-brand-secondary-text dark:text-peacock-teal-light">
            لا إنجازات بعد — أول معلم يقترب مع أول يوم تسجيل 🌱
          </p>
        )}
        {next && (
          <p className="text-[11px] font-bold text-brand-secondary-text dark:text-peacock-teal-light">
            المعلم التالي: {next.icon} {next.label}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-5 transition-colors space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl text-amber-500 flex items-center justify-center font-bold text-sm">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-brand-text dark:text-peacock-pale text-sm">إنجازاتي 🏆</h3>
            <span className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light/70">
              فتحت {unlockedCount} من {MILESTONE_DEFINITIONS.length} معالم
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {MILESTONE_DEFINITIONS.map((def) => {
          const date = unlocked[def.id];
          const isOpen = !!date;
          return (
            <div
              key={def.id}
              className={`p-3 rounded-2xl border text-center space-y-1 ${
                isOpen
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  : 'bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/60 border-peacock-pale dark:border-peacock-ink/40 opacity-60'
              }`}
            >
              <div className="text-2xl">{isOpen ? def.icon : '🔒'}</div>
              <div className="text-xs font-black text-brand-text dark:text-peacock-pale">{def.label}</div>
              <div className="text-[11px] font-medium text-brand-secondary-text dark:text-peacock-teal-light leading-snug">
                {def.description}
              </div>
              {isOpen ? (
                <>
                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">فُتح في {date}</div>
                  <button
                    type="button"
                    onClick={() => setSharing(def)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-peacock-blue hover:bg-peacock-indigo text-white text-[11px] font-black cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" /> شارك كصورة
                  </button>
                </>
              ) : (
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> لم يُفتح بعد
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sharing && (
        <VisualReportCard
          plan={plan}
          day={todayLog}
          currentDate={getTodayDateString()}
          onClose={() => setSharing(null)}
          onNotify={onNotify}
          variant="milestone"
          milestoneLabel={`${sharing.icon} ${sharing.label}`}
        />
      )}
    </div>
  );
};
