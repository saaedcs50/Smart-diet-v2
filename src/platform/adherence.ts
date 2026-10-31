// ============================================================================
// نظام الالتزام — طبقة البيانات (المرحلة الخامسة من B2B)
// ----------------------------------------------------------------------------
// - الإعداد: الدكتور المعالج يضبط 4 محاور + وزن لكل محور (المجموع 100)
//   في patients/{pid}/adherence/config
// - الدرجات: إدخال 0–100 لكل محور في المتابعة
//   في patients/{pid}/adherenceScores/{id}
// - النسبة = Σ(درجة × وزن) / 100 — محسوبة داخل التطبيق (قرار #8)
// - النطاقات (قرار #9): ممتاز 75–100، متوسط 50–75، ضعيف تحت 50
// - نزول الوزن: رقم/منحنى بلا عتبات ثابتة (تقييم الدكتور لكل حالة)
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type FieldValue,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';

export interface AdherenceAxis {
  name: string;
  weight: number; // 0–100، المجموع يجب أن يكون 100
}

export interface AdherenceConfig {
  axes: AdherenceAxis[]; // 4 محاور
  updatedBy: string;
  updatedAt?: FieldValue;
}

export interface AdherenceScore {
  date: string; // YYYY-MM-DD
  scores: number[]; // درجة 0–100 لكل محور بالترتيب
  overall: number; // النسبة المحسوبة
  enteredBy: string;
  enteredAt?: FieldValue;
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
  const snap = await getDoc(
    doc(getFirestoreDb(), 'patients', patientUid, 'adherence', 'config'),
  );
  return snap.exists() ? (snap.data() as AdherenceConfig) : null;
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

  await setDoc(
    doc(getFirestoreDb(), 'patients', patientUid, 'adherence', 'config'),
    {
      axes: axes.map((a, i) => ({ name: names[i], weight: weights[i] })),
      updatedBy,
      updatedAt: serverTimestamp(),
    } satisfies AdherenceConfig,
  );
}

export async function listAdherenceScores(
  patientUid: string,
): Promise<Array<{ id: string; score: AdherenceScore }>> {
  const q = query(
    collection(getFirestoreDb(), 'patients', patientUid, 'adherenceScores'),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, score: d.data() as AdherenceScore }));
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

  const id = `${input.date}-${Date.now().toString(36)}`;
  await setDoc(
    doc(getFirestoreDb(), 'patients', patientUid, 'adherenceScores', id),
    {
      date: input.date,
      scores,
      overall,
      enteredBy: input.enteredBy,
      enteredAt: serverTimestamp(),
      note: (input.note ?? '').trim(),
    } satisfies AdherenceScore,
  );
}
