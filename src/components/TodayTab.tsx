import React, { useState, useMemo, useEffect } from 'react';
import {
  Lightbulb,
  Share2,
  Utensils,
  Droplets,
  Activity,
  CheckSquare,
  Bell,
  Sliders,
  Sparkles,
  Flame,
  Copy,
  X,
  Send
} from 'lucide-react';
import { PlanConfig, DayLog } from '../types';
import { BRAND } from '../config/brand';
import { ScoreBreakdown } from '../utils/calculations';
import { isSectionVisible, loadDayLog, getTodayDateString, parseLocalDate, getAllStoredDayLogs } from '../utils/storage';
import { buildCopiedDayLog, getCopySummary, hasCopyableContent, isDayEmptyOrPartial } from '../utils/dayCopy';
import { shouldShowCelebration, markCelebrationShown } from '../utils/celebration';
import { hasAnyDayActivity } from '../utils/streakReminder';
import {
  computeAbsenceGap,
  shouldShowWelcomeBack,
  buildWelcomeBackMessage,
  buildWelcomeBackWhatsAppText,
  getLastWelcomeBackGapDate,
  markWelcomeBackShown,
} from '../utils/welcomeBack';
import { openWhatsAppShare } from '../utils/whatsapp';
import {
  MILESTONE_DEFINITIONS,
  MilestoneDefinition,
  computeMilestones,
  resolveMilestoneState,
  loadMilestonesUnlocked,
  saveMilestonesUnlocked,
  markMilestonesInitialized,
  getReportSharedAt,
} from '../utils/milestones';
import { QuickActionBar } from './QuickActionBar';
import { DayCompleteModal } from './DayCompleteModal';
import { WeeklyFocusCard } from './WeeklyFocusCard';
import { ShoppingListModal } from './ShoppingListModal';
import { IntakeWizard } from './IntakeWizard';
import { MilestoneUnlockModal } from './MilestoneUnlockModal';
import { VisualReportCard } from './VisualReportCard';
import { BottomSheetModal } from './BottomSheetModal';
import { ActivityRings } from './ActivityRings';
import { WeekStripCalendar } from './WeekStripCalendar';
import { NextMealSpotlight } from './NextMealSpotlight';
import { MealCard } from './MealCard';
import { WaterTracker } from './WaterTracker';
import { SleepMoodTracker } from './SleepMoodTracker';
import { ChecklistTracker } from './ChecklistTracker';
import { SymptomsAndNotes } from './SymptomsAndNotes';
import { MacrosTracker } from './MacrosTracker';
import { FastingTimer } from './FastingTimer';
import { MedicationsTracker } from './MedicationsTracker';
import { CycleTrackerCard } from './CycleTrackerCard';
import { getCycleInfo } from '../utils/cycleTracking';
import { getTodayFastingStatus } from '../utils/fasting';
import { HelpButton } from './FeatureHelpModal';
import { CardCustomizerModal } from './CardCustomizerModal';

interface TodayTabProps {
  plan: PlanConfig;
  day: DayLog;
  currentDate: string;
  score: ScoreBreakdown;
  streak: number;
  onUpdateDay: (updated: DayLog) => void;
  onUpdatePlan?: (updater: (prev: PlanConfig) => PlanConfig) => void;
  onNotify?: (msg: string) => void;
  onOpenReportModal: () => void;
  onOpenStoryCard: () => void;
  onOpenImportModal: () => void;
  onOpenNotifications?: () => void;
  onToggleFreeze: () => void;
  onDateChange?: (newDate: string) => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  plan,
  day,
  currentDate,
  score,
  streak,
  onUpdateDay,
  onUpdatePlan,
  onNotify,
  onOpenReportModal,
  onOpenStoryCard,
  onOpenImportModal,
  onOpenNotifications,
  onToggleFreeze,
  onDateChange,
}) => {
  const [isCardCustomizerOpen, setIsCardCustomizerOpen] = useState(false);
  const cycleInfo = plan.cycleTracking?.enabled ? getCycleInfo(plan.cycleTracking, currentDate) : null;
  const fastingStatus = useMemo(() => getTodayFastingStatus(plan, day, currentDate), [plan, day, currentDate]);

  const todayStr = getTodayDateString();
  const isToday = currentDate === todayStr;

  // ── Batch 1.1: انسخ أمس ──────────────────────────────────────────────
  const yesterdayStr = useMemo(() => {
    const d = parseLocalDate(currentDate);
    d.setDate(d.getDate() - 1);
    return getTodayDateString(d);
  }, [currentDate]);
  const yesterdayLog = useMemo(() => loadDayLog(yesterdayStr), [yesterdayStr]);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const copySummary = useMemo(() => getCopySummary(yesterdayLog), [yesterdayLog]);
  const showCopyButton = hasCopyableContent(yesterdayLog) && isDayEmptyOrPartial(day);
  const todayHasData = hasAnyDayActivity(day);

  const handleConfirmCopyYesterday = () => {
    onUpdateDay(buildCopiedDayLog(yesterdayLog, currentDate, day));
    setShowCopyConfirm(false);
    onNotify?.('تم نسخ سجل أمس إلى اليوم ✅');
  };

  // ── Batch 1.3: لحظة إنجاز اليوم (مرة واحدة، لليوم الحالي فقط) ──────
  const [showCelebration, setShowCelebration] = useState(false);
  useEffect(() => {
    if (
      shouldShowCelebration({
        scoreTotal: score.total,
        currentDate,
        todayDate: todayStr,
        alreadyShown: day.celebrationShown,
        isFreezeDay: day.isFreeze,
      })
    ) {
      onUpdateDay(markCelebrationShown(day));
      setShowCelebration(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score.total, currentDate, day.celebrationShown, day.isFreeze]);

  // ── Batch 1.5: عودة بعد غياب (مرة واحدة لكل فجوة) ───────────────────
  const absence = useMemo(
    () => (isToday ? computeAbsenceGap(getAllStoredDayLogs(), todayStr) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isToday, todayStr, day]
  );
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcomeBack =
    !welcomeDismissed && !!absence && shouldShowWelcomeBack(absence, getLastWelcomeBackGapDate());
  useEffect(() => {
    if (showWelcomeBack && absence?.lastActivityDate) {
      markWelcomeBackShown(absence.lastActivityDate);
    }
  }, [showWelcomeBack, absence?.lastActivityDate]);

  // ── Batch 2.1/2.5: مداخل قائمة التسوق والاستبيان ────────────────────
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showIntakeWizard, setShowIntakeWizard] = useState(false);

  // ── Batch 2.3: تهيئة المعالم + الاحتفال بآخر معلم جديد فقط ──────────
  const [celebratedMilestone, setCelebratedMilestone] = useState<MilestoneDefinition | null>(null);
  const [milestoneToShare, setMilestoneToShare] = useState<MilestoneDefinition | null>(null);
  const [showMilestoneCard, setShowMilestoneCard] = useState(false);
  useEffect(() => {
    const stored = loadMilestonesUnlocked();
    const computed = computeMilestones(plan, getAllStoredDayLogs(), getReportSharedAt());
    const resolution = resolveMilestoneState(stored, computed);
    saveMilestonesUnlocked(resolution.unlocked);
    markMilestonesInitialized();
    // الحساب الرجعي والفتح الحي سواء: يُحتفل بآخر معلم جديد واحد فقط — لا احتفالات جماعية
    if (resolution.celebrationId && resolution.newlyUnlocked.length > 0) {
      const def = MILESTONE_DEFINITIONS.find((d) => d.id === resolution.celebrationId);
      if (def) setCelebratedMilestone(def);
    }
    // تُنفَّذ مرة واحدة عند الإقلاع
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Direct practical greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'صباح الخير' };
    if (hour >= 12 && hour < 17) return { text: 'مساء الخير' };
    if (hour >= 17 && hour < 22) return { text: 'مساء الخير' };
    return { text: 'ليلة سعيدة' };
  }, []);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200 pb-20">
      {/* 1. Clear, direct greeting banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
              {greeting.text}، {plan.clientName || 'المتدرب'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            متابعة الالتزام بالخطة الغذائية اليومية
          </p>
        </div>

        {/* Section Focus & Customizer Button */}
        <button
          type="button"
          onClick={() => setIsCardCustomizerOpen(true)}
          title="تخصيص البطاقات ونمط التركيز لتقليل التشتت"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-peacock-indigo dark:text-peacock-teal-light bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep hover:scale-105 transition-all cursor-pointer shadow-xs"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تخصيص العرض</span>
        </button>
      </div>

      {/* 2. Apple Fitness / iOS Style Horizontal Week Strip Calendar */}
      {onDateChange && (
        <WeekStripCalendar
          currentDate={currentDate}
          onDateChange={onDateChange}
        />
      )}

      {/* Batch 2.4: هدف الأسبوع يتصدر اليوم */}
      <WeeklyFocusCard plan={plan} day={day} currentDate={currentDate} onUpdateDay={onUpdateDay} />

      {/* Batch 1.5: Welcome-back card after an absence of 3+ days */}
      {showWelcomeBack && absence && (
        <div className="p-4 rounded-3xl bg-peacock-mist/90 dark:bg-peacock-ink-deep/30 border border-peacock-sage/80 dark:border-peacock-indigo-deep/60 flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
              {buildWelcomeBackMessage(absence.gapDays)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              آخر نشاط مسجل كان يوم {absence.lastActivityDate} — أي حاجة بسيطة النهاردة هترجعك للسلسلة.
            </p>
            <button
              type="button"
              onClick={() => {
                openWhatsAppShare(buildWelcomeBackWhatsAppText(plan, absence.gapDays));
                setWelcomeDismissed(true);
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-peacock-blue hover:bg-peacock-indigo text-white text-xs font-black transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>أرسل لأخصائيتك إنك رجعت</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setWelcomeDismissed(true)}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="إغلاق بطاقة الترحيب"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Batch 1.1: Copy yesterday button */}
      {showCopyButton && (
        <button
          type="button"
          onClick={() => setShowCopyConfirm(true)}
          className="w-full p-3.5 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-dashed border-peacock-teal-light dark:border-peacock-indigo hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Copy className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
          <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200">انسخ أمس</span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            كرر وجبات وأدوية وماء أمس في هذا اليوم
          </span>
        </button>
      )}

      {/* Batch 2.1 + 2.5: مداخل تسوق الأسبوع والاستبيان */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setShowShoppingList(true)}
          className="p-3.5 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-peacock-sage dark:border-peacock-indigo-deep hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="text-sm">🛒</span>
          <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200">تسوق الأسبوع</span>
        </button>
        <button
          type="button"
          onClick={() => setShowIntakeWizard(true)}
          className="p-3.5 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-peacock-sage dark:border-peacock-indigo-deep hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="text-sm">📋</span>
          <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200">استبيان عميل جديد</span>
        </button>
      </div>

      {/* Optional Subtle Cycle Phase Badge */}
      {plan.cycleTracking?.enabled &&
        plan.cycleTracking?.showPhaseToClient !== false &&
        cycleInfo &&
        cycleInfo.dayOfCycle !== null && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 text-xs">
            <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-200">
              <span className="text-sm">{cycleInfo.icon}</span>
              <span>
                اليوم {cycleInfo.dayOfCycle} من الدورة • {cycleInfo.phaseName}
              </span>
            </div>
            <span className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full border ${cycleInfo.colorClass.badge}`}>
              {cycleInfo.isPeriodDay ? 'أيام الحيض ' : cycleInfo.phaseBadge}
            </span>
          </div>
        )}

      {/* 3. Apple Health / iOS Fitness Concentric Activity Rings Card */}
      {isSectionVisible(plan, 'scoreCard') && (
        <ActivityRings
          score={score}
          streak={streak}
          isFreeze={day.isFreeze}
          plan={plan}
          day={day}
          onToggleFreeze={onToggleFreeze}
          onOpenReportModal={onOpenReportModal}
          onOpenStoryCard={onOpenStoryCard}
        />
      )}

      {/* 4. Lifesum Next Meal Spotlight */}
      {isSectionVisible(plan, 'mealsList') && (
        <NextMealSpotlight
          plan={plan}
          day={day}
          onUpdateDay={onUpdateDay}
        />
      )}

      {/* 5. Doctor Tips & Guidance Banner */}
      {isSectionVisible(plan, 'tipsBanner') && plan.tips && plan.tips.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-1.5 transition-all">
          <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-400">
            <Lightbulb className="w-4 h-4" />
            <span>توجيه وإرشاد اليوم من {BRAND.doctorName}:</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
            "{plan.tips[Math.abs(currentDate.split('-').reduce((a, b) => a + Number(b), 0)) % plan.tips.length]}"
          </p>
        </div>
      )}

      {/* 6. Vitals: Macros & Fasting (if enabled) */}
      {(isSectionVisible(plan, 'macrosTracker') || isSectionVisible(plan, 'fastingTimer')) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isSectionVisible(plan, 'macrosTracker') && (
            <MacrosTracker
              plan={plan}
              day={day}
              onUpdateDay={onUpdateDay}
            />
          )}

          {isSectionVisible(plan, 'fastingTimer') && (
            <FastingTimer
              plan={plan}
              day={day}
              currentDate={currentDate}
              onUpdateDay={onUpdateDay}
            />
          )}
        </div>
      )}

      {/* 6.5 Medications Tracker (if configured & visible) */}
      {isSectionVisible(plan, 'medicationsTracker') && (
        <MedicationsTracker
          plan={plan}
          day={day}
          onUpdateDay={onUpdateDay}
        />
      )}

      {/* 6.6 Menstrual Cycle Tracker (if configured & visible) */}
      {plan.cycleTracking?.enabled && isSectionVisible(plan, 'cycleTracker') && (
        <CycleTrackerCard
          plan={plan}
          day={day}
          currentDate={currentDate}
          onUpdateDay={(updater) => onUpdateDay(typeof updater === 'function' ? updater(day) : updater)}
          onUpdatePlan={onUpdatePlan || (() => {})}
          onNotify={onNotify}
        />
      )}

      {/* 7. All Planned Meals Food Diary */}
      {isSectionVisible(plan, 'mealsList') && plan.meals && plan.meals.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-peacock-mist dark:bg-peacock-ink-deep/40 text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-bold">
                <Utensils className="w-4 h-4" />
              </div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                يوميات وجبات اليوم ({plan.meals.length})
              </h3>
              <HelpButton featureId="mealsList" size="sm" />
            </div>
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="text-xs font-bold text-slate-500 hover:text-peacock-indigo dark:text-slate-400 dark:hover:text-peacock-teal transition-colors flex items-center gap-1 cursor-pointer"
                title="مواعيد الوجبات"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>مواعيد الوجبات</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {plan.meals.map((meal, idx) => (
              <MealCard
                key={meal.id}
                meal={meal}
                index={idx}
                fastingStatus={fastingStatus}
                state={day.meals[meal.id]}
                onUpdate={(st) =>
                  onUpdateDay({
                    ...day,
                    meals: {
                      ...day.meals,
                      [meal.id]: st,
                    },
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* 8. Noom/Lifesum Interactive Water Tracker */}
      {isSectionVisible(plan, 'waterTracker') && (
        <section>
          <WaterTracker
            plan={plan}
            day={day}
            onUpdateDay={onUpdateDay}
          />
        </section>
      )}

      {/* 9. Sleep, Mood & Movement */}
      <section>
        <SleepMoodTracker
          plan={plan}
          day={day}
          onUpdateDay={onUpdateDay}
        />
      </section>

      {/* 10. Habits & Supplements */}
      <section>
        <ChecklistTracker
          plan={plan}
          day={day}
          onUpdateDay={onUpdateDay}
        />
      </section>

      {/* 11. Symptoms & Doctor Notes */}
      <section>
        <SymptomsAndNotes
          plan={plan}
          day={day}
          onUpdateDay={onUpdateDay}
        />
      </section>

      {/* 12. Bottom WhatsApp Quick Share Report Button */}
      {isSectionVisible(plan, 'quickReportBtn') && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenReportModal}
            className="w-full py-3.5 min-h-[48px] px-6 rounded-3xl bg-gradient-to-r from-peacock-blue to-peacock-indigo hover:from-peacock-indigo hover:to-peacock-indigo text-white font-black text-sm sm:text-base transition-all shadow-lg shadow-peacock-blue/25 flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.01]"
          >
            <Share2 className="w-5 h-5" />
            <span>إرسال تقرير اليوم لـ{BRAND.doctorNameAlt}</span>
          </button>
        </div>
      )}

      {/* Batch 1.2: Fixed quick action bar (Today tab only) */}
      <QuickActionBar plan={plan} day={day} onUpdateDay={onUpdateDay} />

      {/* Batch 1.3: Day-complete celebration (once per day) */}
      <DayCompleteModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        plan={plan}
        day={day}
        streak={streak}
        onShare={onOpenStoryCard}
      />

      {/* Batch 1.1: Copy-yesterday confirmation */}
      <BottomSheetModal
        isOpen={showCopyConfirm}
        onClose={() => setShowCopyConfirm(false)}
        title="نسخ سجل أمس إلى اليوم"
      >
        <div dir="rtl" className="space-y-3">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">سيتم نسخ الآتي من أمس:</p>
          <ul className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pr-5">
            <li>{copySummary.mealsCount} وجبات بحالتها المسجلة</li>
            <li>{copySummary.medicationsTakenCount} جرعات دواء مأخوذة</li>
            <li>{copySummary.waterMl} مل ماء</li>
            <li>{copySummary.checksCount} بنود من قائمة المهام اليومية</li>
          </ul>
          {todayHasData && (
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 rounded-2xl p-3">
              تنبيه: هذا اليوم فيه بيانات بالفعل — سيتم الدمج/الاستبدال للحقول المنسوخة فقط.
            </p>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            لن يتم نسخ الوزن أو النوم أو المزاج أو الأعراض أو الملاحظات — دي بيانات خاصة بكل يوم.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirmCopyYesterday}
              className="flex-1 py-3 rounded-2xl bg-peacock-blue hover:bg-peacock-indigo text-white font-black text-sm cursor-pointer transition-colors"
            >
              تأكيد النسخ
            </button>
            <button
              type="button"
              onClick={() => setShowCopyConfirm(false)}
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm cursor-pointer transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </BottomSheetModal>

      {/* Batch 2.1: قائمة التسوق الأسبوعية */}
      <ShoppingListModal
        isOpen={showShoppingList}
        onClose={() => setShowShoppingList(false)}
        plan={plan}
        onNotify={onNotify || (() => {})}
      />

      {/* Batch 2.5: استبيان العميل الجديد (مسودة فقط) */}
      {showIntakeWizard && (
        <IntakeWizard
          isOpen={showIntakeWizard}
          onClose={() => setShowIntakeWizard(false)}
          plan={plan}
          onNotify={onNotify || (() => {})}
        />
      )}

      {/* Batch 2.3: احتفال فتح معلم + بطاقة مشاركته */}
      <MilestoneUnlockModal
        isOpen={!!celebratedMilestone}
        onClose={() => setCelebratedMilestone(null)}
        milestone={celebratedMilestone}
        onShare={() => {
          setMilestoneToShare(celebratedMilestone);
          setShowMilestoneCard(true);
        }}
      />
      {showMilestoneCard && milestoneToShare && (
        <VisualReportCard
          plan={plan}
          day={day}
          currentDate={currentDate}
          onClose={() => {
            setShowMilestoneCard(false);
            setMilestoneToShare(null);
          }}
          onNotify={onNotify || (() => {})}
          variant="milestone"
          milestoneLabel={`${milestoneToShare.icon} ${milestoneToShare.label}`}
        />
      )}

      {/* Card Customizer Modal */}
      {isCardCustomizerOpen && (
        <CardCustomizerModal
          isOpen={isCardCustomizerOpen}
          onClose={() => setIsCardCustomizerOpen(false)}
          plan={plan}
          onUpdatePlan={(updated) => {
            if (onUpdatePlan) {
              onUpdatePlan(() => updated);
            }
          }}
          onNotify={onNotify || (() => {})}
        />
      )}
    </div>
  );
};
