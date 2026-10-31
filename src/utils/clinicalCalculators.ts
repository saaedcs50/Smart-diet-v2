// Clinical Nutrition & Metabolism Calculator Suite Engine
// Provides standardized medical & sports nutrition formulas

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';

export interface BMRParams {
 weightKg: number;
 heightCm: number;
 ageYears: number;
 gender: Gender;
 bodyFatPercentage?: number;
}

export interface ActivityOption {
 id: ActivityLevel;
 factor: number;
 labelAr: string;
 descAr: string;
}

export const PAL_FACTORS: ActivityOption[] = [
 { id: 'sedentary', factor: 1.2, labelAr: 'خامل / لا تمارين (1.2)', descAr: 'عمل مكتبي وقليل الحركة جدًا' },
 { id: 'light', factor: 1.375, labelAr: 'نشاط خفيف (1.375)', descAr: 'تمارين خفيفة 1-3 أيام أسبوعياً' },
 { id: 'moderate', factor: 1.55, labelAr: 'نشاط متوسط (1.55)', descAr: 'تمارين متوسطة 3-5 أيام أسبوعياً' },
 { id: 'very_active', factor: 1.725, labelAr: 'نشاط عالٍ (1.725)', descAr: 'تمارين شاقة 6-7 أيام أسبوعياً' },
 { id: 'extra_active', factor: 1.9, labelAr: 'نشاط فائق / رياضي محترف (1.9)', descAr: 'تمارين مكثفة مرتين يومياً أو عمل بدني شاق' },
];

/**
 * 1. BMR & TDEE Calculations
 */
export function calculateKholoudBMR(p: BMRParams): number {
 return Math.round(9.99 * p.weightKg + 6.25 * p.heightCm - 4.92 * p.ageYears);
}

export function calculateMifflinStJeor(p: BMRParams): number {
 const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears;
 return Math.round(p.gender === 'male'? base + 5: base - 161);
}

export function calculateHarrisBenedictRevised(p: BMRParams): number {
 if (p.gender === 'male') {
 return Math.round(88.362 + 13.397 * p.weightKg + 4.799 * p.heightCm - 5.677 * p.ageYears);
 } else {
 return Math.round(447.593 + 9.247 * p.weightKg + 3.098 * p.heightCm - 4.33 * p.ageYears);
 }
}

export function calculateKatchMcArdle(weightKg: number, bodyFatPercentage: number): number {
 const leanMassKg = weightKg * (1 - bodyFatPercentage / 100);
 return Math.round(370 + 21.6 * leanMassKg);
}

export function calculateCunningham(weightKg: number, bodyFatPercentage: number): number {
 const leanMassKg = weightKg * (1 - bodyFatPercentage / 100);
 return Math.round(500 + 22 * leanMassKg);
}

export interface BMRComparisonResult {
 kholoud: number;
 mifflin: number;
 harrisBenedict: number;
 katchMcArdle: number | null;
 cunningham: number | null;
}

export function calculateAllBMRFormulas(p: BMRParams): BMRComparisonResult {
 const kholoud = calculateKholoudBMR(p);
 const mifflin = calculateMifflinStJeor(p);
 const harris = calculateHarrisBenedictRevised(p);
 const katch = typeof p.bodyFatPercentage === 'number' && p.bodyFatPercentage > 0
? calculateKatchMcArdle(p.weightKg, p.bodyFatPercentage)
: null;
 const cunningham = typeof p.bodyFatPercentage === 'number' && p.bodyFatPercentage > 0
? calculateCunningham(p.weightKg, p.bodyFatPercentage)
: null;

 return {
 kholoud,
 mifflin,
 harrisBenedict: harris,
 katchMcArdle: katch,
 cunningham,
 };
}

/**
 * 2. Body Composition & Anthropometry
 */

// US Navy Tape Method Body Fat Calculator (Standard Hodgdon & Beckett Metric Formula)
export function calculateUSNavyBodyFat(
 gender: Gender,
 heightCm: number,
 neckCm: number,
 waistCm: number,
 hipCm: number = 0
): number | null {
 if (!heightCm ||!neckCm ||!waistCm || heightCm <= 0) return null;

 if (gender === 'male') {
 const diff = waistCm - neckCm;
 if (diff <= 0) return null;
 const logDiff = Math.log10(diff);
 const logHeight = Math.log10(heightCm);
 // Standard Navy Tape Metric Formula for Men
 const denominator = 1.0324 - 0.19077 * logDiff + 0.15456 * logHeight;
 if (denominator <= 0) return null;
 const bf = 495 / denominator - 450;
 return Math.max(2, Math.min(60, Math.round(bf * 10) / 10));
 } else {
 if (!hipCm || hipCm <= 0) return null;
 const sum = waistCm + hipCm - neckCm;
 if (sum <= 0) return null;
 const logSum = Math.log10(sum);
 const logHeight = Math.log10(heightCm);
 // Standard Navy Tape Metric Formula for Women
 const denominator = 1.29579 - 0.35004 * logSum + 0.22100 * logHeight;
 if (denominator <= 0) return null;
 const bf = 495 / denominator - 450;
 return Math.max(4, Math.min(65, Math.round(bf * 10) / 10));
 }
}

// Ideal Body Weight (IBW)
export function calculateIBW(heightCm: number, gender: Gender) {
 const heightInches = heightCm / 2.54;
 const inchesOver5Ft = Math.max(0, heightInches - 60);

 let devine: number;
 let hamwi: number;
 let broca = Math.max(30, heightCm - 100);

 if (gender === 'male') {
 devine = 50 + 2.3 * inchesOver5Ft;
 hamwi = 48 + 2.7 * inchesOver5Ft;
 } else {
 devine = 45.5 + 2.3 * inchesOver5Ft;
 hamwi = 45.5 + 2.2 * inchesOver5Ft;
 broca = Math.max(30, (heightCm - 100) * 0.85);
 }

 return {
 devine: Math.round(devine * 10) / 10,
 hamwi: Math.round(hamwi * 10) / 10,
 broca: Math.round(broca * 10) / 10,
 };
}

// Adjusted Body Weight (ABW) for obesity cases
export function calculateABW(actualWeightKg: number, ibwKg: number): number {
 if (actualWeightKg <= ibwKg) return actualWeightKg;
 const abw = ibwKg + 0.4 * (actualWeightKg - ibwKg);
 return Math.round(abw * 10) / 10;
}

// BMI & WHtR
export function calculateBMI(weightKg: number, heightCm: number): { bmi: number; categoryAr: string; color: string } {
 if (!heightCm || heightCm <= 0) return { bmi: 0, categoryAr: 'غير محدد', color: 'text-slate-400' };
 const heightM = heightCm / 100;
 const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

 let categoryAr: string;
 let color: string;

 if (bmi < 18.5) {
 categoryAr = 'نقص في الوزن (Underweight)';
 color = 'text-blue-500';
 } else if (bmi >= 18.5 && bmi < 25) {
 categoryAr = 'وزن طبيعي وبصير صحي (Normal)';
 color = 'text-peacock-blue';
 } else if (bmi >= 25 && bmi < 30) {
 categoryAr = 'زيادة وزن (Overweight)';
 color = 'text-amber-500';
 } else if (bmi >= 30 && bmi < 35) {
 categoryAr = 'سمنة من الدرجة الأولى (Obesity Class I)';
 color = 'text-orange-500';
 } else if (bmi >= 35 && bmi < 40) {
 categoryAr = 'سمنة من الدرجة الثانية (Obesity Class II)';
 color = 'text-rose-500';
 } else {
 categoryAr = 'سمنة مفرطة شديدة (Morbid Obesity Class III)';
 color = 'text-rose-700';
 }

 return { bmi, categoryAr, color };
}

export function calculateWHtR(waistCm: number, heightCm: number): { ratio: number; categoryAr: string } {
 if (!heightCm || heightCm <= 0) return { ratio: 0, categoryAr: 'غير محدد' };
 const ratio = Math.round((waistCm / heightCm) * 100) / 100;

 let categoryAr: string;
 if (ratio < 0.4) categoryAr = 'نحافة عالية في الخصر';
 else if (ratio <= 0.5) categoryAr = 'صحي ومثالي (خطر منخفض)';
 else if (ratio <= 0.6) categoryAr = 'ارتفاع طفيف في دهون البطن';
 else categoryAr = 'ارتفاع عالي في دهون البطن والترسبات الأحشائية';

 return { ratio, categoryAr };
}

/**
 * 3. Fluid & Sports Nutrition Calculations
 */

// Daily Fluid Intake Calculator (Holliday-Segar + Activity)
// تحذير (SDV2-CLIN-002): هذا تقدير عام وليس توصية طبية.
// لا يأخذ في الاعتبار: العمر، الجنس، الحمل/الرضاعة، أمراض الكلى/القلب،
// أو الحالات التي تتطلب تقييد السوائل. استشر مختصًا للحالات الخاصة.
export function calculateDailyFluid(weightKg: number, activityHoursPerWeek: number = 3): {
 baseLiters: number;
 sportsLiters: number;
 totalLiters: number;
 glassesCount: number;
 isEstimate: true;
 warningAr: string;
} {
 let baseMl: number;
 if (weightKg <= 10) {
 baseMl = weightKg * 100;
 } else if (weightKg <= 20) {
 baseMl = 1000 + (weightKg - 10) * 50;
 } else {
 baseMl = 1500 + (weightKg - 20) * 20;
 }

 // Weight standard (35ml/kg)
 const weightBasedMl = weightKg * 35;
 const avgBaseMl = Math.max(baseMl, weightBasedMl);

 // Extra hydration for workout sessions (~500ml per hour of activity spread daily)
 const extraSportsMl = (activityHoursPerWeek / 7) * 500;
 const totalMl = avgBaseMl + extraSportsMl;

 const baseLiters = Math.round((avgBaseMl / 1000) * 10) / 10;
 const sportsLiters = Math.round((extraSportsMl / 1000) * 10) / 10;
 const totalLiters = Math.round((totalMl / 1000) * 10) / 10;
 const glassesCount = Math.ceil((totalMl / 250)); // 250ml glass

 return {
   baseLiters,
   sportsLiters,
   totalLiters,
   glassesCount,
   isEstimate: true,
   warningAr: 'تقدير عام وليس توصية طبية — استشر مختصًا في حالات الحمل أو أمراض الكلى/القلب أو تقييد السوائل',
 };
}

// Peri-Workout Carbohydrate & Protein Recommendation
export function calculatePeriWorkoutNutrition(weightKg: number) {
 return {
 preWorkoutCarbsGrams: `${Math.round(weightKg * 0.5)} - ${Math.round(weightKg * 1.0)} جرام`,
 intraWorkoutCarbsGrams: weightKg > 75? '30 - 45 جرام (للتدريب الطويل > 60 دقيقة)': '20 - 30 جرام',
 postWorkoutProteinGrams: `${Math.round(weightKg * 0.3)} - ${Math.round(weightKg * 0.4)} جرام بروتين سريع الامتصاص`,
 postWorkoutCarbsGrams: `${Math.round(weightKg * 0.8)} - ${Math.round(weightKg * 1.0)} جرام كربوهيدرات لتعويض الجلايكوجين`,
 };
}

/**
 * 4. Target Timeline & Safe Rate Calculator
 */
export function calculateTargetTimeline(
 currentWeightKg: number,
 targetWeightKg: number,
 dailyDeficitSurplusKcal: number // positive for surplus (gain), negative for deficit (loss)
) {
 const weightDiffKg = targetWeightKg - currentWeightKg;
 // SDV2-BUG-002: الحالات غير القابلة للتقدير — لا نعيد صفرًا مضللًا.
 if (weightDiffKg === 0) {
 return {
 weeks: 0,
 months: 0,
 weeklyRateKg: 0,
 isSafe: true,
 estimable: true,
 messageAr: 'الوزن الحالي متطابق مع الوزن المستهدف.',
 };
 }
 if (dailyDeficitSurplusKcal === 0) {
 return {
 weeks: 0,
 months: 0,
 weeklyRateKg: 0,
 isSafe: false,
 estimable: false,
 messageAr: 'لا يمكن التقدير: العجز/الفائض اليومي صفر والوزن المستهدف مختلف. حدد عجزًا أو فائضًا غير صفري.',
 };
 }
 // التحقق من اتساق الاتجاه: عجز مع هدف نزول، أو فائض مع هدف زيادة
 const isLoss = weightDiffKg < 0;
 const isDeficit = dailyDeficitSurplusKcal < 0;
 if (isLoss !== isDeficit) {
 return {
 weeks: 0,
 months: 0,
 weeklyRateKg: 0,
 isSafe: false,
 estimable: false,
 messageAr: 'اتجاه السعرات لا يتسق مع اتجاه الوزن المستهدف (عجز للنزول، فائض للزيادة).',
 };
 }

 // Approx 7700 kcal per 1 kg of body fat/tissue
 const totalCaloriesNeeded = Math.abs(weightDiffKg) * 7700;
 const daysNeeded = Math.ceil(totalCaloriesNeeded / Math.abs(dailyDeficitSurplusKcal));
 const weeks = Math.round((daysNeeded / 7) * 10) / 10;
 const months = Math.round((daysNeeded / 30) * 10) / 10;

 const weeklyRateKg = Math.round(((Math.abs(dailyDeficitSurplusKcal) * 7) / 7700) * 100) / 100;

 // Max safe weekly weight loss rate = 0.5% to 1% of body weight per week
 const maxSafeWeeklyLoss = Math.round((currentWeightKg * 0.01) * 100) / 100;
 const minSafeWeeklyLoss = Math.round((currentWeightKg * 0.005) * 100) / 100;

 const isSafe = isLoss? weeklyRateKg <= maxSafeWeeklyLoss: weeklyRateKg <= 1.0;

 let messageAr: string;
 if (isLoss) {
 if (weeklyRateKg > maxSafeWeeklyLoss) {
 messageAr = ` العجز الحالي (${Math.abs(dailyDeficitSurplusKcal)} ك.س) قد يؤدي لفقدان كتل عضلية! المعدل الآمن لجسمك هو ${minSafeWeeklyLoss} إلى ${maxSafeWeeklyLoss} كجم/أسبوع.`;
 } else {
 messageAr = ` معدل نزول أمان ومثالي للغاية (${weeklyRateKg} كجم/أسبوع) يحافظ على كتلتك العضلية.`;
 }
 } else {
 messageAr = ` معدل زيادة الوزن المتوقع هو ${weeklyRateKg} كجم/أسبوع لبناء كتلة عضلية صحية.`;
 }

 return {
 weeks,
 months,
 weeklyRateKg,
 maxSafeWeeklyLoss,
 isSafe,
 messageAr,
 };
}
