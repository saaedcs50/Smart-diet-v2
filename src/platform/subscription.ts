// ============================================================================
// اشتراك العيادة — طبقة البيانات لصاحب العيادة (المرحلة الرابعة من B2B)
// ----------------------------------------------------------------------------
// - قراءة حالة الاشتراك وبيانات الدفع (مسموح للطاقم حتى لو منتهي)
// - إرسال طلب تفعيل عبر RPC ذرّية؛ لا قراءة/كتابة للمصفوفة من المتصفح
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
  // Patients need the subscription gate state, but must not read payment
  // references or the clinic's full payments JSONB history.
  const { data, error } = await getSupabase()
    .rpc('get_clinic_subscription_gate', { p_clinic_id: clinicId })
    .maybeSingle();
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
  requestId: string;
  method: 'instapay' | 'vodafone_cash';
  amount: number;
  reference: string;
  note?: string;
}

/**
 * يرسل طلب التجديد عبر RPC ذرّية. هوية المرسل تُشتق داخل Postgres من auth.uid().
 * يظل الطلب idempotent عند إعادة المحاولة بنفس requestId.
 */
export async function submitActivationRequest(
  clinicId: string,
  input: ActivationRequestInput,
): Promise<void> {
  if (!input.requestId.trim()) throw new Error('معرّف الطلب غير صالح');

  const { error } = await getSupabase().rpc('submit_clinic_payment_request', {
    p_clinic_id: clinicId,
    p_request_id: input.requestId,
    p_method: input.method,
    p_amount: input.amount,
    p_reference: input.reference,
    p_note: input.note ?? '',
  });
  if (error) throw new Error(error.message);
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
