import { CycleTrackingConfig, ClinicalCycleFlag, DayLog } from '../types';
import { loadDayLog, getTodayDateString, parseLocalDate } from './storage';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'delayed_or_uncertain';

export interface CycleSymptomMeta {
 id: string;
 label: string;
 icon: string;
 category?: string;
}

export const CYCLE_SYMPTOMS: CycleSymptomMeta[] = [
 { id: 'cramps', label: 'مغص وتقلصات', icon: '' },
 { id: 'bloating', label: 'انتفاخ بالبطن', icon: '' },
 { id: 'water_retention', label: 'احتباس سوائل', icon: '' },
 { id: 'sugar_cravings', label: 'اشتهاء سكريات', icon: '' },
 { id: 'fatigue', label: 'تعب وانخفاض طاقة', icon: '' },
 { id: 'headache', label: 'صداع', icon: '' },
 { id: 'mood', label: 'تقلب مزاج وعصبية', icon: '' },
 { id: 'ovulation_pain', label: 'ألم تبويض', icon: '' },
 { id: 'breast_tenderness', label: 'ألم بالثدي', icon: '' },
 { id: 'spotting', label: 'بقع دم خفيفة', icon: '' },
 { id: 'acne', label: 'حبوب وبثور', icon: '' },
 { id: 'sleep_issues', label: 'اضطراب نوم', icon: '' },
];

export const CLINICAL_FLAGS_META: Record<ClinicalCycleFlag, { label: string; note: string; badgeColor: string }> = {
 pcos: {
 label: 'متلازمة تكيس المبايض (PCOS)',
 note: 'سياق سريري مسجل للمتابعة الغذائية وضبط حساسية الإنسولين',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep border-peacock-teal-light dark:bg-peacock-ink-deep dark:text-peacock-teal-light',
 },
 endometriosis: {
 label: 'بطانة الرحم المهاجرة (Endometriosis)',
 note: 'سياق مسجل لمراعاة الالتهابات ومستويات الألم',
 badgeColor: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300',
 },
 fluid_retention: {
 label: 'احتباس سوائل ملحوظ دورياً',
 note: 'تقلبات وزن متوقعة (0.5-2 كجم) في طور اللوتيل والحيض',
 badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
 },
 other: {
 label: 'حالة / علامة سريرية أخرى',
 note: 'ملاحظات خاصة من الأخصائية',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep border-peacock-teal-light dark:bg-peacock-ink-deep dark:text-peacock-teal-light',
 },
};

export interface CyclePhaseInfo {
 dayOfCycle: number | null;
 phase: CyclePhase;
 phaseName: string;
 phaseBadge: string;
 icon: string;
 colorClass: {
 badge: string;
 border: string;
 bg: string;
 text: string;
 };
 description: string;
 nutritionTip: string;
 isPeriodDay: boolean;
 daysUntilNextPeriodEstimate: number | null;
}

export const CYCLE_DISCLAIMER = 'الحساب تقريبي للمتابعة الغذائية وضبط أهداف الطاقة والماء، وليس بديلاً عن تقييم طبي أو تتبع إباضة طبي.';

export const WEIGHT_FLUCTUATION_NOTE = 'الوزن قد يرتفع 0.5-2 كجم حول الحيض والطور الأصفري بسبب احتباس السوائل وتغير الهرمونات: ليس بالضرورة دهوناً.';

/**
 * Calculates current cycle day and approximate phase
 */
export function getCycleInfo(
 config?: CycleTrackingConfig,
 currentDateStr: string = getTodayDateString()
): CyclePhaseInfo {
 if (!config ||!config.enabled ||!config.lastPeriodStart) {
 return {
 dayOfCycle: null,
 phase: 'delayed_or_uncertain',
 phaseName: 'غير محدد',
 phaseBadge: 'الدورة غير مسجلة',
 icon: '',
 colorClass: {
 badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700',
 border: 'border-slate-200 dark:border-slate-800',
 bg: 'bg-slate-50 dark:bg-slate-900/40',
 text: 'text-slate-700 dark:text-slate-200',
 },
 description: 'لم يتم تحديد تاريخ بداية آخر دورة بعد.',
 nutritionTip: 'سجّلي تاريخ بداية دورتك للحصول على إرشادات غذائية مخصصة لطورك الهرموني.',
 isPeriodDay: false,
 daysUntilNextPeriodEstimate: null,
 };
 }

 const cycleLength = config.typicalCycleLength && config.typicalCycleLength >= 20? config.typicalCycleLength: 28;
 const periodLength = config.typicalPeriodLength && config.typicalPeriodLength >= 2? config.typicalPeriodLength: 5;

 const startDate = parseLocalDate(config.lastPeriodStart);
 const targetDate = parseLocalDate(currentDateStr);
 const diffTime = targetDate.getTime() - startDate.getTime();
 const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

 // If start date is in future or negative
 if (diffDays < 0) {
 return {
 dayOfCycle: 1,
 phase: 'menstrual',
 phaseName: 'طور الحيض (تقريبي)',
 phaseBadge: 'اليوم 1 • حيض',
 icon: '',
 colorClass: {
 badge: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
 border: 'border-rose-200 dark:border-rose-900/50',
 bg: 'bg-rose-50/60 dark:bg-rose-950/20',
 text: 'text-rose-800 dark:text-rose-200',
 },
 description: 'أيام نزول الحيض. قد تشعرين بحاجة للراحة وترطيب أعلى.',
 nutritionTip: 'ركزي على الأطعمة الغنية بالحديد، السوائل الدافئة، ومصادر المغنيسيوم كالمكسرات والكاكاو الداكن.',
 isPeriodDay: true,
 daysUntilNextPeriodEstimate: cycleLength,
 };
 }

 // Day of cycle is 1-indexed (Day 1 is startDate)
 const rawDayOfCycle = (diffDays % cycleLength) + 1;
 const totalDaysSinceStart = diffDays + 1;

 // Irregular cycle handling or exceeding cycle + 7 days
 const isIrregular = config.regularity === 'irregular';
 const isOverdue = diffDays >= cycleLength + 7 &&!config.cycleStarts?.includes(currentDateStr);

 let phase: CyclePhase = 'delayed_or_uncertain';
 let phaseName = 'طور تقريبي';
 let isPeriodDay = false;

 const daysUntilNext = Math.max(0, cycleLength - (rawDayOfCycle - 1));

 if (isOverdue || (isIrregular && totalDaysSinceStart > cycleLength)) {
 phase = 'delayed_or_uncertain';
 phaseName = 'غير محسوم / تأخير محتمل';
 } else if (rawDayOfCycle <= periodLength) {
 phase = 'menstrual';
 phaseName = 'طور الحيض (تقريبي)';
 isPeriodDay = true;
 } else if (rawDayOfCycle <= cycleLength - 16) {
 phase = 'follicular';
 phaseName = 'الطور الجريبي (Follicular)';
 } else if (rawDayOfCycle <= cycleLength - 11) {
 phase = 'ovulation';
 phaseName = 'نافذة الإباضة التقريبية';
 } else {
 phase = 'luteal';
 phaseName = 'الطور الأصفري (Lutéal)';
 }

 // Phase metadata and UI styling
 switch (phase) {
 case 'menstrual':
 return {
 dayOfCycle: rawDayOfCycle,
 phase,
 phaseName,
 phaseBadge: `اليوم ${rawDayOfCycle} • حيض`,
 icon: '',
 colorClass: {
 badge: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
 border: 'border-rose-200 dark:border-rose-900/50',
 bg: 'bg-rose-50/60 dark:bg-rose-950/20',
 text: 'text-rose-800 dark:text-rose-200',
 },
 description: 'بداية الدورة الهرمونية. انخفاض الإستروجين والبروجسترون قد يصحبه هبوط بالطاقة ومغص.',
 nutritionTip: 'أكثري من الأطعمة الغنية بالحديد وفيتامين C لتحسين الامتصاص، واحرصي على شرب الماء الدافئ لتخفيف التقلصات.',
 isPeriodDay: true,
 daysUntilNextPeriodEstimate: daysUntilNext,
 };

 case 'follicular':
 return {
 dayOfCycle: rawDayOfCycle,
 phase,
 phaseName,
 phaseBadge: `اليوم ${rawDayOfCycle} • طور جريبي`,
 icon: '',
 colorClass: {
 badge: 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
 border: 'border-sky-200 dark:border-sky-900/50',
 bg: 'bg-sky-50/60 dark:bg-sky-950/20',
 text: 'text-sky-800 dark:text-sky-200',
 },
 description: 'ارتفاع تدريجي بهرمون الإستروجين. غالباً ما تشهد هذه المرحلة تحسناً بالطاقة والنشاط ومرونة التمثيل الغذائي.',
 nutritionTip: 'وقت مثالي للالتزام بالتمارين وتناول الكربوهيدرات المعقدة والبروتين عالي الجودة لدعم البناء والنشاط.',
 isPeriodDay: false,
 daysUntilNextPeriodEstimate: daysUntilNext,
 };

 case 'ovulation':
 return {
 dayOfCycle: rawDayOfCycle,
 phase,
 phaseName,
 phaseBadge: `اليوم ${rawDayOfCycle} • إباضة تقريبية`,
 icon: '',
 colorClass: {
 badge: 'bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light border-peacock-teal-light dark:border-peacock-indigo-deep',
 border: 'border-peacock-sage dark:border-peacock-ink/50',
 bg: 'bg-peacock-mist/60 dark:bg-peacock-ink-deep/20',
 text: 'text-peacock-indigo-deep dark:text-peacock-sage',
 },
 description: 'ذروة هرمون الإستروجين وارتفاع الـ LH. قد تشعرين بنشاط عالٍ أو وخز خفيف جهة المبيض.',
 nutritionTip: 'تناولي مضادات الأكسدة والخضراوات الورقية والألياف لدعم التخلص الطبيعي من مستقلبات الإستروجين الزائدة.',
 isPeriodDay: false,
 daysUntilNextPeriodEstimate: daysUntilNext,
 };

 case 'luteal':
 return {
 dayOfCycle: rawDayOfCycle,
 phase,
 phaseName,
 phaseBadge: `اليوم ${rawDayOfCycle} • طور لوتيل`,
 icon: '',
 colorClass: {
 badge: 'bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light border-peacock-teal-light dark:border-peacock-indigo-deep',
 border: 'border-peacock-sage dark:border-peacock-ink/50',
 bg: 'bg-peacock-mist/60 dark:bg-peacock-ink-deep/20',
 text: 'text-peacock-indigo-deep dark:text-peacock-sage',
 },
 description: 'سيادة هرمون البروجسترون. قد ترتفع الشهية ويحدث احتباس ماء طفيف مع تقلبات مزاجية قبل الحيض (PMS).',
 nutritionTip: 'عززي المغنيسيوم، قللي الملح المكرر لتفادي زيادة الاحتباس، واستبدلي السكريات البسيطة بوجبات متوازنة بروتين وألياف.',
 isPeriodDay: false,
 daysUntilNextPeriodEstimate: daysUntilNext,
 };

 case 'delayed_or_uncertain':
 default:
 return {
 dayOfCycle: totalDaysSinceStart,
 phase: 'delayed_or_uncertain',
 phaseName: 'غير محسوم / تأخير محتمل',
 phaseBadge: `اليوم ${totalDaysSinceStart} • غير محسوم`,
 icon: '⏳',
 colorClass: {
 badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
 border: 'border-slate-200 dark:border-slate-800',
 bg: 'bg-slate-50 dark:bg-slate-900/40',
 text: 'text-slate-700 dark:text-slate-300',
 },
 description: 'الدورة غير منتظمة أو تجاوزت المدة المتوقعة. سجّلي بداية الحيض فور حدوثه لإعادة ضبط الحسابات.',
 nutritionTip: 'استمري في نظامك الغذائي الصحي وحافظي على شرب الماء المتوازن والنوم الكافي.',
 isPeriodDay: false,
 daysUntilNextPeriodEstimate: null,
 };
 }
}

/**
 * Calculates 7-day average weight difference to detect cycle-related fluid retention
 */
export function getWeightVsRecentAverage(
 currentDateStr: string,
 todayWeight: number | null
): {
 average7Days: number | null;
 diffFromAverage: number | null;
 count: number;
} {
 if (!todayWeight || todayWeight <= 0) {
 return { average7Days: null, diffFromAverage: null, count: 0 };
 }

 const baseDate = parseLocalDate(currentDateStr);
 const weights: number[] = [];

 for (let i = 1; i <= 7; i++) {
 const prevDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - i);
 const dStr = getTodayDateString(prevDate);
 const log = loadDayLog(dStr);
 if (log && log.weight && log.weight > 0) {
 weights.push(log.weight);
 }
 }

 if (weights.length === 0) {
 return { average7Days: null, diffFromAverage: null, count: 0 };
 }

 const sum = weights.reduce((a, b) => a + b, 0);
 const avg = Math.round((sum / weights.length) * 10) / 10;
 const diff = Math.round((todayWeight - avg) * 10) / 10;

 return {
 average7Days: avg,
 diffFromAverage: diff,
 count: weights.length,
 };
}
