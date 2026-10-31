// ============================================================================
// اشتراك العيادة — طبقة البيانات لصاحب العيادة (المرحلة الرابعة من B2B)
// ----------------------------------------------------------------------------
// - قراءة حالة الاشتراك وبيانات الدفع (مسموح للطاقم حتى لو منتهي)
// - إرسال طلب تفعيل: إلحاق سجل دفع في payments[] (القواعد تسمح للأدمن
//   بالإلحاق فقط، بلا تعديل على السابق)
// - ترحيل 2026-10-31: Firestore ← Supabase (clinic_subscriptions)
// ============================================================================

import { getSupabase } from './supabase';
import type {
  ClinicSubscriptionDoc,
  PaymentRecord,
  PlatformPaymentMethods,
  SubscriptionPlan,
} from './firestore';

export type { SubscriptionPlan };
export type { ClinicSubscriptionDoc, PaymentRecord, PlatformPaymentMethods };

// تحويل صف Supabase (snake_case) إلى ClinicSubscriptionDoc
function rowToSubscription(row: Record<string, unknown>): ClinicSubscriptionDoc {
  return {
    plan: row.plan as SubscriptionPlan,
    status: row.status as ClinicSubscriptionDoc['status'],
    startAt: (row.start_at as string) ?? undefined,
    expiresAt: (row.expires_at as string) ?? null,
    graceEndsAt: (row.grace_ends_at as string) ?? null,
    payments: (row.payments as PaymentRecord[]) ?? [],
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

export async function getSubscription(
  clinicId: string,
): Promise<ClinicSubscriptionDoc | null> {
  const { data, error } = await getSupabase()
    .from('clinic_subscriptions')
    .select()
    .eq('clinic_id', clinicId)
    .single();
  if (error || !data) return null;
  return rowToSubscription(data as Record<string, unknown>);
}

export async function getPaymentMethods(): Promise<PlatformPaymentMethods | null> {
  const { data, error } = await getSupabase()
    .from('platform_config')
    .select('value')
    .eq('key', 'paymentMethods')
    .single();
  if (error || !data) return null;
  return (data as { value: PlatformPaymentMethods }).value ?? null;
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
  const sb = getSupabase();
  const { data, error } = await sb
    .from('clinic_subscriptions')
    .select('payments')
    .eq('clinic_id', clinicId)
    .single();
  if (error || !data) throw new Error('لا يوجد اشتراك لهذه العيادة');
  const payments = Array.isArray((data as { payments: unknown }).payments)
    ? [...((data as { payments: PaymentRecord[] }).payments)]
    : [];

  // منع الطلبات المكررة: طلب معلق واحد يكفي
  const hasPending = payments.some((p) => p.reviewedAt == null);
  if (hasPending) throw new Error('لديك طلب تفعيل معلق بالفعل — انتظر المراجعة');

  const reference = input.reference.trim();
  if (!reference) throw new Error('أدخل رقم العملية');
  if (!(input.amount > 0)) throw new Error('أدخل مبلغًا صحيحًا');

  const now = new Date().toISOString();
  payments.push({
    method: input.method,
    amount: input.amount,
    currency: 'EGP',
    reference,
    submittedAt: now,
    submittedBy: input.submittedBy,
    reviewedAt: null,
    reviewedBy: null,
    note: (input.note ?? '').trim(),
  } satisfies PaymentRecord);

  const { error: updateError } = await sb
    .from('clinic_subscriptions')
    .update({ payments, updated_at: now })
    .eq('clinic_id', clinicId);
  if (updateError) throw new Error(updateError.message);
}

/** الأيام المتبقية على الانتهاء (null للدائم أو بلا تاريخ). */
export function daysUntilExpiry(sub: ClinicSubscriptionDoc | null): number | null {
  if (!sub || sub.plan === 'permanent') return null;
  const raw = sub.expiresAt as unknown;
  // Supabase يعيد ISO string؛ ندعم أيضًا كائن Firestore Timestamp للتوافق
  let t: Date | null = null;
  if (typeof raw === 'string') {
    t = new Date(raw);
  } else {
    const toDate = (raw as { toDate?: () => Date })?.toDate;
    if (typeof toDate === 'function') t = toDate.call(raw);
  }
  if (!(t instanceof Date) || isNaN(t.getTime())) return null;
  return Math.ceil((t.getTime() - Date.now()) / 86400000);
}
