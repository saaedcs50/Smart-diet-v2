// ============================================================================
// نظام الالتزام — طبقة البيانات (المرحلة الخامسة من B2B)
// ----------------------------------------------------------------------------
// - الإعداد: الدكتور المعالج يضبط 4 محاور + وزن لكل محور (المجموع 100)
//   في adherence_configs
// - الدرجات: إدخال 0–100 لكل محور في المتابعة في adherence_scores
// - النسبة = Σ(درجة × وزن) / 100 — محسوبة داخل التطبيق (قرار #8)
// - النطاقات (قرار #9): ممتاز 75–100، متوسط 50–75، ضعيف تحت 50
// - نزول الوزن: رقم/منحنى بلا عتبات ثابتة (تقييم الدكتور لكل حالة)
// - ترحيل 2026-10-31: Firestore ← Supabase
// ============================================================================

import { getSupabase } from './supabase';

export interface AdherenceAxis {
  name: string;
  weight: number; // 0–100، المجموع يجب أن يكون 100
}

export interface AdherenceConfig {
  axes: AdherenceAxis[]; // 4 محاور
  updatedBy: string;
  updatedAt?: string;
}

export interface AdherenceScore {
  date: string; // YYYY-MM-DD
  scores: number[]; // درجة 0–100 لكل محور بالترتيب
  overall: number; // النسبة المحسوبة
  enteredBy: string;
  enteredAt?: string;
  note?: string;
}

export const DEFAULT_AXES: AdherenceAxis[] = [
  { name: 'الوجبات', weight: 30 },
  { name: 'النصائح', weight: 25 },
  { name: 'شرب الماء', weight: 25 },
  { name: 'النشاط', weight: 20 },
];

/** النسبة الموزونة = Σ(درجة × وزن) / 100 */
export function calcOverall(scores: number[], axes: AdherenceAxis[]): number {
  if (axes.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < axes.length; i++) {
    const score = Math.max(0, Math.min(100, scores[i] ?? 0));
    total += score * (axes[i].weight / 100);
  }
  return Math.round(total * 10) / 10;
}

/** نطاق الالتزام حسب القرار #9 */
export function adherenceBand(overall: number): 'excellent' | 'average' | 'weak' {
  if (overall >= 75) return 'excellent';
  if (overall >= 50) return 'average';
  return 'weak';
}

export const BAND_LABELS = {
  excellent: 'ممتاز',
  average: 'متوسط',
  weak: 'ضعيف',
} as const;

export const BAND_COLORS = {
  excellent: 'text-emerald-600',
  average: 'text-amber-600',
  weak: 'text-red-600',
} as const;

export async function getAdherenceConfig(
  patientUid: string,
): Promise<AdherenceConfig | null> {
  const { data, error } = await getSupabase()
    .from('adherence_configs')
    .select('axes, updated_by, updated_at')
    .eq('patient_id', patientUid)
    .single();
  if (error || !data) return null;
  const row = data as { axes: AdherenceAxis[]; updated_by: string; updated_at: string };
  return {
    axes: row.axes,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function saveAdherenceConfig(
  patientUid: string,
  axes: AdherenceAxis[],
  updatedBy: string,
): Promise<void> {
  if (axes.length !== 4) throw new Error('يجب تحديد 4 محاور');
  const names = axes.map((a) => a.name.trim());
  if (names.some((n) => !n)) throw new Error('أدخل اسم كل محور');
  const weights = axes.map((a) => Number(a.weight));
  if (weights.some((w) => !(w > 0))) throw new Error('الوزن يجب أن يكون أكبر من صفر');
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum !== 100) throw new Error(`مجموع الأوزان يجب أن يكون 100 (الحالي: ${sum})`);

  const { error } = await getSupabase()
    .from('adherence_configs')
    .upsert(
      {
        patient_id: patientUid,
        axes: axes.map((a, i) => ({ name: names[i], weight: weights[i] })),
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'patient_id' },
    );
  if (error) throw new Error(error.message);
}

export async function listAdherenceScores(
  patientUid: string,
): Promise<Array<{ id: string; score: AdherenceScore }>> {
  const { data, error } = await getSupabase()
    .from('adherence_scores')
    .select('id, score_date, scores, overall, entered_by, note, created_at')
    .eq('patient_id', patientUid)
    .order('score_date', { ascending: false });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    score: {
      date: row.score_date as string,
      scores: row.scores as number[],
      overall: Number(row.overall),
      enteredBy: row.entered_by as string,
      enteredAt: row.created_at as string,
      note: (row.note as string) ?? '',
    },
  }));
}

export async function addAdherenceScore(
  patientUid: string,
  input: { date: string; scores: number[]; note?: string; enteredBy: string },
  axes: AdherenceAxis[],
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('التاريخ غير صالح');
  if (input.scores.length !== axes.length)
    throw new Error('عدد الدرجات يجب أن يساوي عدد المحاور');
  const scores = input.scores.map((s) => {
    const n = Number(s);
    if (!(n >= 0 && n <= 100)) throw new Error('الدرجة من 0 إلى 100');
    return n;
  });
  const overall = calcOverall(scores, axes);

  const { error } = await getSupabase().from('adherence_scores').insert({
    patient_id: patientUid,
    score_date: input.date,
    scores,
    overall,
    entered_by: input.enteredBy,
    note: (input.note ?? '').trim(),
  });
  if (error) throw new Error(error.message);
}
