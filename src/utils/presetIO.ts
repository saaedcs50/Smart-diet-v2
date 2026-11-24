import type { PlanPreset } from './planPresets';

// ============================================================================
// Batch 3.1: استيراد/تصدير قوالب الخطط كـ JSON
// التحقق صارم قبل أي تطبيق: قالب تالف/ناقص يُرفض برسالة واضحة ولا يمس الخطة.
// صيغة التصدير: مغلف { kind, version, preset } — والاستيراد يقبل المغلف أو
// القالب الخام مباشرة ليتوافق مع النسخ الاحتياطية اليدوية.
// ============================================================================

export const MAX_PRESET_IMPORT_BYTES = 512 * 1024;

export type PresetValidationResult =
  | { ok: true; preset: PlanPreset }
  | { ok: false; error: string };

const PRESET_CATEGORIES: PlanPreset['category'][] = [
  'medical',
  'weight_loss',
  'fitness',
  'keto',
  'fasting',
  'maintenance',
  'custom',
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function fail(error: string): PresetValidationResult {
  return { ok: false, error };
}

/** يتحقق من بنية قالب خطة كاملة. لا يرمي استثناءات أبدًا. */
export function validatePresetData(raw: unknown): PresetValidationResult {
  if (!isRecord(raw)) {
    return fail('الملف لا يحتوي على قالب صالح: المحتوى ليس كائن JSON.');
  }
  if (typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 120) {
    return fail('القالب مرفوض: المعرّف (id) مطلوب وبحد أقصى 120 حرفًا.');
  }
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100) {
    return fail('القالب مرفوض: الاسم (name) مطلوب وبحد أقصى 100 حرف.');
  }
  if (typeof raw.category !== 'string' || !PRESET_CATEGORIES.includes(raw.category as PlanPreset['category'])) {
    return fail('القالب مرفوض: تصنيف (category) غير معروف.');
  }
  if (raw.description !== undefined && (typeof raw.description !== 'string' || raw.description.length > 2000)) {
    return fail('القالب مرفوض: الوصف أطول من 2000 حرف أو غير صالح.');
  }
  if (raw.summary !== undefined && (typeof raw.summary !== 'string' || raw.summary.length > 500)) {
    return fail('القالب مرفوض: الملخص أطول من 500 حرف أو غير صالح.');
  }

  const topLevelBounds = {
    targetCalories: 10000,
    targetProtein: 1000,
    targetCarbs: 1500,
    targetFats: 1000,
    dailyWaterGoalMl: 10000,
  } as const;
  for (const [key, max] of Object.entries(topLevelBounds)) {
    const value = raw[key];
    if (!isFiniteNumber(value) || value < 0 || value > max) {
      return fail(`القالب مرفوض: حقل (${key}) يجب أن يكون رقمًا بين 0 و${max}.`);
    }
  }
  if (raw.fastingHours !== undefined && (!isFiniteNumber(raw.fastingHours) || raw.fastingHours < 0 || raw.fastingHours > 24)) {
    return fail('القالب مرفوض: ساعات الصيام يجب أن تكون بين 0 و24.');
  }

  if (!isRecord(raw.planData)) {
    return fail('القالب مرفوض: يفتقد بيانات الخطة (planData).');
  }
  const pd = raw.planData as Record<string, unknown>;

  if (!Array.isArray(pd.meals) || pd.meals.length === 0 || pd.meals.length > 40) {
    return fail('القالب مرفوض: عدد الوجبات يجب أن يكون بين 1 و40.');
  }
  for (const [index, meal] of pd.meals.entries()) {
    if (!isRecord(meal)) return fail(`القالب مرفوض: الوجبة ${index + 1} ليست كائنًا صالحًا.`);
    if (typeof meal.id !== 'string' || !meal.id.trim() || meal.id.length > 120) {
      return fail(`القالب مرفوض: معرّف الوجبة ${index + 1} غير صالح.`);
    }
    if (typeof meal.name !== 'string' || !meal.name.trim() || meal.name.length > 100) {
      return fail(`القالب مرفوض: اسم الوجبة ${index + 1} مطلوب وبحد أقصى 100 حرف.`);
    }
    if (typeof meal.items !== 'string' || !meal.items.trim() || meal.items.length > 2500) {
      return fail(`القالب مرفوض: مكونات الوجبة ${index + 1} مطلوبة وبحد أقصى 2500 حرف.`);
    }
    if (meal.alternatives !== undefined) {
      if (
        !Array.isArray(meal.alternatives) ||
        meal.alternatives.length > 20 ||
        meal.alternatives.some((item) => typeof item !== 'string' || !item.trim() || item.length > 200)
      ) {
        return fail(`القالب مرفوض: بدائل الوجبة ${index + 1} غير صالحة أو تتجاوز الحد المسموح.`);
      }
    }
    if (meal.calories !== undefined && (!isFiniteNumber(meal.calories) || meal.calories < 0 || meal.calories > 5000)) {
      return fail(`القالب مرفوض: سعرات الوجبة ${index + 1} يجب أن تكون بين 0 و5000.`);
    }
    if (meal.proteinGrams !== undefined && (!isFiniteNumber(meal.proteinGrams) || meal.proteinGrams < 0 || meal.proteinGrams > 500)) {
      return fail(`القالب مرفوض: بروتين الوجبة ${index + 1} يجب أن يكون بين 0 و500.`);
    }
    if (meal.time !== undefined && (typeof meal.time !== 'string' || (meal.time && !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(meal.time)))) {
      return fail(`القالب مرفوض: وقت الوجبة ${index + 1} غير صالح.`);
    }
  }

  if (pd.dailyWaterGoalMl !== undefined && (!isFiniteNumber(pd.dailyWaterGoalMl) || pd.dailyWaterGoalMl < 250 || pd.dailyWaterGoalMl > 10000)) {
    return fail('القالب مرفوض: هدف الماء اليومي يجب أن يكون بين 250 و10000 مل.');
  }
  for (const [key, max] of Object.entries(topLevelBounds)) {
    if (key === 'dailyWaterGoalMl' || pd[key] === undefined) continue;
    const value = pd[key];
    if (!isFiniteNumber(value) || value < 0 || value > max) {
      return fail(`القالب مرفوض: بيانات الخطة (${key}) غير صالحة.`);
    }
  }

  if (pd.checklist !== undefined) {
    if (!Array.isArray(pd.checklist) || pd.checklist.length > 60 || pd.checklist.some((item) =>
      !isRecord(item) ||
      typeof item.id !== 'string' || !item.id.trim() || item.id.length > 120 ||
      typeof item.label !== 'string' || !item.label.trim() || item.label.length > 160
    )) {
      return fail('القالب مرفوض: قائمة المهام (checklist) غير صالحة أو تتجاوز 60 بندًا.');
    }
  }
  if (pd.supplements !== undefined) {
    if (!Array.isArray(pd.supplements) || pd.supplements.length > 40 || pd.supplements.some((item) =>
      !isRecord(item) ||
      typeof item.id !== 'string' || !item.id.trim() || item.id.length > 120 ||
      typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 ||
      (item.time !== undefined && (typeof item.time !== 'string' || item.time.length > 500)) ||
      (item.notes !== undefined && (typeof item.notes !== 'string' || item.notes.length > 500))
    )) {
      return fail('القالب مرفوض: قائمة المكملات (supplements) غير صالحة أو تتجاوز 40 عنصرًا.');
    }
  }
  if (pd.tips !== undefined) {
    if (!Array.isArray(pd.tips) || pd.tips.length > 30 || pd.tips.some((tip) => typeof tip !== 'string' || tip.length > 1000)) {
      return fail('القالب مرفوض: قائمة النصائح (tips) غير صالحة أو تتجاوز 30 نصيحة.');
    }
  }
  if (pd.symptomsList !== undefined) {
    if (!Array.isArray(pd.symptomsList) || pd.symptomsList.length > 40 || pd.symptomsList.some((item) =>
      !isRecord(item) ||
      typeof item.id !== 'string' || !item.id.trim() || item.id.length > 120 ||
      typeof item.label !== 'string' || !item.label.trim() || item.label.length > 120
    )) {
      return fail('القالب مرفوض: قائمة الأعراض (symptomsList) غير صالحة أو تتجاوز 40 عنصرًا.');
    }
  }
  if (pd.scoreWeights !== undefined) {
    if (!isRecord(pd.scoreWeights)) return fail('القالب مرفوض: أوزان النقاط (scoreWeights) غير صالحة.');
    for (const key of ['checklist', 'water', 'sleep', 'meals'] as const) {
      const value = pd.scoreWeights[key];
      if (!isFiniteNumber(value) || value < 0 || value > 100) {
        return fail(`القالب مرفوض: وزن النقاط (${key}) يجب أن يكون بين 0 و100.`);
      }
    }
  }
  if (pd.visibleSections !== undefined) {
    if (!isRecord(pd.visibleSections) || Object.values(pd.visibleSections).some((value) => typeof value !== 'boolean')) {
      return fail('القالب مرفوض: إعدادات الأقسام (visibleSections) غير صالحة.');
    }
  }
  if (pd.medicalConditions !== undefined && !isRecord(pd.medicalConditions)) {
    return fail('القالب مرفوض: إعدادات الحالة الطبية غير صالحة.');
  }
  if (pd.medicationPlan !== undefined && !isRecord(pd.medicationPlan)) {
    return fail('القالب مرفوض: إعدادات الأدوية غير صالحة.');
  }
  if (pd.fastingPlan !== undefined && !isRecord(pd.fastingPlan)) {
    return fail('القالب مرفوض: إعدادات الصيام غير صالحة.');
  }
  if (raw.scenario !== undefined) {
    if (
      !isRecord(raw.scenario) ||
      typeof raw.scenario.clientGuidance !== 'string' ||
      raw.scenario.clientGuidance.length > 2000 ||
      !Array.isArray(raw.scenario.coachAlerts) ||
      raw.scenario.coachAlerts.length > 30 ||
      raw.scenario.coachAlerts.some((alert) => typeof alert !== 'string' || !alert.trim() || alert.length > 500) ||
      (raw.scenario.cautionLevel !== undefined && !['standard', 'high'].includes(String(raw.scenario.cautionLevel)))
    ) {
      return fail('القالب مرفوض: بيانات السيناريو (scenario) غير صالحة.');
    }
  }

  const clone = JSON.parse(JSON.stringify(raw)) as PlanPreset;
  clone.planData.meals = clone.planData.meals.map((meal) => ({
    ...meal,
    alternatives: meal.alternatives || [],
  }));
  clone.planData.checklist = clone.planData.checklist || [];
  clone.planData.supplements = clone.planData.supplements || [];
  clone.planData.tips = clone.planData.tips || [];
  clone.planData.symptomsList = clone.planData.symptomsList || [];
  if (typeof clone.mealsCount !== 'number') clone.mealsCount = clone.planData.meals.length;
  if (typeof clone.supplementsCount !== 'number') clone.supplementsCount = clone.planData.supplements.length;
  return { ok: true, preset: clone };
}

export interface PresetExportEnvelope {
  kind: 'smart-diet-preset';
  version: 1;
  exportedAt: string;
  preset: PlanPreset;
}

export function serializePreset(preset: PlanPreset): string {
  const envelope: PresetExportEnvelope = {
    kind: 'smart-diet-preset',
    version: 1,
    exportedAt: new Date().toISOString(),
    preset,
  };
  return JSON.stringify(envelope, null, 2);
}

/** يقرأ نص JSON (مغلفًا أو قالبًا خامًا) ويتحقق منه. لا يرمي أبدًا. */
export function parsePresetImport(text: string): PresetValidationResult {
  if (typeof text !== 'string') return fail('تعذّرت قراءة الملف: المحتوى النصي غير صالح.');
  if (new TextEncoder().encode(text).byteLength > MAX_PRESET_IMPORT_BYTES) {
    return fail('حجم ملف القالب يتجاوز الحد المسموح (512 كيلوبايت).');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('تعذّرت قراءة الملف: ليس JSON صالحًا.');
  }
  if (isRecord(parsed) && 'preset' in parsed) {
    if (parsed.kind !== undefined && parsed.kind !== 'smart-diet-preset') {
      return fail('هذا الملف ليس قالب خطة Smart Diet.');
    }
    if (parsed.kind === 'smart-diet-preset' && parsed.version !== 1) {
      return fail('إصدار ملف القالب غير مدعوم. حدّث الملف إلى الإصدار 1.');
    }
    return validatePresetData(parsed.preset);
  }
  return validatePresetData(parsed);
}
