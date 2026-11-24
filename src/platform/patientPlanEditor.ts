import type { PlanConfig } from '../types';

const LIMITS = {
  clientName: 100,
  meals: 40,
  checklist: 60,
  supplements: 40,
  medications: 40,
  alternatives: 20,
} as const;

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validateUniqueIds(
  items: Array<{ id?: string }>,
  label: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id) {
      errors.push(`${label}: يوجد عنصر بلا معرّف.`);
      continue;
    }
    if (seen.has(id)) errors.push(`${label}: يوجد معرّف مكرر.`);
    seen.add(id);
  }
}

function validateOptionalNumber(
  value: number | null | undefined,
  label: string,
  min: number,
  max: number,
  errors: string[],
): void {
  if (value == null) return;
  if (!isFiniteInRange(value, min, max)) {
    errors.push(`${label}: أدخل قيمة بين ${min} و${max}.`);
  }
}

function validTime(value: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

export function createEmptyPatientPlan(clientName: string): PlanConfig {
  return {
    clientName: clientName.trim(),
    dailyWaterGoalMl: 0,
    heightCm: null,
    startWeight: null,
    targetWeight: null,
    targetWaist: null,
    freezeDaysPerMonth: 0,
    adminPin: '',
    scoreWeights: { checklist: 25, water: 25, sleep: 25, meals: 25 },
    meals: [],
    checklist: [],
    supplements: [],
    tips: [],
    symptomsList: [],
  };
}

/**
 * Structural input validation for a clinician-authored plan.
 * It checks values and units only; it does not calculate or prescribe targets.
 */
export function validatePatientPlan(plan: PlanConfig): string[] {
  const errors: string[] = [];
  if (!plan.clientName.trim() || plan.clientName.trim().length > LIMITS.clientName) {
    errors.push('اسم المريض مطلوب وبحد أقصى 100 حرف.');
  }

  if (!isFiniteInRange(plan.dailyWaterGoalMl, 250, 10000) || !Number.isInteger(plan.dailyWaterGoalMl)) {
    errors.push('هدف الماء اليومي يجب أن يكون رقمًا صحيحًا بين 250 و10000 مل.');
  }
  validateOptionalNumber(plan.heightCm, 'الطول (سم)', 60, 250, errors);
  validateOptionalNumber(plan.startWeight, 'وزن البداية (كجم)', 20, 400, errors);
  validateOptionalNumber(plan.targetWeight, 'الوزن المستهدف (كجم)', 20, 400, errors);
  validateOptionalNumber(plan.targetWaist, 'محيط الخصر المستهدف (سم)', 25, 250, errors);
  if (!Number.isInteger(plan.freezeDaysPerMonth) || plan.freezeDaysPerMonth < 0 || plan.freezeDaysPerMonth > 31) {
    errors.push('أيام الراحة الشهرية يجب أن تكون عددًا صحيحًا بين 0 و31.');
  }

  const targets = [
    ['السعرات اليومية (kcal)', plan.targetCalories, 500, 10000],
    ['البروتين اليومي (جم)', plan.targetProtein, 0, 1000],
    ['الكربوهيدرات اليومية (جم)', plan.targetCarbs, 0, 1500],
    ['الدهون اليومية (جم)', plan.targetFats, 0, 1000],
  ] as const;
  for (const [label, value, min, max] of targets) {
    validateOptionalNumber(value, label, min, max, errors);
  }

  if (plan.meals.length > LIMITS.meals) errors.push(`عدد الوجبات يتجاوز الحد المسموح (${LIMITS.meals}).`);
  validateUniqueIds(plan.meals, 'الوجبات', errors);
  plan.meals.forEach((meal, index) => {
    const prefix = `الوجبة ${index + 1}`;
    if (!meal.name.trim() || meal.name.trim().length > 100) errors.push(`${prefix}: الاسم مطلوب وبحد أقصى 100 حرف.`);
    if (!meal.items.trim() || meal.items.length > 2500) errors.push(`${prefix}: المكونات والكميات مطلوبة وبحد أقصى 2500 حرف.`);
    if (meal.time && !validTime(meal.time)) errors.push(`${prefix}: الوقت يجب أن يكون بصيغة 24 ساعة مثل 08:30.`);
    if (meal.alternatives.length > LIMITS.alternatives) errors.push(`${prefix}: لا يمكن إضافة أكثر من ${LIMITS.alternatives} بديلًا.`);
    if (meal.alternatives.some((item) => !item.trim() || item.length > 200)) errors.push(`${prefix}: راجع نصوص البدائل (حتى 200 حرف لكل بديل).`);
    validateOptionalNumber(meal.calories, `${prefix} — السعرات`, 0, 5000, errors);
    validateOptionalNumber(meal.proteinGrams, `${prefix} — البروتين`, 0, 500, errors);
  });

  if (plan.checklist.length > LIMITS.checklist) errors.push(`عدد بنود المتابعة يتجاوز الحد المسموح (${LIMITS.checklist}).`);
  validateUniqueIds(plan.checklist, 'بنود المتابعة', errors);
  plan.checklist.forEach((item, index) => {
    if (!item.label.trim() || item.label.trim().length > 160) errors.push(`بند المتابعة ${index + 1}: النص مطلوب وبحد أقصى 160 حرفًا.`);
  });

  if (plan.supplements.length > LIMITS.supplements) errors.push(`عدد المكملات يتجاوز الحد المسموح (${LIMITS.supplements}).`);
  validateUniqueIds(plan.supplements, 'المكملات', errors);
  plan.supplements.forEach((item, index) => {
    if (!item.name.trim() || item.name.trim().length > 120) errors.push(`المكمل ${index + 1}: الاسم مطلوب وبحد أقصى 120 حرفًا.`);
    if ((item.notes?.length ?? 0) > 500) errors.push(`المكمل ${index + 1}: الملاحظات تتجاوز 500 حرف.`);
  });

  const medications = plan.medicationPlan?.items ?? [];
  if (medications.length > LIMITS.medications) errors.push(`عدد الأدوية يتجاوز الحد المسموح (${LIMITS.medications}).`);
  validateUniqueIds(medications, 'الأدوية', errors);
  medications.forEach((item, index) => {
    const prefix = `الدواء ${index + 1}`;
    if (!item.name.trim() || item.name.trim().length > 120) errors.push(`${prefix}: اسم الدواء مطلوب وبحد أقصى 120 حرفًا.`);
    if (!item.dose.trim()) errors.push(`${prefix}: أدخل الجرعة كما وردت في الوصفة.`);
    if (item.dose.length > 120) errors.push(`${prefix}: الجرعة تتجاوز 120 حرفًا.`);
    if (!Number.isInteger(item.timesPerDay) || item.timesPerDay < 1 || item.timesPerDay > 6) {
      errors.push(`${prefix}: عدد مرات التناول يجب أن يكون عددًا صحيحًا بين 1 و6.`);
    }
    if (item.timings.length !== item.timesPerDay || item.timings.some((timing) => !timing.label.trim() || timing.label.length > 80)) {
      errors.push(`${prefix}: راجع مواعيد التناول.`);
    }
    if ((item.foodInteractionNote?.length ?? 0) > 500 || (item.coachNotes?.length ?? 0) > 500) {
      errors.push(`${prefix}: الملاحظات تتجاوز 500 حرف.`);
    }
  });

  return [...new Set(errors)];
}

export function clonePatientPlan(plan: PlanConfig): PlanConfig {
  const copy = JSON.parse(JSON.stringify(plan)) as PlanConfig;
  copy.meals = (Array.isArray(copy.meals) ? copy.meals : []).map((meal, index) => ({
    ...meal,
    id: typeof meal.id === 'string' && meal.id ? meal.id : 'legacy-meal-' + index,
    name: typeof meal.name === 'string' ? meal.name : '',
    items: typeof meal.items === 'string' ? meal.items : '',
    alternatives: Array.isArray(meal.alternatives) ? meal.alternatives.filter((item): item is string => typeof item === 'string') : [],
    time: typeof meal.time === 'string' ? meal.time : '',
  }));
  copy.checklist = (Array.isArray(copy.checklist) ? copy.checklist : []).map((item, index) => ({
    ...item,
    id: typeof item.id === 'string' && item.id ? item.id : 'legacy-check-' + index,
    label: typeof item.label === 'string' ? item.label : '',
  }));
  copy.supplements = (Array.isArray(copy.supplements) ? copy.supplements : []).map((item, index) => ({
    ...item,
    id: typeof item.id === 'string' && item.id ? item.id : 'legacy-supplement-' + index,
    name: typeof item.name === 'string' ? item.name : '',
  }));
  if (copy.medicationPlan) {
    copy.medicationPlan = {
      ...copy.medicationPlan,
      items: (Array.isArray(copy.medicationPlan.items) ? copy.medicationPlan.items : []).map((item, index) => ({
        ...item,
        id: typeof item.id === 'string' && item.id ? item.id : 'legacy-medication-' + index,
        name: typeof item.name === 'string' ? item.name : '',
        dose: typeof item.dose === 'string' ? item.dose : '',
        timesPerDay: Number.isInteger(item.timesPerDay) ? item.timesPerDay : 1,
        timings: Array.isArray(item.timings) ? item.timings : [],
        active: item.active !== false,
      })),
    };
  }
  return copy;
}
