import React from 'react';
import {
 Heart,
 Calendar,
 Circle,
 Check,
 Plus,
 Trash2,
 Lock,
 Eye,
 Activity
} from 'lucide-react';
import { PlanConfig, CycleTrackingConfig, ClinicalCycleFlag } from '../types';
import { CLINICAL_FLAGS_META, CYCLE_DISCLAIMER } from '../utils/cycleTracking';

interface CycleTrackingManagerProps {
 draft: PlanConfig;
 onUpdateDraft: (updater: (prev: PlanConfig) => PlanConfig) => void;
 onNotify?: (msg: string) => void;
}

export const CycleTrackingManager: React.FC<CycleTrackingManagerProps> = ({
 draft,
 onUpdateDraft,
 onNotify,
}) => {
 const cycleConfig: CycleTrackingConfig = draft.cycleTracking || {
 enabled: false,
 showPhaseToClient: true,
 regularity: 'regular',
 typicalCycleLength: 28,
 typicalPeriodLength: 5,
 clinicalFlags: [],
 cycleStarts: [],
 };

 const updateCycleConfig = (updater: (prev: CycleTrackingConfig) => CycleTrackingConfig) => {
 onUpdateDraft((prev) => {
 const current = prev.cycleTracking || {
 enabled: false,
 showPhaseToClient: true,
 regularity: 'regular',
 typicalCycleLength: 28,
 typicalPeriodLength: 5,
 clinicalFlags: [],
 cycleStarts: [],
 };
 const nextConfig = updater(current);
 return {
...prev,
 cycleTracking: {
...nextConfig,
 lastUpdatedAt: new Date().toISOString(),
 lastUpdatedBy: 'coach',
 },
 };
 });
 };

 const handleToggleClinicalFlag = (flag: ClinicalCycleFlag) => {
 updateCycleConfig((prev) => {
 const exists = prev.clinicalFlags.includes(flag);
 const nextFlags = exists
? prev.clinicalFlags.filter((f) => f!== flag)
: [...prev.clinicalFlags, flag];
 return {
...prev,
 clinicalFlags: nextFlags,
 };
 });
 };

 const handleAddCycleStartDate = (dateStr: string) => {
 if (!dateStr) return;
 updateCycleConfig((prev) => {
 const starts = prev.cycleStarts? [...prev.cycleStarts]: [];
 if (!starts.includes(dateStr)) {
 starts.push(dateStr);
 starts.sort();
 }
 return {
...prev,
 cycleStarts: starts,
 lastPeriodStart: dateStr,
 };
 });
 onNotify?.('تم تسجيل تاريخ بداية دورة جديدة');
 };

 const handleRemoveCycleStartDate = (dateStr: string) => {
 updateCycleConfig((prev) => {
 const starts = (prev.cycleStarts || []).filter((d) => d!== dateStr);
 const newLastStart = starts.length > 0? starts[starts.length - 1]: undefined;
 return {
...prev,
 cycleStarts: starts,
 lastPeriodStart: newLastStart,
 };
 });
 };

 return (
 <div className="space-y-4">
 {/* Header Banner */}
 <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 flex items-start justify-between gap-4">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shrink-0">
 
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
 تتبع الدورة الشهرية والسياق الهرموني
 </h3>
 <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
 إكلينيكي وغذائي
 </span>
 </div>
 <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
 ربط أطوار الدورة الشهرية بالأعراض، احتباس السوائل، الشهية، وتذبذبات الوزن لضبط خطط التغذية المناسبة.
 </p>
 </div>
 </div>

 {/* Master Enable Toggle */}
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
 {cycleConfig.enabled? 'مفعّل للمتدربة': 'معطّل'}
 </span>
 <button
 type="button"
 onClick={() => updateCycleConfig((prev) => ({...prev, enabled:!prev.enabled }))}
 className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
 cycleConfig.enabled? 'bg-rose-600': 'bg-slate-300 dark:bg-slate-700'
 }`}
 >
 <div
 className={`bg-white w-4 h-4 rounded-full transform transition-transform ${
 cycleConfig.enabled? 'translate-x-0': '-translate-x-6'
 }`}
 />
 </button>
 </div>
 </div>

 {!cycleConfig.enabled? (
 <div className="p-5 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
 <Heart className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
 <div className="space-y-1 max-w-md mx-auto">
 <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
 تتبع الدورة معطّل حالياً لهذه العميلة
 </h4>
 <p className="text-xs text-slate-500 dark:text-slate-400">
 هذه الميزة اختيارية وموجهة للمتدربات. فعّلي المفتاح بالأعلى للبدء في تحديد أطوار الدورة، الملاحظات السريرية، وإظهار بطاقة المتابعة للعميلة.
 </p>
 </div>
 <button
 type="button"
 onClick={() => updateCycleConfig((prev) => ({...prev, enabled: true }))}
 className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all"
 >
 تفعيل تتبع الدورة الآن 
 </button>
 </div>
 ): (
 <div className="space-y-4">
 {/* Section 1: Cycle Parameters */}
 <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
 <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
 <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <Calendar className="w-4 h-4 text-rose-500" />
 <span>إعدادات الدورة الأساسية</span>
 </h4>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
 <div>
 <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
 تاريخ بداية آخر حيض:
 </label>
 <input
 type="date"
 value={cycleConfig.lastPeriodStart || ''}
 onChange={(e) => {
 const val = e.target.value;
 updateCycleConfig((prev) => {
 const starts = prev.cycleStarts? [...prev.cycleStarts]: [];
 if (val &&!starts.includes(val)) {
 starts.push(val);
 starts.sort();
 }
 return {
...prev,
 lastPeriodStart: val,
 cycleStarts: starts,
 };
 });
 }}
 className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-400"
 />
 </div>

 <div>
 <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
 طول الدورة المعتاد (أيام):
 </label>
 <input
 type="number"
 min={21}
 max={45}
 value={cycleConfig.typicalCycleLength || 28}
 onChange={(e) =>
 updateCycleConfig((prev) => ({
...prev,
 typicalCycleLength: parseInt(e.target.value) || 28,
 }))
 }
 className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-400"
 />
 <span className="text-[12px] text-slate-400">افتراضي 28 (نطاق 21-45)</span>
 </div>

 <div>
 <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
 أيام الحيض المعتادة:
 </label>
 <input
 type="number"
 min={2}
 max={10}
 value={cycleConfig.typicalPeriodLength || 5}
 onChange={(e) =>
 updateCycleConfig((prev) => ({
...prev,
 typicalPeriodLength: parseInt(e.target.value) || 5,
 }))
 }
 className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-400"
 />
 <span className="text-[12px] text-slate-400">افتراضي 5 (نطاق 2-10)</span>
 </div>
 </div>

 {/* Regularity Selector */}
 <div>
 <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-xs">
 انتظام الدورة:
 </label>
 <div className="grid grid-cols-3 gap-2 text-xs">
 {(
 [
 { id: 'regular', label: 'منتظمة', desc: 'حساب أطوار قياسي' },
 { id: 'irregular', label: 'غير منتظمة', desc: 'تنبيه تأخير تقريبي' },
 { id: 'unknown', label: 'غير محددة', desc: 'تحت المتابعة' },
 ] as const
 ).map((opt) => (
 <button
 key={opt.id}
 type="button"
 onClick={() => updateCycleConfig((prev) => ({...prev, regularity: opt.id }))}
 className={`p-2.5 rounded-xl border text-right transition-all ${
 cycleConfig.regularity === opt.id
? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200 font-bold'
: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
 }`}
 >
 <div className="flex items-center justify-between">
 <span>{opt.label}</span>
 {cycleConfig.regularity === opt.id && <Check className="w-3.5 h-3.5 text-rose-600" />}
 </div>
 <p className="text-[12px] opacity-75 mt-0.5">{opt.desc}</p>
 </button>
 ))}
 </div>
 </div>

 {/* Client Visibility Toggle */}
 <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Eye className="w-4 h-4 text-peacock-blue" />
 <div>
 <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
 إظهار شارة الطور وإرشاداته للعميلة في تبويب اليوم
 </span>
 <p className="text-[12px] text-slate-500 dark:text-slate-400">
 يمكن للعميلة رؤية طورها التقريبي والنصائح الغذائية المرتبطة به
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={() =>
 updateCycleConfig((prev) => ({
...prev,
 showPhaseToClient: prev.showPhaseToClient === false? true: false,
 }))
 }
 className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
 cycleConfig.showPhaseToClient!== false? 'bg-peacock-indigo': 'bg-slate-300 dark:bg-slate-700'
 }`}
 >
 <div
 className={`bg-white w-4 h-4 rounded-full transform transition-transform ${
 cycleConfig.showPhaseToClient!== false? 'translate-x-0': '-translate-x-5'
 }`}
 />
 </button>
 </div>
 </div>

 {/* Section 2: Clinical Flags */}
 <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
 <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
 <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <Activity className="w-4 h-4 text-peacock-blue" />
 <span>العلامات والسياقات السريرية (Clinical Flags)</span>
 </h4>
 <span className="text-[12px] text-slate-400">سياق مسجل وليس تشخيصاً تلقائياً</span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 {(['pcos', 'endometriosis', 'fluid_retention', 'other'] as ClinicalCycleFlag[]).map((flag) => {
 const meta = CLINICAL_FLAGS_META[flag];
 const isSelected = cycleConfig.clinicalFlags.includes(flag);
 return (
 <button
 key={flag}
 type="button"
 onClick={() => handleToggleClinicalFlag(flag)}
 className={`p-3 rounded-xl border text-right transition-all flex items-start justify-between gap-2 ${
 isSelected
? `${meta.badgeColor} font-bold`
: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
 }`}
 >
 <div className="space-y-0.5">
 <div className="text-xs font-bold">{meta.label}</div>
 <div className="text-[12px] opacity-80 leading-relaxed">{meta.note}</div>
 </div>
 <div
 className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
 isSelected? 'bg-current text-white border-transparent': 'border-slate-300 dark:border-slate-600'
 }`}
 >
 {isSelected && <Check className="w-3 h-3 text-white dark:text-slate-900" />}
 </div>
 </button>
 );
 })}
 </div>
 </div>

 {/* Section 3: Coach Clinical Notes */}
 <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
 <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <Circle className="w-4 h-4 text-amber-500" />
 <span>ملاحظات وتوجيهات الأخصائية الخاصة بالدورة</span>
 </h4>
 <textarea
 rows={3}
 value={cycleConfig.coachNotes || ''}
 onChange={(e) => updateCycleConfig((prev) => ({...prev, coachNotes: e.target.value }))}
 placeholder="مثال: زيادة السوائل في الأسبوع الرابع، رفع المغنيسيوم قبل الحيض بـ 5 أيام، توقع ثبات أو زيادة طفيفة بالوزن..."
 className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-400 placeholder:text-slate-400"
 />
 </div>

 {/* Section 4: History of Period Starts */}
 <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
 <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
 <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <Calendar className="w-4 h-4 text-blue-500" />
 <span>سجل بدايات الحيض المسجلة ({cycleConfig.cycleStarts?.length || 0})</span>
 </h4>
 </div>

 <div className="flex flex-wrap gap-2 items-center">
 {(cycleConfig.cycleStarts || []).map((dateStr) => (
 <div
 key={dateStr}
 className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2"
 >
 <span className="font-bold">{dateStr}</span>
 {dateStr === cycleConfig.lastPeriodStart && (
 <span className="text-[12px] bg-rose-200 dark:bg-rose-800 px-1 rounded text-rose-900 dark:text-rose-100">
 الحالية
 </span>
 )}
 <button
 type="button"
 onClick={() => handleRemoveCycleStartDate(dateStr)}
 className="text-rose-400 hover:text-rose-700 dark:hover:text-rose-200"
 title="حذف التاريخ"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 ))}

 <div className="flex items-center gap-1 text-xs">
 <input
 type="date"
 id="newCycleDateInput"
 className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs"
 />
 <button
 type="button"
 onClick={() => {
 const el = document.getElementById('newCycleDateInput') as HTMLInputElement;
 if (el && el.value) {
 handleAddCycleStartDate(el.value);
 el.value = '';
 }
 }}
 className="p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
 title="إضافة تاريخ بداية"
 >
 <Plus className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 </div>

 {/* Clinical Disclaimer */}
 <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-start gap-2 text-slate-500 dark:text-slate-400 text-[12px]">
 <Lock className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
 <p className="leading-relaxed">
 <strong>تنويه أمان وخصوصية: </strong>
 {CYCLE_DISCLAIMER} بيانات الدورة تظهر فقط في تقارير المتابعة الخاصة بالأخصائية ولا تُنشر في بطاقة المشاركة العامة (Story Card).
 </p>
 </div>
 </div>
 )}
 </div>
 );
};
