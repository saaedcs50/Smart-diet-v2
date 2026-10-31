// ============================================================================
// عمليات صاحب المنصة (/owner) — المرحلة الثالثة من بناء B2B
// ----------------------------------------------------------------------------
// كل الدوال هنا لصاحب المنصة (role='owner') فقط — سياسات RLS تفرض ذلك.
// تشمل: إدارة العيادات والاشتراكات، مراجعة طلبات التفعيل، دعوة أصحاب
// العيادات، وإعدادات الدفع اليدوي.
// - ترحيل 2026-10-31: Firestore ← Supabase
// ============================================================================

import { getSupabase } from './supabase';
import { createInvitation } from './invitations';
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
  const out: ClinicSummary[] = [];
  for (const c of (clinics as Array<Record<string, unknown>>) ?? []) {
    const data = c as Partial<Record<string, unknown>>;
    // نتجاوز المستندات بلا ownerUid نصي
    if (typeof data.owner_uid !== 'string') continue;
    const { data: sub } = await sb
      .from('clinic_subscriptions')
      .select()
      .eq('clinic_id', c.id)
      .single();
    const subRow = sub as Record<string, unknown> | null;
    out.push({
      id: c.id as string,
      name: typeof data.name === 'string' ? data.name : (c.id as string),
      ownerUid: data.owner_uid as string,
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
export function expiryForPlan(
  plan: SubscriptionPlan,
  from: Date = new Date(),
): Date | null {
  if (plan === 'permanent') return null;
  const d = new Date(from);
  d.setMonth(d.getMonth() + (plan === 'annual' ? 12 : 1));
  return d;
}

/**
 * تفعيل اشتراك عيادة (أو تجديده). يعيّن الحالة active ويصفّر السماح.
 * إذا كان هناك طلب دفع معلق (paymentIndex)، يُعلَّم كمراجَع.
 */
export async function activateSubscription(input: {
  clinicId: string;
  plan: SubscriptionPlan;
  reviewedBy: string;
  paymentIndex?: number;
}): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb
    .from('clinic_subscriptions')
    .select('payments')
    .eq('clinic_id', input.clinicId)
    .single();
  const now = new Date().toISOString();
  const expiresAt = expiryForPlan(input.plan, new Date());

  let payments: PaymentRecord[] = [];
  if (data) {
    const existing = (data as { payments: unknown }).payments;
    if (Array.isArray(existing)) payments = [...(existing as PaymentRecord[])];
  }
  if (
    typeof input.paymentIndex === 'number' &&
    payments[input.paymentIndex]
  ) {
    payments[input.paymentIndex] = {
      ...payments[input.paymentIndex],
      reviewedAt: now,
      reviewedBy: input.reviewedBy,
    };
  }

  const { error } = await sb.from('clinic_subscriptions').upsert(
    {
      clinic_id: input.clinicId,
      plan: input.plan,
      status: 'active',
      start_at: now,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      grace_ends_at: null,
      payments,
      updated_at: now,
    },
    { onConflict: 'clinic_id' },
  );
  if (error) throw new Error(error.message);
}

/** رفض طلب تفعيل معلق (يُعلَّم كمراجَع مرفوض بملاحظة). */
export async function rejectActivation(input: {
  clinicId: string;
  paymentIndex: number;
  reviewedBy: string;
  note: string;
}): Promise<void> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('clinic_subscriptions')
    .select('payments')
    .eq('clinic_id', input.clinicId)
    .single();
  if (error || !data) throw new Error('لا يوجد اشتراك لهذه العيادة');
  const existing = (data as { payments: unknown }).payments;
  const payments = Array.isArray(existing)
    ? [...(existing as PaymentRecord[])]
    : [];
  const p = payments[input.paymentIndex];
  if (!p) throw new Error('طلب الدفع غير موجود');
  const now = new Date().toISOString();
  payments[input.paymentIndex] = {
    ...p,
    reviewedAt: now,
    reviewedBy: input.reviewedBy,
    note: `مرفوض: ${input.note}`,
  };
  const { error: updateError } = await sb
    .from('clinic_subscriptions')
    .update({ payments, updated_at: now })
    .eq('clinic_id', input.clinicId);
  if (updateError) throw new Error(updateError.message);
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
  createdBy: string;
}): Promise<string> {
  const sb = getSupabase();
  const email = input.ownerEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('بريد غير صالح');
  const clinicId = `clinic-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  const { error: clinicError } = await sb.from('clinics').insert({
    id: clinicId,
    name: input.name.trim(),
    owner_uid: '',
    owner_name: input.ownerName.trim(),
    owner_phone: input.ownerPhone.trim(),
    status: 'active',
  });
  if (clinicError) throw new Error(clinicError.message);

  await createInvitation({
    email,
    role: 'admin',
    clinicId,
    createdBy: input.createdBy,
  });

  // اشتراك مبدئي: بلا خطة (يحتاج تفعيلًا بعد الدفع)
  const { error: subError } = await sb.from('clinic_subscriptions').insert({
    clinic_id: clinicId,
    plan: 'monthly',
    status: 'expired',
    start_at: now,
    expires_at: null,
    grace_ends_at: null,
    payments: [],
    updated_at: now,
  });
  if (subError) throw new Error(subError.message);

  return clinicId;
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
      value: { ...methods, updatedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw new Error(error.message);
}
