import { buildIntakeDraftPlan, type IntakeAnswers } from '../utils/intake';
import type { PlanConfig } from '../types';
import { SUPPORTED_CONDITIONS } from '../utils/medicalConditions';

export function splitPatientIntakeList(value: string, maxItems = 30): string[] {
  return [...new Set(
    value
      .split(/[,،;؛\n]/)
      .map((item) => item.trim().replace(/\s+/g, ' '))
      .filter(Boolean),
  )].slice(0, maxItems);
}

/**
 * Validate the runtime JSON shape as well as the expected UI limits.
 * Cloud JSON is untrusted input and must not be assumed to match TypeScript.
 */
export function validatePatientIntakeAnswers(answers: IntakeAnswers): string | null {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return 'بيانات الاستبيان غير صالحة.';
  }

  const raw = answers as unknown as Record<string, unknown>;
  const clientName = raw.clientName;
  if (typeof clientName !== 'string' || !clientName.trim() || clientName.trim().length > 100) {
    return 'اسم المريض غير صالح.';
  }

  const numberChecks: Array<{
    key: string;
    label: string;
    min: number;
    max: number;
  }> = [
    { key: 'heightCm', label: 'الطول', min: 60, max: 250 },
    { key: 'startWeight', label: 'الوزن الحالي', min: 20, max: 400 },
    { key: 'targetWeight', label: 'الوزن المستهدف', min: 20, max: 400 },
    { key: 'targetWaist', label: 'محيط الوسط المستهدف', min: 25, max: 250 },
    { key: 'sleepHours', label: 'ساعات النوم', min: 0, max: 24 },
  ];

  for (const check of numberChecks) {
    const value = raw[check.key];
    if (value == null) continue;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < check.min ||
      value > check.max
    ) {
      return `${check.label}: القيمة يجب أن تكون رقمًا بين ${check.min} و${check.max}.`;
    }
  }

  const conditions = raw.conditions;
  if (!Array.isArray(conditions) || conditions.length > 20) {
    return 'قائمة الحالات الصحية غير صالحة أو تتجاوز 20 حالة.';
  }
  for (const [index, condition] of conditions.entries()) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      return `بيانات الحالة الصحية رقم ${index + 1} غير صالحة.`;
    }
    const item = condition as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      item.id.length > 80 ||
      typeof item.label !== 'string' ||
      !item.label.trim() ||
      item.label.length > 120
    ) {
      return `بيانات الحالة الصحية رقم ${index + 1} غير صالحة.`;
    }
    const supported = SUPPORTED_CONDITIONS.find((entry) => entry.id === item.id);
    if (!supported || supported.label !== item.label) {
      return `الحالة الصحية رقم ${index + 1} غير موجودة في قائمة الحالات المعتمدة.`;
    }
  }

  const allergies = raw.allergies;
  if (!Array.isArray(allergies) || allergies.length > 30) {
    return 'قائمة الحساسية غير صالحة أو تتجاوز 30 عنصرًا.';
  }
  if (allergies.some((item) => typeof item !== 'string' || !item.trim() || item.length > 100)) {
    return 'راجع أسماء الحساسية؛ كل عنصر يجب أن يكون نصًا حتى 100 حرف.';
  }

  const medicationsText = raw.medicationsText;
  if (typeof medicationsText !== 'string') return 'نص الأدوية الحالية غير صالح.';
  if (medicationsText.length > 2000) return 'نص الأدوية أطول من المسموح (2000 حرف).';

  const goal = raw.goal ?? '';
  if (typeof goal !== 'string') return 'الهدف المدخل غير صالح.';
  if (goal.length > 500) return 'الهدف أطول من المسموح (500 حرف).';

  const notes = raw.notes ?? '';
  if (typeof notes !== 'string') return 'الملاحظات المدخلة غير صالحة.';
  if (notes.length > 2000) return 'الملاحظات أطول من المسموح (2000 حرف).';

  const activityLevel = raw.activityLevel ?? '';
  if (!['', 'low', 'moderate', 'high'].includes(String(activityLevel))) {
    return 'مستوى النشاط المدخل غير صالح.';
  }

  const fastingType = raw.fastingType ?? 'none';
  if (!['', 'none', 'islamic', 'christian', 'intermittent'].includes(String(fastingType))) {
    return 'نمط الصيام المدخل غير صالح.';
  }

  if (!(
    ['heightCm', 'startWeight', 'targetWeight', 'targetWaist'].some((key) => typeof raw[key] === 'number') ||
    conditions.length > 0 ||
    allergies.length > 0 ||
    medicationsText.trim() ||
    goal.trim() ||
    notes.trim()
  )) {
    return 'أدخل معلومة واحدة على الأقل قبل إرسال الاستبيان.';
  }

  return null;
}

/**
 * Build a structured, unapproved draft from patient-entered answers.
 * Patient-supplied clinical details remain hidden until clinician approval.
 */
export function buildPatientIntakeDraftPlan(
  answers: IntakeAnswers,
  basePlan: PlanConfig,
): PlanConfig {
  const draft = buildIntakeDraftPlan(answers, basePlan);
  draft.adminPin = '';

  if (answers.goal?.trim()) draft.goal = answers.goal.trim();
  if (answers.notes?.trim()) draft.notes = answers.notes.trim();

  const fastingLabels = {
    none: '',
    islamic: 'صيام إسلامي',
    christian: 'صيام مسيحي',
    intermittent: 'صيام متقطع',
  } as const;
  const intakeContext = [
    answers.sleepHours != null ? `النوم المذكور في الاستبيان: ${answers.sleepHours} ساعة يوميًا` : '',
    answers.activityLevel ? `مستوى النشاط المذكور: ${({
      low: 'منخفض',
      moderate: 'متوسط',
      high: 'مرتفع',
    } as const)[answers.activityLevel]}` : '',
    answers.fastingType && fastingLabels[answers.fastingType]
      ? `نمط الصيام المذكور: ${fastingLabels[answers.fastingType]}`
      : '',
  ].filter(Boolean).join(' — ');
  if (intakeContext) {
    draft.notes = [draft.notes?.trim(), intakeContext].filter(Boolean).join(' | ');
  }

  if (draft.medicalConditions) {
    draft.medicalConditions = { ...draft.medicalConditions, showToClient: false };
  }
  if (draft.medicationPlan) {
    draft.medicationPlan = { ...draft.medicationPlan, showToClient: false };
  }
  if (draft.labTracking) {
    draft.labTracking = { ...draft.labTracking, showToClient: false };
  }
  if (draft.cycleTracking) {
    draft.cycleTracking = { ...draft.cycleTracking, showPhaseToClient: false };
  }

  return draft;
}
