// ============================================================================
// عمليات صاحب المنصة (/owner) — المرحلة الثالثة من بناء B2B
// ----------------------------------------------------------------------------
// كل الدوال هنا لصاحب المنصة (role='owner') فقط — سياسات RLS تفرض ذلك.
// تشمل: إدارة العيادات والاشتراكات، مراجعة طلبات التفعيل، دعوة أصحاب
// العيادات، وإعدادات الدفع اليدوي.
// - ترحيل 2026-10-31: Firestore ← Supabase
// ============================================================================

import { getSupabase } from './supabase';
import type {
  ClinicSubscriptionDoc,
  PaymentRecord,
  PlatformPaymentMethods,
  SubscriptionPlan,
} from './firestore';

export interface ClinicSummary {
  id: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  ownerPhone: string;
  status: 'active' | 'suspended';
  subscription: ClinicSubscriptionDoc | null;
}

export interface PendingActivation {
  clinicId: string;
  clinicName: string;
  payment: PaymentRecord;
  paymentIndex: number;
}

// --- العيادات ---------------------------------------------------------------

export async function listAllClinics(): Promise<ClinicSummary[]> {
  const sb = getSupabase();
  const { data: clinics, error } = await sb.from('clinics').select();
  if (error) throw new Error(error.message);

  const rows = (clinics as Array<Record<string, unknown>>) ?? [];
  const clinicIds = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string');

  const subscriptionsByClinic = new Map<string, Record<string, unknown>>();
  if (clinicIds.length > 0) {
    const { data: subscriptions, error: subscriptionError } = await sb
      .from('clinic_subscriptions')
      .select()
      .in('clinic_id', clinicIds);
    if (subscriptionError) throw new Error(subscriptionError.message);
    for (const subscription of (subscriptions as Array<Record<string, unknown>>) ?? []) {
      if (typeof subscription.clinic_id === 'string') {
        subscriptionsByClinic.set(subscription.clinic_id, subscription);
      }
    }
  }

  const out: ClinicSummary[] = [];
  for (const c of rows) {
    const data = c as Partial<Record<string, unknown>>;
    if (typeof data.id !== 'string') continue;
    const subRow = subscriptionsByClinic.get(data.id) ?? null;
    out.push({
      id: data.id,
      name: typeof data.name === 'string' ? data.name : data.id,
      ownerUid: typeof data.owner_uid === 'string' ? data.owner_uid : '',
      ownerName: typeof data.owner_name === 'string' ? data.owner_name : '',
      ownerPhone: typeof data.owner_phone === 'string' ? data.owner_phone : '',
      status: data.status === 'suspended' ? 'suspended' : 'active',
      subscription: subRow
        ? {
            plan: subRow.plan as SubscriptionPlan,
            status: subRow.status as ClinicSubscriptionDoc['status'],
            startAt: (subRow.start_at as string) ?? undefined,
            expiresAt: (subRow.expires_at as string) ?? null,
            graceEndsAt: (subRow.grace_ends_at as string) ?? null,
            payments: (subRow.payments as PaymentRecord[]) ?? [],
            updatedAt: (subRow.updated_at as string) ?? undefined,
          }
        : null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export async function suspendClinic(clinicId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('clinics')
    .update({ status: 'suspended' })
    .eq('id', clinicId);
  if (error) throw new Error(error.message);
}

export async function unsuspendClinic(clinicId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('clinics')
    .update({ status: 'active' })
    .eq('id', clinicId);
  if (error) throw new Error(error.message);
}

// --- الاشتراكات --------------------------------------------------------------

/** يحسب تاريخ الانتهاء من الخطة. الدائم: null (لا ينتهي). */
// SDV2-BUG-001: استخدام addMonthsLocked بدل setMonth لتجنب قفزة نهاية الشهر.
export function expiryForPlan(
  plan: SubscriptionPlan,
  from: Date = new Date(),
): Date | null {
  if (plan === 'permanent') return null;
  return addMonthsLocked(from, plan === 'annual' ? 12 : 1);
}

/**
 * يجمع أشهرًا على تاريخ مع تثبيت اليوم على آخر يوم صالح في الشهر المستهدف.
 * يمنع قفزة setMonth (مثل 31 يناير + شهر = 3 مارس بدل 28 فبراير).
 */
export function addMonthsLocked(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * تفعيل اشتراك عيادة (أو تجديده). يعيّن الحالة active ويصفّر السماح.
 * إذا كان هناك طلب دفع معلق (paymentIndex)، يُعلَّم كمراجَع.
 */
export async function activateSubscription(input: {
  clinicId: string;
  plan: SubscriptionPlan;
  paymentIndex?: number;
}): Promise<void> {
  const { error } = await getSupabase().rpc('owner_review_clinic_payment', {
    p_clinic_id: input.clinicId,
    p_action: 'activate',
    p_plan: input.plan,
    p_payment_index: input.paymentIndex ?? null,
    p_note: null,
  });
  if (error) throw new Error(error.message);
}

/** رفض طلب تفعيل معلق (يُعلَّم كمراجَع مرفوض بملاحظة). */
export async function rejectActivation(input: {
  clinicId: string;
  paymentIndex: number;
  note: string;
}): Promise<void> {
  const { error } = await getSupabase().rpc('owner_review_clinic_payment', {
    p_clinic_id: input.clinicId,
    p_action: 'reject',
    p_plan: null,
    p_payment_index: input.paymentIndex,
    p_note: input.note,
  });
  if (error) throw new Error(error.message);
}

/** طلبات التفعيل المعلقة: مدفوعات بلا مراجعة في كل العيادات. */
export async function listPendingActivations(): Promise<PendingActivation[]> {
  const clinics = await listAllClinics();
  const out: PendingActivation[] = [];
  for (const c of clinics) {
    const payments = c.subscription?.payments ?? [];
    payments.forEach((p, i) => {
      if (p.reviewedAt == null) {
        out.push({
          clinicId: c.id,
          clinicName: c.name,
          payment: p,
          paymentIndex: i,
        });
      }
    });
  }
  return out;
}

// --- عيادة جديدة ------------------------------------------------------------

/**
 * إنشاء عيادة جديدة ودعوة صاحبها.
 */
export async function createClinicWithOwner(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('owner_create_clinic_with_owner', {
    p_name: input.name,
    p_owner_name: input.ownerName,
    p_owner_email: input.ownerEmail,
    p_owner_phone: input.ownerPhone,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string' || !data.startsWith('clinic-')) {
    throw new Error('لم يُرجع الخادم معرف عيادة صالحًا');
  }
  return data;
}

// --- إعدادات الدفع ------------------------------------------------------------

export async function getPaymentMethods(): Promise<PlatformPaymentMethods | null> {
  const { data, error } = await getSupabase()
    .from('platform_config')
    .select('value')
    .eq('key', 'paymentMethods')
    .single();
  if (error || !data) return null;
  return (data as { value: PlatformPaymentMethods }).value ?? null;
}

export async function savePaymentMethods(
  methods: Omit<PlatformPaymentMethods, 'updatedAt'>,
): Promise<void> {
  const { error } = await getSupabase().from('platform_config').upsert(
    {
      key: 'paymentMethods',
      // SDV2-P1-3: وسم علني صريح — سياسة config_read_public تتطلب (value->>'public') = 'true'
      // حتى يتمكن طاقم العيادة من قراءة طرق الدفع دون كشف الإعدادات الخاصة.
      value: { ...methods, public: 'true', updatedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw new Error(error.message);
}

/**
 * ربط UID المالك بالعيادة بعد إتمام تسجيله عبر الدعوة.
 * SDV2-OWNER-001: يصلح مشكلة owner_uid الفارغ الدائم.
 * يُستدعى بعد نجاح تسجيل المالك المدعو.
 */
export async function linkClinicOwner(
  clinicId: string,
  ownerUid: string,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('clinics')
    .update({ owner_uid: ownerUid })
    .eq('id', clinicId)
    .eq('owner_uid', '');
  if (error) throw new Error(error.message);
}
