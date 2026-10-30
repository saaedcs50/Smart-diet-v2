import React, { useState } from 'react';
import {
 Circle,
 ChevronDown,
 ChevronUp,
 Calendar,
 Zap,
 Check,
 Info,
 Droplets,
 Settings,
 Heart
} from 'lucide-react';
import { DayLog, PlanConfig } from '../types';
import {
 getCycleInfo,
 CYCLE_SYMPTOMS,
 CYCLE_DISCLAIMER,
 CLINICAL_FLAGS_META
} from '../utils/cycleTracking';

interface CycleTrackerCardProps {
 plan: PlanConfig;
 day: DayLog;
 currentDate: string;
 onUpdateDay: (updater: (prev: DayLog) => DayLog) => void;
 onUpdatePlan: (updater: (prev: PlanConfig) => PlanConfig) => void;
 onNotify?: (msg: string) => void;
}

export const CycleTrackerCard: React.FC<CycleTrackerCardProps> = ({
 plan,
 day,
 currentDate,
 onUpdateDay,
 onUpdatePlan,
 onNotify,
}) => {
 const [isExpanded, setIsExpanded] = useState<boolean>(true);
 const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

 // Settings form state
 const cycleConfig = plan.cycleTracking;
 const [tempStartDate, setTempStartDate] = useState<string>(cycleConfig?.lastPeriodStart || currentDate);
 const [tempCycleLength, setTempCycleLength] = useState<number>(cycleConfig?.typicalCycleLength || 28);
 const [tempPeriodLength, setTempPeriodLength] = useState<number>(cycleConfig?.typicalPeriodLength || 5);
 const [tempRegularity, setTempRegularity] = useState<'regular' | 'irregular' | 'unknown'>(cycleConfig?.regularity || 'regular');

 if (!cycleConfig ||!cycleConfig.enabled) {
 return null;
 }

 const cycleInfo = getCycleInfo(cycleConfig, currentDate);
 const cycleLog = day.cycleDay || { symptoms: [] };
 const selectedSymptoms = cycleLog.symptoms || [];

 // Toggle a symptom
 const handleToggleSymptom = (symptomId: string) => {
 onUpdateDay((prev) => {
 const current = prev.cycleDay || { symptoms: [] };
 const exists = (current.symptoms || []).includes(symptomId);
 const newSymptoms = exists
? (current.symptoms || []).filter((id) => id!== symptomId)
: [...(current.symptoms || []), symptomId];

 return {
...prev,
 cycleDay: {
...current,
 symptoms: newSymptoms,
...(symptomId === 'spotting'? { spotting:!exists }: {}),
 },
 };
 });
 };

 // Set energy
 const handleSetEnergy = (level: number) => {
 onUpdateDay((prev) => {
 const current = prev.cycleDay || { symptoms: [] };
 const newEnergy = current.energy === level? null: level;
 return {
...prev,
 cycleDay: {
...current,
 energy: newEnergy,
 },
 };
 });
 };

 // Set note
 const handleSetNote = (noteText: string) => {
 onUpdateDay((prev) => {
 const current = prev.cycleDay || { symptoms: [] };
 return {
...prev,
 cycleDay: {
...current,
 note: noteText,
 },
 };
 });
 };

 // Quick button: "بدأ الحيض اليوم"
 const handlePeriodStartedToday = () => {
 // 1. Update Day Log
 onUpdateDay((prev) => {
 const current = prev.cycleDay || { symptoms: [] };
 return {
...prev,
 cycleDay: {
...current,
 periodStartedToday: true,
 },
 };
 });

 // 2. Update Plan Cycle Tracking
 onUpdatePlan((prev) => {
 const prevConfig = prev.cycleTracking || {
 enabled: true,
 showPhaseToClient: true,
 regularity: 'regular',
 typicalCycleLength: 28,
 typicalPeriodLength: 5,
 clinicalFlags: [],
 };

 const starts = prevConfig.cycleStarts? [...prevConfig.cycleStarts]: [];
 if (!starts.includes(currentDate)) {
 starts.push(currentDate);
 starts.sort();
 }

 return {
...prev,
 cycleTracking: {
...prevConfig,
 lastPeriodStart: currentDate,
 cycleStarts: starts,
 lastUpdatedAt: new Date().toISOString(),
 lastUpdatedBy: 'client',
 },
 };
 });

 onNotify?.('تم تسجيل بداية الحيض اليوم بنجاح وإعادة ضبط أيام الدورة ');
 };

 // Save Settings Modal
 const handleSaveSettings = () => {
 onUpdatePlan((prev) => {
 const prevConfig = prev.cycleTracking || {
 enabled: true,
 showPhaseToClient: true,
 regularity: 'regular',
 typicalCycleLength: 28,
 typicalPeriodLength: 5,
 clinicalFlags: [],
 };

 const starts = prevConfig.cycleStarts? [...prevConfig.cycleStarts]: [];
 if (tempStartDate &&!starts.includes(tempStartDate)) {
 starts.push(tempStartDate);
 starts.sort();
 }

 return {
...prev,
 cycleTracking: {
...prevConfig,
 lastPeriodStart: tempStartDate,
 typicalCycleLength: tempCycleLength,
 typicalPeriodLength: tempPeriodLength,
 regularity: tempRegularity,
 cycleStarts: starts,
 lastUpdatedAt: new Date().toISOString(),
 lastUpdatedBy: 'client',
 },
 };
 });

 setShowSettingsModal(false);
 onNotify?.('تم تحديث إعدادات الدورة الشهرية بنجاح ');
 };

 const energyLabels: Record<number, { label: string; icon: string; color: string }> = {
 1: { label: 'منخفضة جداً', icon: '', color: 'text-rose-500' },
 2: { label: 'هادئة / مجهدة', icon: '', color: 'text-amber-500' },
 3: { label: 'معتدلة', icon: '', color: 'text-yellow-500' },
 4: { label: 'نشيطة', icon: '', color: 'text-peacock-blue' },
 5: { label: 'طاقة عالية', icon: '', color: 'text-peacock-blue' },
 };

 return (
 <div className="bg-[var(--app-card)] rounded-3xl border border-[var(--app-border)]/80 overflow-hidden transition-all">
 {/* Header */}
 <div className="p-4 bg-[var(--app-card-muted)] border-b border-[var(--app-border)]/60 flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--app-hero)] dark:text-[var(--app-hero-hover)] font-bold">
 
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-bold text-[var(--app-text-primary)] text-sm">
 دورة اليوم والأعراض
 </h3>
 {cycleConfig.showPhaseToClient!== false && cycleInfo.dayOfCycle!== null && (
 <span
 className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${cycleInfo.colorClass.badge}`}
 >
 {cycleInfo.phaseBadge}
 </span>
 )}
 </div>
 <p className="text-[12px] text-[var(--app-text-secondary)]">
 متابعة الطور الهرموني، الأعراض، ومستوى الطاقة
 </p>
 </div>
 </div>

 <div className="flex items-center gap-1.5">
 <button
 type="button"
 onClick={() => setShowSettingsModal(true)}
 className="p-1.5 rounded-lg text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] dark:hover:text-[var(--app-text-primary)] hover:bg-[var(--app-card-muted)] transition-colors text-xs flex items-center gap-1 cursor-pointer"
 title="تعديل تواريخ وإعدادات الدورة"
 >
 <Settings className="w-3.5 h-3.5" />
 <span className="hidden sm:inline text-[12px] font-medium">الإعدادات</span>
 </button>
 <button
 type="button"
 onClick={() => setIsExpanded(!isExpanded)}
 className="p-1.5 rounded-lg text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] dark:hover:text-[var(--app-text-primary)] hover:bg-[var(--app-card-muted)] transition-colors cursor-pointer"
 >
 {isExpanded? <ChevronUp className="w-4 h-4" />: <ChevronDown className="w-4 h-4" />}
 </button>
 </div>
 </div>

 {/* Body */}
 {isExpanded && (
 <div className="p-4 space-y-4">
 {/* Phase Banner & Quick Info */}
 <div className={`p-3 rounded-2xl border ${cycleInfo.colorClass.border} ${cycleInfo.colorClass.bg}`}>
 <div className="flex items-start justify-between gap-3">
 <div className="space-y-1">
 <div className="flex items-center gap-1.5 font-bold text-xs">
 <span className="text-sm">{cycleInfo.icon}</span>
 <span className={cycleInfo.colorClass.text}>{cycleInfo.phaseName}</span>
 {cycleInfo.dayOfCycle && (
 <span className="text-[12px] text-[var(--app-text-secondary)] font-normal">
 (اليوم {cycleInfo.dayOfCycle} من الدورة)
 </span>
 )}
 </div>
 <p className="text-xs text-[var(--app-text-primary)] leading-relaxed">
 {cycleInfo.description}
 </p>
 <div className="pt-1 flex items-start gap-1.5 text-[12px] text-[var(--app-text-primary)] font-medium">
 <Circle className="w-3.5 h-3.5 text-[#E0922D] shrink-0 mt-0.5" />
 <span>
 <strong className="text-[var(--app-text-primary)]">إرشاد غذائي: </strong>
 {cycleInfo.nutritionTip}
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* Quick Period Start Action */}
 <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--app-hero)]/5 dark:bg-[var(--app-hero)]/15 border border-dashed border-[var(--app-hero)]/30 dark:border-[var(--app-hero)]/30">
 <div className="flex items-center gap-2">
 <Droplets className="w-4 h-4 text-[var(--app-hero)] shrink-0" />
 <div className="text-xs">
 <span className="font-bold text-[var(--app-text-primary)]">
 {cycleLog.periodStartedToday? ' تم تسجيل بداية الحيض اليوم': 'هل بدأ الحيض اليوم؟'}
 </span>
 <p className="text-[12px] text-[var(--app-text-secondary)]">
 {cycleConfig.lastPeriodStart
? `آخر بداية مسجلة: ${cycleConfig.lastPeriodStart}`
: 'سجّلي أول يوم لإعادة احتساب الطور بدقة'}
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={handlePeriodStartedToday}
 disabled={cycleLog.periodStartedToday}
 className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
 cycleLog.periodStartedToday
? 'bg-[var(--app-hero)]/15 text-[var(--app-hero)] dark:text-[var(--app-hero-hover)] cursor-default'
: 'bg-[var(--app-hero)] hover:bg-[#C2135B] text-white'
 }`}
 >
 <span></span>
 <span>{cycleLog.periodStartedToday? 'بدأ اليوم (مسجل)': 'بدأ الحيض اليوم'}</span>
 </button>
 </div>

 {/* Energy Scale (1 to 5) */}
 <div className="space-y-1.5">
 <div className="flex items-center justify-between">
 <label className="text-xs font-bold text-[var(--app-text-primary)] flex items-center gap-1.5">
 <Zap className="w-3.5 h-3.5 text-[#E0922D]" />
 <span>مستوى الطاقة والنشاط اليوم:</span>
 </label>
 {cycleLog.energy && (
 <span className="text-[12px] font-bold text-[var(--app-text-secondary)]">
 {energyLabels[cycleLog.energy]?.label} ({cycleLog.energy}/5)
 </span>
 )}
 </div>
 <div className="grid grid-cols-5 gap-1.5">
 {[1, 2, 3, 4, 5].map((lvl) => {
 const isSelected = cycleLog.energy === lvl;
 return (
 <button
 key={lvl}
 type="button"
 onClick={() => handleSetEnergy(lvl)}
 className={`py-2 px-1 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
 isSelected
? 'bg-[#E0922D] text-white border-[#E0922D] scale-102'
: 'bg-[var(--app-card-muted)] text-[var(--app-text-primary)] border-[var(--app-border)]/60 hover:bg-[var(--app-card-muted)]'
 }`}
 >
 <span className="text-xs">{energyLabels[lvl]?.icon}</span>
 <span className="text-[12px]">{lvl}</span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Symptoms Chips */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-[var(--app-text-primary)] flex items-center gap-1.5">
 <Heart className="w-3.5 h-3.5 text-[var(--app-hero)]" />
 <span>أعراض الدورة والتقلبات اليومية (اختياري):</span>
 </label>
 <div className="flex flex-wrap gap-1.5">
 {CYCLE_SYMPTOMS.map((sym) => {
 const isChecked = selectedSymptoms.includes(sym.id);
 return (
 <button
 key={sym.id}
 type="button"
 onClick={() => handleToggleSymptom(sym.id)}
 className={`px-2.5 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
 isChecked
? 'bg-[var(--app-hero)] text-white border-[var(--app-hero)]'
: 'bg-[var(--app-card-muted)] text-[var(--app-text-primary)] border-[var(--app-border)]/60 hover:border-[var(--app-hero)]/40'
 }`}
 >
 <span>{sym.icon}</span>
 <span>{sym.label}</span>
 {isChecked && <Check className="w-3 h-3 ml-0.5" />}
 </button>
 );
 })}
 </div>
 </div>

 {/* Note Field */}
 <div className="space-y-1">
 <input
 type="text"
 value={cycleLog.note || ''}
 onChange={(e) => handleSetNote(e.target.value)}
 placeholder="ملاحظة قصيرة عن اليوم (مثال: انتفاخ شديد بالمساء، نوم متقطع...)"
 className="w-full text-xs px-3 py-2 rounded-2xl bg-[var(--app-card-muted)] border border-[var(--app-border)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--app-hero)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)]/60"
 />
 </div>

 {/* Clinical Flags Note (If set by coach) */}
 {cycleConfig.clinicalFlags && cycleConfig.clinicalFlags.length > 0 && (
 <div className="p-2.5 rounded-2xl bg-[#4D52B4]/10 dark:bg-[#4D52B4]/20 border border-[#4D52B4]/30 text-[12px] text-[#4D52B4] dark:text-[#70D6C5] space-y-1">
 <span className="font-bold flex items-center gap-1">
 <Info className="w-3.5 h-3.5" />
 <span>سياق سريري معتمد من الأخصائية:</span>
 </span>
 <div className="flex flex-wrap gap-1.5">
 {cycleConfig.clinicalFlags.map((flag) => {
 const meta = CLINICAL_FLAGS_META[flag];
 return (
 <span
 key={flag}
 className="px-2 py-0.5 rounded-lg bg-[#4D52B4]/15 dark:bg-[#4D52B4]/30 text-[#4D52B4] dark:text-[#70D6C5] text-[12px] font-bold"
 >
 {meta?.label || flag}
 </span>
 );
 })}
 </div>
 </div>
 )}

 {/* Fixed Disclaimer */}
 <p className="text-[12px] text-[var(--app-text-secondary)] leading-relaxed text-center">
 {CYCLE_DISCLAIMER}
 </p>
 </div>
 )}

 {/* Client Settings Modal */}
 {showSettingsModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
 <div className="bg-[var(--app-card)] rounded-3xl border border-[var(--app-border)] app-overlay-shadow max-w-sm w-full p-5 space-y-4 animate-in fade-in">
 <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]/50">
 <h4 className="font-bold text-sm text-[var(--app-text-primary)] flex items-center gap-2">
 <span></span>
 <span>إعدادات تتبع الدورة</span>
 </h4>
 <button
 type="button"
 onClick={() => setShowSettingsModal(false)}
 className="text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] dark:hover:text-[var(--app-text-primary)] text-xs cursor-pointer"
 >
 
 </button>
 </div>

 <div className="space-y-3 text-xs">
 <div>
 <label className="block font-bold text-[var(--app-text-primary)] mb-1">
 تاريخ بداية آخر حيض:
 </label>
 <div className="relative">
 <input
 type="date"
 value={tempStartDate}
 onChange={(e) => setTempStartDate(e.target.value)}
 className="w-full px-3 py-2 rounded-xl bg-[var(--app-card-muted)] border border-[var(--app-border)] text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-hero)]"
 />
 <Calendar className="w-4 h-4 text-[var(--app-text-secondary)] absolute left-3 top-2.5 pointer-events-none" />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block font-bold text-[var(--app-text-primary)] mb-1">
 طول الدورة المعتاد (يوم):
 </label>
 <input
 type="number"
 min={21}
 max={45}
 value={tempCycleLength}
 onChange={(e) => setTempCycleLength(parseInt(e.target.value) || 28)}
 className="w-full px-3 py-2 rounded-xl bg-[var(--app-card-muted)] border border-[var(--app-border)] text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-hero)]"
 />
 <span className="text-[12px] text-[var(--app-text-secondary)]">افتراضي 28 (21-45)</span>
 </div>
 <div>
 <label className="block font-bold text-[var(--app-text-primary)] mb-1">
 أيام الحيض المعتادة:
 </label>
 <input
 type="number"
 min={2}
 max={10}
 value={tempPeriodLength}
 onChange={(e) => setTempPeriodLength(parseInt(e.target.value) || 5)}
 className="w-full px-3 py-2 rounded-xl bg-[var(--app-card-muted)] border border-[var(--app-border)] text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-hero)]"
 />
 <span className="text-[12px] text-[var(--app-text-secondary)]">افتراضي 5 (2-10)</span>
 </div>
 </div>

 <div>
 <label className="block font-bold text-[var(--app-text-primary)] mb-1">
 انتظام الدورة:
 </label>
 <div className="grid grid-cols-3 gap-1.5">
 {(
 [
 { id: 'regular', label: 'منتظمة' },
 { id: 'irregular', label: 'غير منتظمة' },
 { id: 'unknown', label: 'غير معروف' },
 ] as const
 ).map((opt) => (
 <button
 key={opt.id}
 type="button"
 onClick={() => setTempRegularity(opt.id)}
 className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
 tempRegularity === opt.id
? 'bg-[var(--app-hero)] text-white border-[var(--app-hero)]'
: 'bg-[var(--app-card-muted)] text-[var(--app-text-primary)] border-[var(--app-border)]'
 }`}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </div>
 </div>

 <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border)]/50">
 <button
 type="button"
 onClick={() => setShowSettingsModal(false)}
 className="px-3 py-1.5 rounded-xl text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-card-muted)] cursor-pointer"
 >
 إلغاء
 </button>
 <button
 type="button"
 onClick={handleSaveSettings}
 className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[var(--app-hero)] hover:bg-[#C2135B] text-white cursor-pointer"
 >
 حفظ الإعدادات
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
