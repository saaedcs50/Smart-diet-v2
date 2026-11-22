export type PatientReflectionVisibility = 'private' | 'shared';

export interface PatientReflectionDraft {
  entryDate: string;
  content: string;
  mood: number | null;
  symptoms: string;
  visibility: PatientReflectionVisibility;
}

export function normalizePatientReflectionDraft(
  input: PatientReflectionDraft,
): PatientReflectionDraft {
  const content = String(input.content ?? '').trim();
  const symptoms = String(input.symptoms ?? '').trim();
  if (content.length > 2000) throw new Error('الملاحظة يجب ألا تزيد عن 2000 حرف.');
  if (symptoms.length > 1000) throw new Error('وصف الأعراض يجب ألا يزيد عن 1000 حرف.');
  if (!content && !symptoms && input.mood == null) {
    throw new Error('أضف ملاحظة أو عرضًا أو تقييمًا للمزاج قبل الحفظ.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) {
    throw new Error('تاريخ اليوميات غير صالح.');
  }
  const parsed = new Date(`${input.entryDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.entryDate) {
    throw new Error('تاريخ اليوميات غير صالح.');
  }
  if (input.mood != null && (!Number.isInteger(input.mood) || input.mood < 1 || input.mood > 5)) {
    throw new Error('تقييم المزاج يجب أن يكون رقمًا من 1 إلى 5.');
  }
  if (input.visibility !== 'private' && input.visibility !== 'shared') {
    throw new Error('اختر خصوصية اليوميات.');
  }
  return {
    entryDate: input.entryDate,
    content,
    mood: input.mood,
    symptoms,
    visibility: input.visibility,
  };
}
