import React, { useState, useEffect } from 'react';
import { 
  Timer, 
  Play, 
  Square, 
  Circle, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  Award, 
  ChevronDown, 
  Info, 
  Droplets, 
  Sparkles, 
  Moon, 
  Sun, 
  Leaf, 
  Fish, 
  BookOpen, 
  Flame,
  Check
} from 'lucide-react';
import { DayLog, PlanConfig, ActiveFastingSession } from '../types';
import { 
  getActiveFastingSession, 
  saveActiveFastingSession, 
  clearActiveFastingSession, 
  getTodayDateString 
} from '../utils/storage';
import { HelpButton } from './FeatureHelpModal';
import { 
  getTodayFastingStatus, 
  PLANT_PROTEIN_COMBOS, 
  SUHUR_SMART_TIPS 
} from '../utils/fasting';

interface FastingTimerProps {
  plan: PlanConfig;
  day: DayLog;
  currentDate?: string;
  onUpdateDay: (updated: DayLog) => void;
}

export const FastingTimer: React.FC<FastingTimerProps> = ({ 
  plan, 
  day, 
  currentDate = getTodayDateString(), 
  onUpdateDay 
}) => {
  const [activeSession, setActiveSession] = useState<ActiveFastingSession>(() => getActiveFastingSession());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showConfirmStop, setShowConfirmStop] = useState(false);
  const [showAdjustStart, setShowAdjustStart] = useState(false);
  const [showRehydrationModal, setShowRehydrationModal] = useState(false);
  const [showSuhurGuideModal, setShowSuhurGuideModal] = useState(false);
  const [showProteinCombinerModal, setShowProteinCombinerModal] = useState(false);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  const fastingStatus = getTodayFastingStatus(plan, day, currentDate);
  const targetHours = fastingStatus.targetHours || plan.fastingTargetHours || 16;
  
  const isFasting = (activeSession.isActive && activeSession.startTime !== null) || !!day.isFasting;
  const startTime = activeSession.isActive && activeSession.startTime ? activeSession.startTime : day.fastingStartTime;
  const completedHours = day.completedFastingHours;

  // Real-time clock updater
  useEffect(() => {
    const clockInterval = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Sync activeSession with storage
  useEffect(() => {
    const session = getActiveFastingSession();
    setActiveSession(session);
  }, [currentDate, day.isFasting, day.fastingStartTime]);

  // Intermittent timer ticker
  useEffect(() => {
    let interval: any = null;
    if (isFasting && startTime) {
      const updateElapsed = () => {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(Math.max(0, diff));
      };
      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isFasting, startTime]);

  const handleStartFasting = (customHoursAgo: number = 0) => {
    const startTimestamp = Date.now() - (customHoursAgo * 3600 * 1000);
    const newSession: ActiveFastingSession = {
      isActive: true,
      startTime: startTimestamp,
      targetHours,
      startDateStr: currentDate || getTodayDateString(),
    };
    saveActiveFastingSession(newSession);
    setActiveSession(newSession);

    onUpdateDay({
      ...day,
      isFasting: true,
      fastingStartTime: startTimestamp,
      fastingEndTime: null,
    });
    setShowAdjustStart(false);
  };

  const handleConfirmStop = () => {
    const hoursFasted = Number((elapsedSeconds / 3600).toFixed(1));
    clearActiveFastingSession();
    setActiveSession({ isActive: false, startTime: null });

    onUpdateDay({
      ...day,
      isFasting: false,
      fastingStartTime: null,
      fastingEndTime: Date.now(),
      completedFastingHours: hoursFasted,
    });
    setShowConfirmStop(false);
  };

  const handleResetFast = () => {
    clearActiveFastingSession();
    setActiveSession({ isActive: false, startTime: null });

    onUpdateDay({
      ...day,
      isFasting: false,
      fastingStartTime: null,
      fastingEndTime: null,
      completedFastingHours: null,
    });
    setShowConfirmStop(false);
  };

  // Toggle manual fasting override for today
  const handleToggleTodayFasting = (enable: boolean) => {
    onUpdateDay({
      ...day,
      isFastingDay: enable,
      fastingTypeOverride: enable ? (plan.fastingPlan?.type || 'islamic') : 'none',
    });
  };

  // Calculations for Intermittent mode
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const targetSeconds = targetHours * 3600;
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100));
  const isGoalReached = elapsedSeconds >= targetSeconds;

  // Calculations for Islamic Solar times (Fajr to Maghrib countdown)
  const getIslamicCountdown = () => {
    if (fastingStatus.type !== 'islamic' || !fastingStatus.isFasting) return null;

    const [fajrH, fajrM] = (fastingStatus.fajrTime || '04:30').split(':').map(Number);
    const [maghribH, maghribM] = (fastingStatus.maghribTime || '18:15').split(':').map(Number);

    const nowH = nowTime.getHours();
    const nowM = nowTime.getMinutes();
    const nowS = nowTime.getSeconds();

    const currentSecs = nowH * 3600 + nowM * 60 + nowS;
    const fajrSecs = fajrH * 3600 + fajrM * 60;
    const maghribSecs = maghribH * 3600 + maghribM * 60;

    const isDaytime = currentSecs >= fajrSecs && currentSecs < maghribSecs;

    if (isDaytime) {
      const remainingSecs = Math.max(0, maghribSecs - currentSecs);
      const totalDaySecs = maghribSecs - fajrSecs;
      const elapsedDaySecs = currentSecs - fajrSecs;
      const pct = Math.min(100, Math.round((elapsedDaySecs / totalDaySecs) * 100));

      const rH = Math.floor(remainingSecs / 3600);
      const rM = Math.floor((remainingSecs % 3600) / 60);
      const rS = remainingSecs % 60;

      return {
        phase: 'daytime',
        title: 'صيام النهار (حتى مدفع الإفطار)',
        targetLabel: `أذان المغرب: ${fastingStatus.maghribTime}`,
        hours: rH,
        minutes: rM,
        seconds: rS,
        progressPercent: pct,
        isComplete: remainingSecs === 0,
      };
    } else {
      // Nighttime: Eating / Rehydration / Suhur window
      let remainingSecs: number;
      if (currentSecs >= maghribSecs) {
        // From maghrib to midnight + midnight to fajr
        remainingSecs = (86400 - currentSecs) + fajrSecs;
      } else {
        // Before fajr in early morning
        remainingSecs = fajrSecs - currentSecs;
      }

      const rH = Math.floor(remainingSecs / 3600);
      const rM = Math.floor((remainingSecs % 3600) / 60);
      const rS = remainingSecs % 60;

      return {
        phase: 'nighttime',
        title: 'نافذة الإفطار والسحور والترطيب',
        targetLabel: `موعد الإمساك والفجر: ${fastingStatus.fajrTime}`,
        hours: rH,
        minutes: rM,
        seconds: rS,
        progressPercent: 100,
        isComplete: false,
      };
    }
  };

  const islamicCountdown = getIslamicCountdown();

  // Calculations for Christian Abstinence countdown
  const getChristianAbstinenceCountdown = () => {
    if (fastingStatus.type !== 'christian' || !fastingStatus.abstinenceEndTime) return null;

    const [endH, endM] = fastingStatus.abstinenceEndTime.split(':').map(Number);
    const nowH = nowTime.getHours();
    const nowM = nowTime.getMinutes();
    const nowS = nowTime.getSeconds();

    const currentSecs = nowH * 3600 + nowM * 60 + nowS;
    const endSecs = endH * 3600 + endM * 60;

    if (currentSecs < endSecs) {
      const remainingSecs = endSecs - currentSecs;
      const rH = Math.floor(remainingSecs / 3600);
      const rM = Math.floor((remainingSecs % 3600) / 60);
      const rS = remainingSecs % 60;

      return {
        isActive: true,
        hours: rH,
        minutes: rM,
        seconds: rS,
        endTime: fastingStatus.abstinenceEndTime,
      };
    }

    return {
      isActive: false,
      hours: 0,
      minutes: 0,
      seconds: 0,
      endTime: fastingStatus.abstinenceEndTime,
    };
  };

  const christianCountdown = getChristianAbstinenceCountdown();

  return (
    <div className="bg-[var(--app-card)] border border-[var(--app-border)]/80 rounded-3xl p-4 sm:p-5 transition-all shadow-xs space-y-4">
      {/* Header with Type Badge & Quick Fasting Toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)]/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-bold">
            {fastingStatus.type === 'islamic' ? (
              <Moon className="w-5 h-5 text-peacock-indigo dark:text-peacock-teal" />
            ) : fastingStatus.type === 'christian' ? (
              <Leaf className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Timer className="w-5 h-5 text-peacock-indigo dark:text-peacock-teal" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                {fastingStatus.titleAr}
              </h3>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-peacock-mist dark:bg-peacock-ink-deep/50 text-peacock-indigo dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep/80">
                {fastingStatus.badgeLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {fastingStatus.subtitleAr}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Day Fasting Quick Switcher */}
          <button
            type="button"
            onClick={() => handleToggleTodayFasting(!fastingStatus.isFasting)}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-colors flex items-center gap-1 cursor-pointer ${
              fastingStatus.isFasting
                ? 'bg-peacock-mist dark:bg-peacock-ink-deep/40 border-peacock-teal-light text-peacock-indigo-dark dark:text-peacock-teal-light'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
            title="تبديل حالة الصيام لهذا اليوم"
          >
            {fastingStatus.isFasting ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>صائم اليوم</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>يوم فطر</span>
              </>
            )}
          </button>
          <HelpButton featureId="fastingTimer" size="sm" />
        </div>
      </div>

      {/* VIEW 1: ISLAMIC FASTING MODE */}
      {fastingStatus.type === 'islamic' && fastingStatus.isFasting && islamicCountdown && (
        <div className="space-y-3.5 animate-in fade-in">
          {/* Main Islamic Countdown Box */}
          <div className="p-4 rounded-2xl bg-peacock-mist/60 dark:bg-peacock-ink-deep/30 border border-peacock-sage/80 dark:border-peacock-indigo-deep/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-peacock-indigo-deep dark:text-peacock-sage flex items-center gap-1.5">
                {islamicCountdown.phase === 'daytime' ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
                )}
                {islamicCountdown.title}
              </span>
              <span className="text-[11px] font-bold text-peacock-indigo-dark dark:text-peacock-teal-light">
                {islamicCountdown.targetLabel}
              </span>
            </div>

            {/* Countdown digits */}
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="flex flex-col items-center">
                <span className="font-mono text-2xl sm:text-3xl font-black text-peacock-ink-deep dark:text-peacock-pale">
                  {String(islamicCountdown.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-peacock-indigo-dark dark:text-peacock-teal-light font-bold">ساعة</span>
              </div>
              <span className="text-2xl font-bold text-peacock-teal dark:text-peacock-indigo">:</span>
              <div className="flex flex-col items-center">
                <span className="font-mono text-2xl sm:text-3xl font-black text-peacock-ink-deep dark:text-peacock-pale">
                  {String(islamicCountdown.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-peacock-indigo-dark dark:text-peacock-teal-light font-bold">دقيقة</span>
              </div>
              <span className="text-2xl font-bold text-peacock-teal dark:text-peacock-indigo">:</span>
              <div className="flex flex-col items-center">
                <span className="font-mono text-2xl sm:text-3xl font-black text-peacock-ink-deep dark:text-peacock-pale">
                  {String(islamicCountdown.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-peacock-indigo-dark dark:text-peacock-teal-light font-bold">ثانية</span>
              </div>
            </div>

            {/* Daytime Progress Bar */}
            {islamicCountdown.phase === 'daytime' && (
              <div className="space-y-1">
                <div className="w-full bg-peacock-sage/60 dark:bg-peacock-ink/60 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-peacock-indigo h-full rounded-full transition-all duration-300"
                    style={{ width: `${islamicCountdown.progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-peacock-indigo-dark dark:text-peacock-teal">
                  <span>الإمساك {fastingStatus.fajrTime}</span>
                  <span>{islamicCountdown.progressPercent}% من ساعات الصيام</span>
                  <span>الإفطار {fastingStatus.maghribTime}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Tools: Rehydration Plan + Suhur Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShowRehydrationModal(true)}
              className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-right flex items-center justify-between gap-2 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-sky-500 shrink-0" />
                <div>
                  <span className="text-xs font-black text-sky-900 dark:text-sky-200 block">
                    جدول ترطيب الماء الليلي
                  </span>
                  <span className="text-[11px] text-sky-700 dark:text-sky-300 block">
                    توزيع الحصص من المغرب للفجر
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-sky-600 -rotate-90" />
            </button>

            <button
              type="button"
              onClick={() => setShowSuhurGuideModal(true)}
              className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-right flex items-center justify-between gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                    دليل السحور الذكي
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 block">
                    أغذية البوتاسيوم والشبع المستمر
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-amber-600 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: CHRISTIAN FASTING MODE */}
      {fastingStatus.type === 'christian' && fastingStatus.isFasting && (
        <div className="space-y-3.5 animate-in fade-in">
          {/* Christian Abstinence Box */}
          {christianCountdown && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  {christianCountdown.isActive 
                    ? 'فترة الصيام الانقطاعي الصباحي (انقطاع تام)'
                    : 'اكتمل وقت الصيام الانقطاعي (نافذة الأكل النباتي مفتوحة)'}
                </span>
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  كسر الصيام: {christianCountdown.endTime}
                </span>
              </div>

              {christianCountdown.isActive ? (
                <div className="flex items-center justify-center gap-3 py-1">
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-2xl sm:text-3xl font-black text-indigo-950 dark:text-indigo-100">
                      {String(christianCountdown.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">ساعة</span>
                  </div>
                  <span className="text-2xl font-bold text-indigo-400 dark:text-indigo-600">:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-2xl sm:text-3xl font-black text-indigo-950 dark:text-indigo-100">
                      {String(christianCountdown.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">دقيقة</span>
                  </div>
                  <span className="text-2xl font-bold text-indigo-400 dark:text-indigo-600">:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-2xl sm:text-3xl font-black text-indigo-950 dark:text-indigo-100">
                      {String(christianCountdown.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">ثانية</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-peacock-indigo-dark dark:text-peacock-teal-light bg-peacock-mist dark:bg-peacock-ink-deep/40 p-2.5 rounded-xl border border-peacock-sage dark:border-peacock-indigo-deep">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>يمكنك الآن تناول وجباتك النباتية المعتمدة واستخدام بنك البدائل في بطاقات الوجبات.</span>
                </div>
              )}
            </div>
          )}

          {/* Plant-based Protein Combiner Shortcut */}
          <button
            type="button"
            onClick={() => setShowProteinCombinerModal(true)}
            className="w-full p-3 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep text-right flex items-center justify-between gap-2 hover:bg-peacock-pale dark:hover:bg-peacock-ink/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-peacock-indigo dark:text-peacock-teal shrink-0" />
              <div>
                <span className="text-xs font-black text-peacock-ink dark:text-peacock-sage block">
                  مرشد دمج البروتين النباتي (Plant Protein Combiner)
                </span>
                <span className="text-[11px] text-peacock-indigo dark:text-peacock-teal-light block">
                  كيف تحصل على بروتين كامل القيمة الحيوية أثناء الصوم
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-peacock-indigo -rotate-90" />
          </button>
        </div>
      )}

      {/* VIEW 3: CLASSIC INTERMITTENT FASTING TIMER */}
      {fastingStatus.type === 'intermittent' && fastingStatus.isFasting && (
        <div className="space-y-4 animate-in fade-in">
          {/* Confirm Stop Fasting Dialog */}
          {showConfirmStop && isFasting && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                    هل تريد إنهاء جلسة الصيام وتسجيلها؟
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1">
                    أكملت حتى الآن <span className="font-black font-mono">{(elapsedSeconds / 3600).toFixed(1)}</span> ساعة من هدفك ({targetHours} ساعة).
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmStop(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  إلغاء ومتابعة الصيام
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStop}
                  className="px-4 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                >
                  تأكيد الإنهاء والتوثيق
                </button>
              </div>
            </div>
          )}

          {/* Active Fasting Live Progress Ring / Digits */}
          {isFasting && !showConfirmStop && (
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="font-mono text-3xl sm:text-4xl font-black text-peacock-indigo dark:text-peacock-teal">
                    {String(hours).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">ساعة</span>
                </div>
                <span className="text-2xl font-bold text-slate-400">:</span>
                <div className="flex flex-col items-center">
                  <span className="font-mono text-3xl sm:text-4xl font-black text-peacock-indigo dark:text-peacock-teal">
                    {String(minutes).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">دقيقة</span>
                </div>
                <span className="text-2xl font-bold text-slate-400">:</span>
                <div className="flex flex-col items-center">
                  <span className="font-mono text-3xl sm:text-4xl font-black text-peacock-indigo dark:text-peacock-teal">
                    {String(seconds).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">ثانية</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs space-y-1">
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      isGoalReached ? 'bg-peacock-blue' : 'bg-peacock-indigo'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>التقدم: {progressPercent}%</span>
                  <span>الهدف: {targetHours} ساعة</span>
                </div>
              </div>

              {/* End Fasting Button */}
              <button
                type="button"
                onClick={() => setShowConfirmStop(true)}
                className="mt-2 px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Square className="w-3.5 h-3.5" />
                <span>إنهاء الصيام وتناول الطعام</span>
              </button>
            </div>
          )}

          {/* Not Fasting: Start Buttons */}
          {!isFasting && (
            <div className="space-y-3">
              {completedHours && (
                <div className="p-3 rounded-xl bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-peacock-indigo-deep dark:text-peacock-sage font-bold">
                    <Award className="w-4 h-4 text-peacock-indigo" />
                    <span>سجلت اليوم: {completedHours} ساعة صيام مكتملة!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFast}
                    className="text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    إعادة ضبط
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartFasting(0)}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo text-white text-xs font-black transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>بدء عداد الصيام الآن</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAdjustStart(!showAdjustStart)}
                  className="px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>بدأت مسبقاً</span>
                </button>
              </div>

              {/* Adjust start hours dropdown */}
              {showAdjustStart && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                    متى بدأت صيامك الفعلي؟
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 4, 8].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleStartFasting(h)}
                        className="py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-peacock-mist border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        منذ {h} ساعات
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Islamic Rehydration Plan */}
      {showRehydrationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--app-card)] border border-[var(--app-border)] rounded-3xl p-5 max-w-lg w-full space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--app-border)]/50 pb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-sky-500" />
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  خطة توزيع شرب الماء بين المغرب والفجر
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRehydrationModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1 cursor-pointer"
              >
                ✕ إغلاق
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              لتفادي الجفاف والصداع نهاراً، تجنب شرب لترات الماء دفعة واحدة قبل الفجر. اتبع هذا الجدول الزمني الموصى به:
            </p>

            <div className="space-y-2">
              {(fastingStatus.rehydrationCups || []).map((item, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                      {item.time}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {item.label}
                    </span>
                  </div>
                  <span className="font-black text-sky-600 dark:text-sky-400">
                    {item.amountMl} مل
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
              💡 نصيحة إكلينيكية: إضافة رشة ملح بحري خفيفة أو شريحة ليمون للماء بعد الإفطار تعوض الإلكترولايت المفقودة وتزيد من امتصاص الخلايا للماء.
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Islamic Suhur Smart Guide */}
      {showSuhurGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--app-card)] border border-[var(--app-border)] rounded-3xl p-5 max-w-lg w-full space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--app-border)]/50 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  دليل السحور الذكي (منع العطش والجوع)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSuhurGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1 cursor-pointer"
              >
                ✕ إغلاق
              </button>
            </div>

            <div className="space-y-3">
              {SUHUR_SMART_TIPS.map((tip, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                    {tip.title}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tip.items.map((it, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-peacock-mist dark:bg-peacock-ink-deep/60 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep">
                        {it}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {tip.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Christian Plant Protein Combiner Guide */}
      {showProteinCombinerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--app-card)] border border-[var(--app-border)] rounded-3xl p-5 max-w-lg w-full space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--app-border)]/50 pb-3">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-peacock-indigo dark:text-peacock-teal" />
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  مرشد دمج البروتين النباتي (Plant Protein Combiner)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProteinCombinerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1 cursor-pointer"
              >
                ✕ إغلاق
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              أثناء الصيام النباتي، معظم البروتينات النباتية تفتقر لواحد أو أكثر من الأحماض الأمينية الأساسية. عبر دمج هذه المجموعات، تحصل على بروتين كامل يعادل اللحوم:
            </p>

            <div className="space-y-3">
              {PLANT_PROTEIN_COMBOS.map((combo, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-peacock-indigo-deep dark:text-peacock-sage">
                      ⚡ {combo.title}
                    </h4>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    أمثلة: {combo.examples}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    💡 {combo.benefit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
