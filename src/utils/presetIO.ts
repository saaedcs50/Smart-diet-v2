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
  if (typeof raw.id !== 'string' || !raw.id.trim()) {
    return fail('القالب مرفوض: يفتقد معرّفًا (id).');
  }
  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    return fail('القالب مرفوض: يفتقد اسمًا (name).');
  }
  if (typeof raw.category !== 'string' || !PRESET_CATEGORIES.includes(raw.category as PlanPreset['category'])) {
    return fail('القالب مرفوض: تصنيف (category) غير معروف.');
  }
  for (const key of ['targetCalories', 'targetProtein', 'targetCarbs', 'targetFats', 'dailyWaterGoalMl'] as const) {
    if (!isFiniteNumber(raw[key]) || (raw[key] as number) < 0) {
      return fail(`القالب مرفوض: حقل (${key}) يجب أن يكون رقمًا صالحًا.`);
    }
  }
  if (!isRecord(raw.planData)) {
    return fail('القالب مرفوض: يفتقد بيانات الخطة (planData).');
  }
  const pd = raw.planData as Record<string, unknown>;

  if (!Array.isArray(pd.meals) || pd.meals.length === 0) {
    return fail('القالب مرفوض: الخطة بلا وجبات (planData.meals فارغة أو مفقودة).');
  }
  for (const m of pd.meals) {
    if (!isRecord(m)) return fail('القالب مرفوض: إحدى الوجبات ليست كائنًا صالحًا.');
    if (typeof m.id !== 'string' || !m.id.trim()) return fail('القالب مرفوض: إحدى الوجبات تفتقد معرّفًا.');
    if (typeof m.name !== 'string' || !m.name.trim()) return fail('القالب مرفوض: إحدى الوجبات تفتقد اسمًا.');
    if (typeof m.items !== 'string' || !m.items.trim()) return fail('القالب مرفوض: إحدى الوجبات بلا محتوى (items).');
    if (m.alternatives !== undefined) {
      if (!Array.isArray(m.alternatives) || m.alternatives.some((a) => typeof a !== 'string')) {
        return fail('القالب مرفوض: بدائل إحدى الوجبات ليست قائمة نصوص.');
      }
    }
    if (m.calories !== undefined && !isFiniteNumber(m.calories)) {
      return fail('القالب مرفوض: سعرات إحدى الوجبات ليست رقمًا.');
    }
    if (m.proteinGrams !== undefined && !isFiniteNumber(m.proteinGrams)) {
      return fail('القالب مرفوض: بروتين إحدى الوجبات ليس رقمًا.');
    }
  }

  if (pd.checklist !== undefined) {
    if (!Array.isArray(pd.checklist) || pd.checklist.some((c) => !isRecord(c) || typeof c.id !== 'string' || typeof c.label !== 'string')) {
      return fail('القالب مرفوض: قائمة المهام (checklist) غير صالحة.');
    }
  }
  if (pd.supplements !== undefined) {
    if (!Array.isArray(pd.supplements) || pd.supplements.some((s) => !isRecord(s) || typeof s.id !== 'string' || typeof s.name !== 'string')) {
      return fail('القالب مرفوض: قائمة المكملات (supplements) غير صالحة.');
    }
  }
  if (pd.tips !== undefined) {
    if (!Array.isArray(pd.tips) || pd.tips.some((t) => typeof t !== 'string')) {
      return fail('القالب مرفوض: قائمة النصائح (tips) ليست قائمة نصوص.');
    }
  }
  if (pd.symptomsList !== undefined) {
    if (!Array.isArray(pd.symptomsList) || pd.symptomsList.some((s) => !isRecord(s) || typeof s.id !== 'string' || typeof s.label !== 'string')) {
      return fail('القالب مرفوض: قائمة الأعراض (symptomsList) غير صالحة.');
    }
  }
  if (pd.scoreWeights !== undefined) {
    if (!isRecord(pd.scoreWeights)) return fail('القالب مرفوض: أوزان النقاط (scoreWeights) غير صالحة.');
    for (const k of ['checklist', 'water', 'sleep', 'meals'] as const) {
      if (!isFiniteNumber(pd.scoreWeights[k])) {
        return fail(`القالب مرفوض: وزن النقاط (${k}) ليس رقمًا.`);
      }
    }
  }
  if (pd.visibleSections !== undefined && !isRecord(pd.visibleSections)) {
    return fail('القالب مرفوض: إعدادات الأقسام (visibleSections) غير صالحة.');
  }
  if (raw.scenario !== undefined) {
    if (!isRecord(raw.scenario) || typeof raw.scenario.clientGuidance !== 'string' || !Array.isArray(raw.scenario.coachAlerts)) {
      return fail('القالب مرفوض: بيانات السيناريو (scenario) غير صالحة.');
    }
  }

  // نجاح: نسخة عميقة آمنة مع قيم افتراضية للحقول الاختيارية المطلوبة في النوع
  const clone = JSON.parse(JSON.stringify(raw)) as PlanPreset;
  clone.planData.meals = clone.planData.meals.map((m) => ({ ...m, alternatives: m.alternatives || [] }));
  clone.planData.checklist = clone.planData.checklist || [];
  clone.planData.supplements = clone.planData.supplements || [];
  clone.planData.tips = clone.planData.tips || [];
  clone.planData.symptomsList = clone.planData.symptomsList || [];
  // العدّادات مشتقة: تُملأ فقط إن غابت، حتى يعود القالب مطابقًا كما صُدِّر
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
