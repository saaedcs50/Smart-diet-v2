import React, { useState, useEffect } from 'react';
import { 
 Scale, 
 Ruler, 
 Camera, 
 Columns, 
 Plus, 
 Trash2, 
 ShieldCheck, 
 TrendingDown, 
 TrendingUp, 
 Circle,
 Info,
 Trophy,
 Stethoscope,
 Tag,
 AlertTriangle,
 HeartPulse,
 CheckCircle2,
 Pill
} from 'lucide-react';
import { PlanConfig, DayLog, PhotoRecord } from '../types';
import { calculateBMI, calculateWHtR, findLatestWeight } from '../utils/calculations';
import { savePhotoToDB, getPhotosForDate, deletePhotoFromDB, processAndCompressImage, compressImageWithStats } from '../utils/indexedDB';
import { getCycleInfo, getWeightVsRecentAverage, WEIGHT_FLUCTUATION_NOTE } from '../utils/cycleTracking';
import { isSectionVisible } from '../utils/storage';
import { LabTrackerSection } from './LabTrackerSection';
import { WeightTrajectoryCard } from './WeightTrajectoryCard';
import { MilestonesSection } from './MilestonesSection';
import { HelpButton } from './FeatureHelpModal';
import { brandCopy } from '../config/brand';

interface BodyTabProps {
 plan: PlanConfig;
 day: DayLog;
 currentDate: string;
 onUpdateDay: (updated: DayLog) => void;
 onUpdatePlan?: (updater: (prev: PlanConfig) => PlanConfig) => void;
 onOpenComparePhotos: () => void;
 onNotify: (msg: string) => void;
}

export const BodyTab: React.FC<BodyTabProps> = ({
 plan,
 day,
 currentDate,
 onUpdateDay,
 onUpdatePlan,
 onOpenComparePhotos,
 onNotify,
}) => {
 const [dayPhotos, setDayPhotos] = useState<PhotoRecord[]>([]);
 const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

 // Load photos for this date
 useEffect(() => {
 loadPhotos();
 }, [currentDate]);

 const loadPhotos = async () => {
 try {
 const list = await getPhotosForDate(currentDate);
 setDayPhotos(list);
 } catch (e) {
 console.error(e);
 }
 };

 const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setIsUploadingPhoto(true);
 try {
 const result = await compressImageWithStats(file);
 await savePhotoToDB({
 date: currentDate,
 data: result.dataUrl,
 ts: Date.now(),
 });
 await loadPhotos();
 const savingsMsg = result.savedPercent > 0
 ? `تم ضغط الصورة وتوفير ${result.savedPercent}% من المساحة (${result.originalSizeKb}KB ← ${result.compressedSizeKb}KB) وحفظها بأمان داخل جهازك`
 : 'تم حفظ الصورة بأمان داخل جهازك فقط';
 onNotify(savingsMsg);
 } catch (err) {
 alert('حدث خطأ أثناء معالجة الصورة');
 } finally {
 setIsUploadingPhoto(false);
 e.target.value = '';
 }
 };

 const handleDeletePhoto = async (id?: number) => {
 if (!id) return;
 if (window.confirm('هل تريد حذف هذه الصورة؟')) {
 await deletePhotoFromDB(id);
 await loadPhotos();
 onNotify('تم حذف الصورة');
 }
 };

 const currentWeight = day.weight || null;
 const startWeight = plan.startWeight || null;
 const targetWeight = plan.targetWeight || null;
 const heightCm = plan.heightCm || null;

 const bmi = calculateBMI(currentWeight, heightCm);
 const whtr = calculateWHtR(day.meas?.waist || null, heightCm);

 // Total weight lost from starting weight
 let totalLostKg: number | null = null;
 if (startWeight && currentWeight) {
 totalLostKg = parseFloat((startWeight - currentWeight).toFixed(1));
 }

 // Weight remaining to target
 let remainingKg: number | null = null;
 if (targetWeight && currentWeight) {
 remainingKg = parseFloat((currentWeight - targetWeight).toFixed(1));
 }

 // Target Progress Percentage
 let targetProgressPercent = 0;
 if (startWeight && targetWeight && currentWeight && startWeight > targetWeight) {
 const totalToLose = startWeight - targetWeight;
 const lostSoFar = startWeight - currentWeight;
 targetProgressPercent = Math.min(100, Math.max(0, Math.round((lostSoFar / totalToLose) * 100)));
 }

 return (
 <div className="space-y-4 pb-12 animate-in fade-in duration-150">
 {/* 1. Weight & Target Progress Banner */}
 <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-5 transition-colors space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-brand-secondary dark:text-peacock-teal-light flex items-center justify-center font-bold text-sm">
 <Scale className="w-4 h-4" />
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <h3 className="font-bold text-brand-text dark:text-peacock-pale text-sm">
 الوزن الصباحي والهدف
 </h3>
 <HelpButton featureId="bodyMeasurements" size="sm" />
 </div>
 <span className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light/70">
 (يُفضل الوزن على الريق بعد الاستيقاظ وقبل الإفطار)
 </span>
 </div>
 </div>

 {totalLostKg!== null && totalLostKg > 0 && (
 <span className="px-3 py-1 rounded-xl bg-brand-gold/15 text-brand-gold-text dark:text-brand-gold-dark font-bold text-xs flex items-center gap-1">
 <Trophy className="w-3.5 h-3.5" />
 خسارة {totalLostKg} كجم
 </span>
 )}
 </div>

 {/* Input and Key Numbers */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
 {/* Weight Input */}
 <div className="bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/80 p-3.5 rounded-2xl border border-peacock-pale dark:border-peacock-ink/40">
 <label className="block text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light mb-1">
 وزن اليوم (كجم):
 </label>
 <div className="flex items-center gap-2">
 <input
 type="number"
 step="0.1"
 value={day.weight ?? ''}
 placeholder="مثال: 82.5"
 onFocus={(e) => e.target.select()}
 onChange={(e) =>
 onUpdateDay({
...day,
 weight: e.target.value? parseFloat(e.target.value): null,
 })
 }
 className="w-full text-base font-extrabold p-2 rounded-xl border border-peacock-pale dark:border-peacock-indigo-deep/60 bg-[var(--app-card)] text-brand-text dark:text-peacock-pale outline-none focus:ring-2 focus:ring-brand-hero"
 />
 <span className="text-xs font-bold text-brand-secondary-text">كجم</span>
 </div>
 </div>

 {/* Start Weight */}
 <div className="bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/80 p-3.5 rounded-2xl border border-peacock-pale dark:border-peacock-ink/40 flex flex-col justify-center">
 <span className="text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light block">وزن بداية الرحلة:</span>
 <span className="text-base font-extrabold text-brand-text dark:text-peacock-pale mt-1">
 {startWeight? `${startWeight} كجم`: '-'}
 </span>
 </div>

 {/* Target Weight */}
 <div className="bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/80 p-3.5 rounded-2xl border border-peacock-pale dark:border-peacock-ink/40 flex flex-col justify-center">
 <span className="text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light block">الهدف المطلوب:</span>
 <span className="text-base font-extrabold text-brand-hero dark:text-peacock-indigo-light mt-1">
 {targetWeight? `${targetWeight} كجم`: '-'}
 </span>
 </div>
 </div>

 {/* Progress toward target bar */}
 {targetWeight && currentWeight && (
 <div className="pt-2 border-t border-peacock-mist dark:border-peacock-ink/30 space-y-1.5">
 <div className="flex justify-between items-center text-xs font-bold">
 <span className="text-brand-text dark:text-peacock-sage">
 {remainingKg!== null && remainingKg > 0
? `باقي ${remainingKg} كجم للوصول للهدف`
: remainingKg!== null && remainingKg <= 0
? 'تم الوصول للوزن المستهدف'
: 'نحو الوزن المستهدف'}
 </span>
 <span className="text-brand-hero dark:text-peacock-indigo-light">
 {targetProgressPercent}%
 </span>
 </div>
 <div className="w-full bg-peacock-pale/60 dark:bg-peacock-ink-deep/60 h-2 rounded-full overflow-hidden">
 <div
 className="bg-brand-hero h-full rounded-full transition-all duration-150"
 style={{ width: `${targetProgressPercent}%` }}
 />
 </div>
 </div>
 )}
 </div>

 {/* Batch 2.2: الوزن المتوقع مقابل الفعلي */}
 <WeightTrajectoryCard plan={plan} />

 {/* 2. Clinical Indicators (BMI & WHtR) */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {/* BMI Card */}
 <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-4 space-y-1.5">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-brand-secondary-text dark:text-peacock-teal-light">مؤشر كتلة الجسم (BMI)</span>
 <span className="text-lg font-extrabold text-brand-text dark:text-peacock-pale">
 {bmi.val}
 </span>
 </div>
 <p className={`text-xs font-bold ${bmi.color}`}>{bmi.label}</p>
 </div>

 {/* WHtR Card */}
 <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-4 space-y-1.5">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-brand-secondary-text dark:text-peacock-teal-light">نسبة الوسط للطول (WHtR)</span>
 <span className="text-lg font-extrabold text-brand-text dark:text-peacock-pale">
 {whtr.val}
 </span>
 </div>
 <p className={`text-xs font-bold ${whtr.color}`}>{whtr.label}</p>
 </div>
 </div>

 {/* 2.3 Menstrual Cycle & Weight Fluctuation Context */}
 {plan.cycleTracking?.enabled && (() => {
 const cycleInfo = getCycleInfo(plan.cycleTracking, currentDate);
 const weightAvgInfo = getWeightVsRecentAverage(currentDate, currentWeight);

 return (
 <div className="bg-[var(--app-card)] border border-pink-100 dark:border-pink-900/40 rounded-3xl p-5 transition-colors space-y-3.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-brand-hero flex items-center justify-center font-bold text-sm">
 <Circle className="w-4 h-4" />
 </div>
 <div>
 <h3 className="font-bold text-brand-text dark:text-peacock-pale text-sm">
 الدورة الشهرية وتغيرات الوزن
 </h3>
 {cycleInfo.dayOfCycle!== null && (
 <span className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light font-medium">
 اليوم {cycleInfo.dayOfCycle} من الدورة • {cycleInfo.phaseName}
 </span>
 )}
 </div>
 </div>

 <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cycleInfo.colorClass.badge}`}>
 {cycleInfo.phaseBadge}
 </span>
 </div>

 {/* Weight vs 7-day average comparison */}
 {weightAvgInfo.average7Days!== null && weightAvgInfo.diffFromAverage!== null && (
 <div className="p-3 rounded-2xl bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/70 border border-peacock-pale dark:border-peacock-ink/30 flex items-center justify-between text-xs">
 <span className="text-brand-secondary-text dark:text-peacock-teal-light font-medium">
 متوسط وزنك آخر {weightAvgInfo.count} أيام: <strong className="text-brand-text dark:text-peacock-pale">{weightAvgInfo.average7Days} كجم</strong>
 </span>
 <span
 className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
 weightAvgInfo.diffFromAverage > 0
? 'bg-pink-100 dark:bg-pink-950 text-pink-800 dark:text-peacock-indigo-lighter'
: 'bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light'
 }`}
 >
 {weightAvgInfo.diffFromAverage > 0? `+${weightAvgInfo.diffFromAverage}`: weightAvgInfo.diffFromAverage} كجم عن متوسط الأسبوع
 </span>
 </div>
 )}

 {/* Clinical Fixed Note */}
 <div className="p-3 rounded-2xl bg-pink-50/70 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/40 text-xs text-pink-900 dark:text-pink-200 leading-relaxed flex items-start gap-2">
 <Info className="w-4 h-4 text-brand-hero shrink-0 mt-0.5" />
 <span>
 <strong>تنويه سريري: </strong>
 {WEIGHT_FLUCTUATION_NOTE}
 </span>
 </div>
 </div>
 );
 })()}

 {/* 2.5 Medical Conditions & Diagnoses Card (Client View) */}
 {plan.medicalConditions?.showToClient!== false &&
 ((plan.medicalConditions?.conditions && plan.medicalConditions.conditions.length > 0) ||
 (plan.medicalConditions?.allergies && plan.medicalConditions.allergies.length > 0) ||
 plan.medicalConditions?.customConditionNotes) && (
 <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-5 space-y-3.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-brand-secondary dark:text-peacock-teal-light flex items-center justify-center font-bold text-sm">
 <Stethoscope className="w-4 h-4" />
 </div>
 <div>
 <h3 className="font-bold text-brand-text dark:text-peacock-pale text-sm">
 الملف الطبي والحالات المسجلة
 </h3>
 <span className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light">
 {brandCopy.approvedBy}
 </span>
 </div>
 </div>
 <span className="px-2.5 py-1 rounded-xl bg-peacock-mist dark:bg-peacock-ink-deep text-brand-secondary dark:text-peacock-teal-light font-bold text-[12px] border border-peacock-sage dark:border-peacock-indigo-deep">
 خطة علاجية مخصصة
 </span>
 </div>

 {/* Conditions Chips */}
 {plan.medicalConditions.conditions && plan.medicalConditions.conditions.length > 0 && (
 <div className="space-y-2">
 <span className="text-xs font-bold text-brand-secondary-text dark:text-peacock-teal-light block">
 التشخيصات المسجلة:
 </span>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {plan.medicalConditions.conditions.map((cond) => (
 <div
 key={cond.id}
 className="p-2.5 rounded-2xl bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/70 border border-peacock-pale dark:border-peacock-ink/40 space-y-1"
 >
 <div className="flex items-center justify-between">
 <span className="font-bold text-brand-text dark:text-peacock-pale text-xs flex items-center gap-1.5">
 <HeartPulse className="w-3.5 h-3.5 text-brand-secondary dark:text-peacock-teal" />
 {cond.label}
 </span>
 {cond.severity && (
 <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-md bg-peacock-pale/60 dark:bg-peacock-ink-deep/60 text-brand-secondary dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep">
 {cond.severity === 'mild'
? 'خفيفة'
: cond.severity === 'moderate'
? 'متوسطة'
: 'متقدمة'}
 </span>
 )}
 </div>
 {cond.notes && (
 <p className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light leading-relaxed pt-0.5">
 {cond.notes}
 </p>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Allergies Chips */}
 {plan.medicalConditions.allergies && plan.medicalConditions.allergies.length > 0 && (
 <div className="space-y-1.5 pt-1">
 <span className="text-xs font-bold text-brand-gold-text dark:text-brand-gold-dark flex items-center gap-1">
 <Tag className="w-3.5 h-3.5 text-brand-gold" />
 محظورات وحساسية الطعام:
 </span>
 <div className="flex flex-wrap gap-1.5">
 {plan.medicalConditions.allergies.map((allergy, idx) => (
 <span
 key={idx}
 className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-center gap-1"
 >
 <AlertTriangle className="w-3 h-3 text-amber-600" />
 {allergy}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Doctor/Coach Clinical Notes */}
 {plan.medicalConditions.customConditionNotes && (
 <div className="p-3 rounded-2xl bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/70 border border-peacock-pale dark:border-peacock-ink/40 text-xs text-brand-text dark:text-peacock-sage leading-relaxed">
 <span className="font-bold text-brand-text dark:text-peacock-pale block mb-1">
 إرشادات طبية خاصة:
 </span>
 {plan.medicalConditions.customConditionNotes}
 </div>
 )}

 {/* Registered Medications summary line */}
 {plan.medicationPlan?.showToClient!== false &&
 plan.medicationPlan?.items &&
 plan.medicationPlan.items.filter((m) => m.active!== false).length > 0 && (
 <div className="pt-2 border-t border-peacock-pale/60 dark:border-peacock-ink/40 flex items-center justify-between text-xs font-bold text-brand-text dark:text-peacock-sage">
 <span className="flex items-center gap-1.5 text-brand-secondary dark:text-peacock-teal">
 <Pill className="w-3.5 h-3.5" />
 <span>أدوية مسجلة في الخطة:</span>
 </span>
 <span className="px-2 py-0.5 rounded-lg bg-peacock-pale dark:bg-peacock-ink-deep text-brand-secondary dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep text-[12px]">
 {plan.medicationPlan.items.filter((m) => m.active!== false).length} أدوية
 </span>
 </div>
 )}
 </div>
 )}

 {/* Batch 2.3: بطاقة إنجازات مختصرة */}
 <MilestonesSection plan={plan} compact onNotify={onNotify} />

 {/* 3. Body Circumferences */}
 <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-5 transition-colors space-y-3">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-brand-secondary dark:text-peacock-teal-light flex items-center justify-center font-bold text-sm">
 <Ruler className="w-4 h-4" />
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <h3 className="font-bold text-brand-text dark:text-peacock-pale text-sm">
 قياسات الجسم بالمتر (سم)
 </h3>
 <HelpButton featureId="bodyMeasurements" size="sm" />
 </div>
 <span className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light/70">
 (يُفضل قياسها مرة أسبوعياً لمتابعة النحت)
 </span>
 </div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
 {/* Waist */}
 <div>
 <label className="block text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light mb-1">
 الوسط (فوق السرة بـ 1سم):
 </label>
 <input
 type="number"
 step="0.5"
 value={day.meas?.waist ?? ''}
 placeholder="مثال: 84"
 onChange={(e) =>
 onUpdateDay({
...day,
 meas: {
...day.meas,
 waist: e.target.value? parseFloat(e.target.value): null,
 },
 })
 }
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-peacock-pale dark:border-peacock-ink/40 bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-brand-text dark:text-peacock-pale"
 />
 </div>

 {/* Chest */}
 <div>
 <label className="block text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light mb-1">
 محيط الصدر:
 </label>
 <input
 type="number"
 step="0.5"
 value={day.meas?.chest ?? ''}
 placeholder="مثال: 102"
 onChange={(e) =>
 onUpdateDay({
...day,
 meas: {
...day.meas,
 chest: e.target.value? parseFloat(e.target.value): null,
 },
 })
 }
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-peacock-pale dark:border-peacock-ink/40 bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-brand-text dark:text-peacock-pale"
 />
 </div>

 {/* Hips */}
 <div>
 <label className="block text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light mb-1">
 الأرداف (الهيبس):
 </label>
 <input
 type="number"
 step="0.5"
 value={day.meas?.hips ?? ''}
 placeholder="مثال: 98"
 onChange={(e) =>
 onUpdateDay({
...day,
 meas: {
...day.meas,
 hips: e.target.value? parseFloat(e.target.value): null,
 },
 })
 }
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-peacock-pale dark:border-peacock-ink/40 bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-brand-text dark:text-peacock-pale"
 />
 </div>

 {/* Arm */}
 <div>
 <label className="block text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light mb-1">
 الذراع:
 </label>
 <input
 type="number"
 step="0.5"
 value={day.meas?.arm ?? ''}
 placeholder="مثال: 36"
 onChange={(e) =>
 onUpdateDay({
...day,
 meas: {
...day.meas,
 arm: e.target.value? parseFloat(e.target.value): null,
 },
 })
 }
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-peacock-pale dark:border-peacock-ink/40 bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-brand-text dark:text-peacock-pale"
 />
 </div>

 {/* Thigh */}
 <div>
 <label className="block text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light mb-1">
 الفخذ:
 </label>
 <input
 type="number"
 step="0.5"
 value={day.meas?.thigh ?? ''}
 placeholder="مثال: 56"
 onChange={(e) =>
 onUpdateDay({
...day,
 meas: {
...day.meas,
 thigh: e.target.value? parseFloat(e.target.value): null,
 },
 })
 }
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-peacock-pale dark:border-peacock-ink/40 bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-brand-text dark:text-peacock-pale"
 />
 </div>

 {/* Neck */}
 <div>
 <label className="block text-[12px] font-bold text-brand-secondary-text dark:text-peacock-teal-light mb-1">
 الرقبة:
 </label>
 <input
 type="number"
 step="0.5"
 value={day.meas?.neck ?? ''}
 placeholder="مثال: 39"
 onChange={(e) =>
 onUpdateDay({
...day,
 meas: {
...day.meas,
 neck: e.target.value? parseFloat(e.target.value): null,
 },
 })
 }
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-peacock-pale dark:border-peacock-ink/40 bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-brand-text dark:text-peacock-pale"
 />
 </div>
 </div>
 </div>

 {/* 4. Lab Tests Tracker */}
 {isSectionVisible(plan, 'labTracker') && (
 <LabTrackerSection
 plan={plan}
 onUpdatePlan={onUpdatePlan || (() => {})}
 onNotify={onNotify}
 />
 )}

 {/* 5. Private Progress Photos Gallery */}
 <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-5 transition-colors space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-brand-hero flex items-center justify-center font-bold text-sm">
 <Camera className="w-4 h-4" />
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <h3 className="font-bold text-brand-text dark:text-peacock-pale text-sm">
 معرض صور التطور الشخصي
 </h3>
 <HelpButton featureId="photoCompare" size="sm" />
 </div>
 <span className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light flex items-center gap-1">
 <ShieldCheck className="w-3 h-3 text-emerald-500" />
 محفوظة على جهازك فقط
 </span>
 </div>
 </div>

 <button
 onClick={onOpenComparePhotos}
 className="px-3.5 py-1.5 rounded-xl bg-brand-secondary hover:bg-brand-secondary/90 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
 >
 <Columns className="w-3.5 h-3.5" />
 مقارنة قبل / بعد
 </button>
 </div>

 {/* Upload Button */}
 <div>
 <label className="w-full py-3 rounded-2xl border-2 border-dashed border-peacock-sage dark:border-peacock-ink/60 hover:border-brand-hero bg-[var(--app-bg)] dark:bg-[var(--app-bg)]/40 text-brand-text dark:text-peacock-sage font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer">
 <Plus className="w-4 h-4 text-brand-hero" />
 {isUploadingPhoto? 'جاري حفظ الصورة...': 'إضافة صورة تطور ليوم النهاردة'}
 <input
 type="file"
 accept="image/*"
 disabled={isUploadingPhoto}
 onChange={handlePhotoUpload}
 className="hidden"
 />
 </label>
 </div>

 {/* Photos Grid for current date */}
 {dayPhotos.length > 0? (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {dayPhotos.map((photo) => (
 <div
 key={photo.id}
 className="relative rounded-2xl overflow-hidden aspect-3/4 bg-slate-950 border border-peacock-pale dark:border-peacock-ink/40 group"
 >
 <img
 src={photo.data}
 alt={`تطور ${photo.date}`}
 className="w-full h-full object-cover"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-2">
 <span className="text-[12px] text-white font-bold">
 {photo.date}
 </span>
 <button
 onClick={() => handleDeletePhoto(photo.id)}
 className="p-1 rounded-lg bg-rose-600/80 text-white hover:bg-rose-600 transition-colors cursor-pointer"
 title="حذف"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 </div>
 ))}
 </div>
 ): (
 <p className="text-center text-xs text-brand-secondary-text dark:text-peacock-teal-light py-3">
 لا توجد صور لهذا اليوم. أضيفي صورة من الزر بالأعلى.
 </p>
 )}
 </div>
 </div>
 );
};
