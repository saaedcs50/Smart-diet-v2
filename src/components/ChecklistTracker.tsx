import React from 'react';
import { CheckSquare, Pill, Check, Circle, Info } from 'lucide-react';
import { PlanConfig, DayLog } from '../types';
import { isSectionVisible } from '../utils/storage';
import { HelpButton } from './FeatureHelpModal';

interface ChecklistTrackerProps {
  plan: PlanConfig;
  day: DayLog;
  onUpdateDay: (updated: DayLog) => void;
}

export const ChecklistTracker: React.FC<ChecklistTrackerProps> = ({ plan, day, onUpdateDay }) => {
  const showChecklist = isSectionVisible(plan, 'checklistTracker');
  const showSupplements = isSectionVisible(plan, 'supplementsTracker') && plan.supplements && plan.supplements.length > 0;

  if (!showChecklist && !showSupplements) {
    return null;
  }

  const toggleCheck = (id: string) => {
    onUpdateDay({
      ...day,
      checks: {
        ...(day.checks || {}),
        [id]: !day.checks?.[id],
      },
    });
  };

  const toggleSupp = (id: string) => {
    onUpdateDay({
      ...day,
      supps: {
        ...(day.supps || {}),
        [id]: !day.supps?.[id],
      },
    });
  };

  const completedChecksCount = (plan.checklist || []).filter((c) => day.checks?.[c.id]).length;
  const isAllChecksDone = completedChecksCount === plan.checklist.length && plan.checklist.length > 0;

  const completedSuppsCount = (plan.supplements || []).filter((s) => day.supps?.[s.id]).length;
  const isAllSuppsTaken = completedSuppsCount === (plan.supplements?.length || 0) && (plan.supplements?.length || 0) > 0;

  return (
    <div className="bg-[var(--app-card)] border border-[var(--app-border)]/80 rounded-3xl p-5 transition-colors space-y-4">
      {/* 1. Daily Habits Checklist */}
      {showChecklist && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl text-[#4D52B4] dark:text-[#70D6C5] flex items-center justify-center font-bold text-sm bg-peacock-mist dark:bg-peacock-ink-deep/40">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[var(--app-text-primary)] text-sm">
                    قائمة العادات اليومية 
                  </h3>
                  <HelpButton featureId="habitsChecklist" size="sm" />
                </div>
                <span className="text-[12px] text-[var(--app-text-secondary)]">
                  تم إنجاز {completedChecksCount} من {plan.checklist.length} مهام
                </span>
              </div>
            </div>

            {isAllChecksDone && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#4D52B4]/10 dark:bg-[#4D52B4]/20 text-[#4D52B4] dark:text-[#70D6C5] font-bold text-[12px] flex items-center gap-1">
                <Circle className="w-3 h-3 text-[#4D52B4]" />
                اكتملت جميع العادات
              </span>
            )}
          </div>

          <div className="space-y-2">
            {plan.checklist.map((item) => {
              const isDone = !!day.checks?.[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isDone
                      ? 'bg-[#4D52B4]/10 dark:bg-[#4D52B4]/15 border-[#4D52B4]/30 dark:border-[#4D52B4]/30'
                      : 'bg-[var(--app-card-muted)] border-[var(--app-border)]/60 hover:bg-[var(--app-card-muted)]'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold leading-relaxed ${
                      isDone
                        ? 'text-[#4D52B4] dark:text-[#70D6C5] line-through opacity-80'
                        : 'text-[var(--app-text-primary)]'
                    }`}
                  >
                    {item.label}
                  </span>

                  <div
                    className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
                      isDone
                        ? 'bg-[#4D52B4] border-[#4D52B4] text-white'
                        : 'border-[var(--app-border)] bg-[var(--app-card)]'
                    }`}
                  >
                    {isDone && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Supplements & Medications */}
      {showSupplements && (
        <div className={`${showChecklist ? 'pt-3 border-t border-[var(--app-border)]/50' : ''} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl text-[var(--app-secondary)] flex items-center justify-center font-bold text-sm bg-peacock-mist dark:bg-peacock-ink-deep/40">
                <Pill className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-[var(--app-text-primary)] text-xs">
                  الأدوية والمكملات المقررة 
                </h4>
                <span className="text-[12px] text-[var(--app-text-secondary)]">
                  تم أخذ {completedSuppsCount} من {plan.supplements.length} مكملات
                </span>
              </div>
            </div>

            {isAllSuppsTaken && (
              <span className="px-2.5 py-0.5 rounded-full bg-peacock-pale dark:bg-peacock-ink-deep/40 text-[var(--app-secondary)] font-bold text-[12px] flex items-center gap-1">
                <Circle className="w-3 h-3 text-[var(--app-secondary)]" />
                اكتملت جميع المكملات
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plan.supplements.map((supp) => {
              const isTaken = !!day.supps?.[supp.id];
              return (
                <button
                  key={supp.id}
                  onClick={() => toggleSupp(supp.id)}
                  className={`p-3 rounded-2xl border transition-all flex items-start justify-between text-right cursor-pointer gap-2 ${
                    isTaken
                      ? 'bg-[var(--app-secondary)]/10 dark:bg-[var(--app-secondary)]/15 border-[var(--app-secondary)]/30 dark:border-[var(--app-border)]'
                      : 'bg-[var(--app-card-muted)] border-[var(--app-border)]/60 hover:bg-[var(--app-card-muted)]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-bold block ${
                        isTaken
                          ? 'text-[var(--app-secondary)] dark:text-[var(--app-secondary)] line-through opacity-80'
                          : 'text-[var(--app-text-primary)]'
                      }`}
                    >
                      {supp.name}
                    </span>
                    {supp.time && (
                      <span className="text-[11px] text-[var(--app-text-secondary)] font-semibold mt-0.5 block">
                        ⏰ {supp.time}
                      </span>
                    )}
                    {supp.notes && !isTaken && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-md mt-1 inline-block border border-indigo-100/70 dark:border-indigo-900/30">
                        💡 {supp.notes}
                      </span>
                    )}
                  </div>

                  <div
                    className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-colors shrink-0 mt-0.5 ${
                      isTaken
                        ? 'bg-[var(--app-secondary)] border-[var(--app-secondary)] text-white'
                        : 'border-[var(--app-border)] bg-[var(--app-card)]'
                    }`}
                  >
                    {isTaken && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
