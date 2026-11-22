import type { IntakeAnswers } from '../utils/intake';

export function splitPatientIntakeList(value: string, maxItems = 30): string[] {
  return [...new Set(
    value
      .split(/[,،;؛\n]/)
      .map((item) => item.trim().replace(/\s+/g, ' '))
      .filter(Boolean),
  )].slice(0, maxItems);
}

export function validatePatientIntakeAnswers(answers: IntakeAnswers): string | null {
  const checks: Array<{ label: string; value: number | null | undefined; min: number; max: number }> = [
    { label: 'الطول', value: answers.heightCm, min: 60, max: 250 },
    { label: 'الوزن الحالي', value: answers.startWeight, min: 20, max: 400 },
    { label: 'الوزن المستهدف', value: answers.targetWeight, min: 20, max: 400 },
    { label: 'محيط الوسط المستهدف', value: answers.targetWaist, min: 25, max: 250 },
    { label: 'ساعات النوم', value: answers.sleepHours, min: 0, max: 24 },
  ];

  for (const check of checks) {
    if (check.value == null) continue;
    if (!Number.isFinite(check.value) || check.value < check.min || check.value > check.max) {
      return `${check.label}: القيمة يجب أن تكون بين ${check.min} و${check.max}.`;
    }
  }

  if (!answers.clientName.trim() || answers.clientName.trim().length > 100) {
    return 'اسم المريض غير صالح.';
  }
  if (answers.conditions.length > 20 || answers.allergies.length > 30) {
    return 'عدد الحالات أو الحساسية المدخلة أكبر من المسموح.';
  }
  if (answers.medicationsText.length > 2000) return 'نص الأدوية أطول من المسموح (2000 حرف).';
  if ((answers.goal ?? '').length > 500) return 'الهدف أطول من المسموح (500 حرف).';
  if ((answers.notes ?? '').length > 2000) return 'الملاحظات أطول من المسموح (2000 حرف).';
  if (!(
    answers.heightCm != null ||
    answers.startWeight != null ||
    answers.targetWeight != null ||
    answers.targetWaist != null ||
    answers.conditions.length > 0 ||
    answers.allergies.length > 0 ||
    answers.medicationsText.trim() ||
    answers.goal?.trim() ||
    answers.notes?.trim()
  )) {
    return 'أدخل معلومة واحدة على الأقل قبل إرسال الاستبيان.';
  }
  return null;
}
