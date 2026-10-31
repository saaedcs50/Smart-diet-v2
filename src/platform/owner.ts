// ============================================================================
// عمليات صاحب المنصة (/owner) — المرحلة الثالثة من بناء B2B
// ----------------------------------------------------------------------------
// كل الدوال هنا لصاحب المنصة (role='owner') فقط — القواعد تفرض ذلك.
// تشمل: إدارة العيادات والاشتراكات، مراجعة طلبات التفعيل، دعوة أصحاب
// العيادات، وإعدادات الدفع اليدوي.
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import { createInvitation } from './invitations';
import type {
  B2BClinicDoc,
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
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, 'clinics'));
  const out: ClinicSummary[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Partial<B2BClinicDoc>;
    // نتجاوز مستندات وضع العيادة الواحدة القديم (ليس لها ownerUid نصي)
    if (typeof data.ownerUid !== 'string') continue;
    const subSnap = await getDoc(doc(db, 'clinicSubscriptions', d.id));
    out.push({
      id: d.id,
      name: typeof data.name === 'string' ? data.name : d.id,
      ownerUid: data.ownerUid,
      ownerName: typeof data.ownerName === 'string' ? data.ownerName : '',
      ownerPhone: typeof data.ownerPhone === 'string' ? data.ownerPhone : '',
      status: data.status === 'suspended' ? 'suspended' : 'active',
      subscription: subSnap.exists()
        ? (subSnap.data() as ClinicSubscriptionDoc)
        : null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export async function suspendClinic(clinicId: string): Promise<void> {
  await updateDoc(doc(getFirestoreDb(), 'clinics', clinicId), {
    status: 'suspended',
  });
}

export async function unsuspendClinic(clinicId: string): Promise<void> {
  await updateDoc(doc(getFirestoreDb(), 'clinics', clinicId), {
    status: 'active',
  });
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
  const db = getFirestoreDb();
  const ref = doc(db, 'clinicSubscriptions', input.clinicId);
  const snap = await getDoc(ref);
  const now = new Date();
  const expiresAt = expiryForPlan(input.plan, now);

  let payments: PaymentRecord[] = [];
  if (snap.exists()) {
    const data = snap.data() as Partial<ClinicSubscriptionDoc>;
    if (Array.isArray(data.payments)) payments = [...data.payments];
  }
  if (
    typeof input.paymentIndex === 'number' &&
    payments[input.paymentIndex]
  ) {
    payments[input.paymentIndex] = {
      ...payments[input.paymentIndex],
      reviewedAt: serverTimestamp() as FieldValue,
      reviewedBy: input.reviewedBy,
    };
  }

  await setDoc(
    ref,
    {
      plan: input.plan,
      status: 'active',
      startAt: serverTimestamp(),
      expiresAt,
      graceEndsAt: null,
      payments,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** رفض طلب تفعيل معلق (يُعلَّم كمراجَع مرفوض بملاحظة). */
export async function rejectActivation(input: {
  clinicId: string;
  paymentIndex: number;
  reviewedBy: string;
  note: string;
}): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, 'clinicSubscriptions', input.clinicId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('لا يوجد اشتراك لهذه العيادة');
  const data = snap.data() as ClinicSubscriptionDoc;
  const payments = Array.isArray(data.payments) ? [...data.payments] : [];
  const p = payments[input.paymentIndex];
  if (!p) throw new Error('طلب الدفع غير موجود');
  payments[input.paymentIndex] = {
    ...p,
    reviewedAt: serverTimestamp() as FieldValue,
    reviewedBy: input.reviewedBy,
    note: `مرفوض: ${input.note}`,
  };
  await updateDoc(ref, { payments, updatedAt: serverTimestamp() });
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
 * ينشئ clinics/{id} ثم دعوة admin للبريد — القواعد تسمح لصاحب المنصة بكليهما.
 */
export async function createClinicWithOwner(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  createdBy: string;
}): Promise<string> {
  const db = getFirestoreDb();
  const email = input.ownerEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('بريد غير صالح');
  const clinicId = `clinic-${Date.now().toString(36)}`;

  await setDoc(doc(db, 'clinics', clinicId), {
    name: input.name.trim(),
    ownerUid: '',
    ownerName: input.ownerName.trim(),
    ownerPhone: input.ownerPhone.trim(),
    status: 'active',
    createdAt: serverTimestamp(),
  } satisfies B2BClinicDoc);

  await createInvitation({
    email,
    role: 'admin',
    clinicId,
    createdBy: input.createdBy,
  });

  // اشتراك مبدئي: بلا خطة (يحتاج تفعيلًا بعد الدفع)
  await setDoc(doc(db, 'clinicSubscriptions', clinicId), {
    plan: 'monthly',
    status: 'expired',
    startAt: serverTimestamp(),
    expiresAt: null,
    graceEndsAt: null,
    payments: [],
    updatedAt: serverTimestamp(),
  } satisfies ClinicSubscriptionDoc);

  return clinicId;
}

// --- إعدادات الدفع ------------------------------------------------------------

export async function getPaymentMethods(): Promise<PlatformPaymentMethods | null> {
  const snap = await getDoc(
    doc(getFirestoreDb(), 'platformConfig', 'paymentMethods'),
  );
  return snap.exists() ? (snap.data() as PlatformPaymentMethods) : null;
}

export async function savePaymentMethods(
  methods: Omit<PlatformPaymentMethods, 'updatedAt'>,
): Promise<void> {
  await setDoc(
    doc(getFirestoreDb(), 'platformConfig', 'paymentMethods'),
    { ...methods, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
