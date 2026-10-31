// ============================================================================
// اشتراك العيادة — طبقة البيانات لصاحب العيادة (المرحلة الرابعة من B2B)
// ----------------------------------------------------------------------------
// - قراءة حالة الاشتراك وبيانات الدفع (مسموح للطاقم حتى لو منتهي)
// - إرسال طلب تفعيل: إلحاق سجل دفع في payments[] (القواعد تسمح للأدمن
//   بالإلحاق فقط، بلا تعديل على السابق)
// ============================================================================

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type FieldValue,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import type {
  ClinicSubscriptionDoc,
  PaymentRecord,
  PlatformPaymentMethods,
  SubscriptionPlan,
} from './firestore';

export type { SubscriptionPlan };
export type { ClinicSubscriptionDoc, PaymentRecord, PlatformPaymentMethods };

export async function getSubscription(
  clinicId: string,
): Promise<ClinicSubscriptionDoc | null> {
  const snap = await getDoc(
    doc(getFirestoreDb(), 'clinicSubscriptions', clinicId),
  );
  return snap.exists() ? (snap.data() as ClinicSubscriptionDoc) : null;
}

export async function getPaymentMethods(): Promise<PlatformPaymentMethods | null> {
  const snap = await getDoc(
    doc(getFirestoreDb(), 'platformConfig', 'paymentMethods'),
  );
  return snap.exists() ? (snap.data() as PlatformPaymentMethods) : null;
}

export interface ActivationRequestInput {
  method: 'instapay' | 'vodafone_cash';
  amount: number;
  reference: string;
  note?: string;
  submittedBy: string;
}

/**
 * إرسال طلب تفعيل: يلحق سجل دفع جديد بلا مراجعة.
 * القواعد ترفض أي تعديل على المدفوعات السابقة أو باقي الحقول.
 */
export async function submitActivationRequest(
  clinicId: string,
  input: ActivationRequestInput,
): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, 'clinicSubscriptions', clinicId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('لا يوجد اشتراك لهذه العيادة');
  const data = snap.data() as ClinicSubscriptionDoc;
  const payments = Array.isArray(data.payments) ? [...data.payments] : [];

  // منع الطلبات المكررة: طلب معلق واحد يكفي
  const hasPending = payments.some((p) => p.reviewedAt == null);
  if (hasPending) throw new Error('لديك طلب تفعيل معلق بالفعل — انتظر المراجعة');

  const reference = input.reference.trim();
  if (!reference) throw new Error('أدخل رقم العملية');
  if (!(input.amount > 0)) throw new Error('أدخل مبلغًا صحيحًا');

  payments.push({
    method: input.method,
    amount: input.amount,
    currency: 'EGP',
    reference,
    submittedAt: serverTimestamp() as FieldValue,
    submittedBy: input.submittedBy,
    reviewedAt: null,
    reviewedBy: null,
    note: (input.note ?? '').trim(),
  } satisfies PaymentRecord);

  await updateDoc(ref, {
    payments,
    updatedAt: serverTimestamp(),
  });
}

/** الأيام المتبقية على الانتهاء (null للدائم أو بلا تاريخ). */
export function daysUntilExpiry(sub: ClinicSubscriptionDoc | null): number | null {
  if (!sub || sub.plan === 'permanent') return null;
  const raw = sub.expiresAt as unknown;
  const toDate = (raw as { toDate?: () => Date })?.toDate;
  if (typeof toDate !== 'function') return null;
  const t = toDate.call(raw);
  if (!(t instanceof Date) || isNaN(t.getTime())) return null;
  return Math.ceil((t.getTime() - Date.now()) / 86400000);
}
