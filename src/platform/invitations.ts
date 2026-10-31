// ============================================================================
// دعوات المنصة — المرحلة الثانية من بناء المنصة
// ----------------------------------------------------------------------------
// - لا تسجيل ذاتي مفتوح أبدًا: الحساب يُنشأ فقط بدعوة صادرة من طاقم العيادة.
// - تصميم معرّف الدعوة: البريد نفسه بعد التطبيع (صغير الحروف ومقصوص
//   الأطراف) هو المفتاح الأساسي في جدول invitations. التسجيل يجب أن يتم
//   بالبريد المدعو به بالظبط (بعد التطبيع).
// - الدعوة تُستهلك بانتقال حالتها pending → consumed، ولا يمكن إعادة
//   استخدامها. إعادة الدعوة لنفس البريد يسمح بها طاقم العيادة فقط عبر
//   إعادة الحالة consumed → pending.
// - دخول Google عند إنشاء الحساب للطاقم فقط (قرار مسجل): دعوة بدور مريض
//   لا تُقبل عبر Google، بل بالبريد وكلمة المرور فقط. الدور يأتي من
//   الدعوة حصرًا، لا من زر الدخول.
// - التسجيل بالدعوة ينشئ سجل المريض أيضًا (لدور المريض فقط): قائمة لوحة
//   الطاقم تقرأ من جدول patients لا من profiles، فبدون سجل المريض لا
//   يظهر المدعو في القائمة أبدًا. الترتيب: الملف أولًا، ثم سجل المريض،
//   ثم استهلاك الدعوة.
// - لا توجد أي قيم حقيقية هنا: البريد والدور والعيادة تأتي من مدخلات
//   الطاقم/المدعو وقت التشغيل فقط.
// - ترحيل 2026-10-31: Firebase Auth/Firestore ← Supabase Auth/Postgres
// ============================================================================

import { getSupabase } from './supabase';
import { ensurePatientDoc, type PlatformRole } from './firestore';

export type InvitationStatus = 'pending' | 'consumed';

export interface Invitation {
  email: string;
  role: PlatformRole;
  clinicId: string;
  createdBy: string;
  status: InvitationStatus;
  createdAt?: string;
}

const PLATFORM_ROLES: ReadonlySet<string> = new Set([
  'patient',
  'coach',
  'admin',
]);

// تطبيع البريد لمعرّف الدعوة: قصّ الأطراف + حروف صغيرة.
export function invitationIdForEmail(email: string): string {
  return email.trim().toLowerCase();
}

// تحقق خالص (قابل للاختبار بلا شبكة) من شكل صف الدعوة.
export function parseInvitation(data: unknown): Invitation | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  // يدعم snake_case (Supabase) وcamelCase (قديم) معًا
  const email = record.email;
  const role = record.role;
  const clinicId = record.clinicId ?? record.clinic_id;
  const createdBy = record.createdBy ?? record.created_by;
  const status = record.status;
  if (typeof email !== 'string' || email.trim().length === 0) return null;
  if (typeof role !== 'string' || !PLATFORM_ROLES.has(role)) return null;
  if (typeof clinicId !== 'string' || clinicId.length === 0) return null;
  if (typeof createdBy !== 'string' || createdBy.length === 0) return null;
  if (status !== 'pending' && status !== 'consumed') return null;
  return {
    email,
    role: role as PlatformRole,
    clinicId,
    createdBy,
    status,
  };
}

// تحقق خالص: هل هذه الدعوة صالحة لهذا المستخدم تحديدًا؟ غير المستهلكة
// فقط، وبنفس البريد (بعد التطبيع) والدور والعيادة.
export function validateInvitationForUser(
  invitation: Invitation,
  expected: { email: string; role: PlatformRole; clinicId: string },
): boolean {
  if (invitation.status !== 'pending') return false;
  if (invitationIdForEmail(invitation.email) !== invitationIdForEmail(expected.email)) {
    return false;
  }
  if (invitation.role !== expected.role) return false;
  if (invitation.clinicId !== expected.clinicId) return false;
  return true;
}

export async function getInvitation(email: string): Promise<Invitation | null> {
  const { data, error } = await getSupabase()
    .from('invitations')
    .select()
    .eq('email', invitationIdForEmail(email))
    .single();
  if (error || !data) return null;
  return parseInvitation(data);
}

// ينشئها طاقم العيادة لعيادته فقط (تفرضه سياسات RLS: clinic_id == عيادة
// المنشئ، ودور المريض فقط للطبيب، وأي دور للأدمن).
export async function createInvitation(input: {
  email: string;
  role: PlatformRole;
  clinicId: string;
  createdBy: string;
}): Promise<string> {
  const id = invitationIdForEmail(input.email);
  const { error } = await getSupabase().from('invitations').upsert(
    {
      email: id,
      role: input.role,
      clinic_id: input.clinicId,
      created_by: input.createdBy,
      status: 'pending',
    },
    { onConflict: 'email' },
  );
  if (error) throw new Error(error.message);
  return id;
}

export async function consumeInvitation(email: string): Promise<void> {
  const { error } = await getSupabase()
    .from('invitations')
    .update({ status: 'consumed' })
    .eq('email', invitationIdForEmail(email));
  if (error) throw new Error(error.message);
}

// إعادة دعوة: طاقم العيادة يعيد دعوة مستهلكة إلى pending.
export async function reopenInvitation(email: string): Promise<void> {
  const { error } = await getSupabase()
    .from('invitations')
    .update({ status: 'pending' })
    .eq('email', invitationIdForEmail(email));
  if (error) throw new Error(error.message);
}

// ينشئ ملف المستخدم من دعوة صالحة بعد المصادقة.
async function createUserProfileFromInvitation(
  uid: string,
  invitation: Invitation,
  displayName: string | null,
  email: string,
): Promise<void> {
  const { error } = await getSupabase().from('profiles').upsert(
    {
      id: uid,
      role: invitation.role,
      clinic_id: invitation.clinicId,
      display_name: displayName,
      email,
      disabled: false,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(error.message);
}

// تسجيل مدعو بالبريد وكلمة المرور. يجب أن يكون البريد المُدخل هو البريد
// المدعو به (بعد التطبيع).
export async function registerWithInvitation(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ uid: string; invitation: Invitation }> {
  const email = invitationIdForEmail(input.email);
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password: input.password,
    options: { data: { display_name: input.displayName } },
  });
  if (error) throw new Error(error.message);
  const uid = data.user?.id;
  if (!uid) throw new Error('تعذّر إنشاء الحساب');
  const invitation = await getInvitation(email);
  if (!invitation) {
    throw new Error('لا توجد دعوة مطابقة لهذا البريد — تواصل مع أدمن عيادتك.');
  }
  // الدور والعيادة من الدعوة نفسها؛ أي تلاعب بهما سترفضه سياسات RLS.
  await createUserProfileFromInvitation(
    uid,
    invitation,
    input.displayName,
    email,
  );
  // سجل المريض (لدور المريض فقط): بدونه لا يظهر المدعو في قائمة لوحة
  // الطاقم أبدًا، لأن القائمة تقرأ من جدول patients لا من profiles.
  if (invitation.role === 'patient') {
    await ensurePatientDoc(
      uid,
      invitation.clinicId,
      input.displayName,
      invitation.createdBy,
    );
  }
  await consumeInvitation(email);
  return { uid, invitation };
}

// إنشاء حساب طاقم عبر Google: بعد الدخول، تُقرأ الدعوة ويُتحقق منها.
// دعوة بدور مريض تُرفض هنا (Google للطاقم فقط حسب القرار المسجل).
export async function registerStaffWithGoogleInvitation(): Promise<{
  uid: string;
  invitation: Invitation;
}> {
  const sb = getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/platform' },
  });
  if (error) throw new Error(error.message);
  // بعد العودة من Google، الجلسة تُقرأ من onAuthStateChange في auth.tsx؛
  // إكمال التسجيل (الملف + استهلاك الدعوة) يتم عند أول تحميل للملف.
  // هذه الدالة تُستخدم بعد اكتمال الـ OAuth callback:
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) {
    throw new Error('حساب Google بلا بريد — لا يمكن إتمام التسجيل بالدعوة.');
  }
  const email = invitationIdForEmail(user.email);
  const invitation = await getInvitation(email);
  if (!invitation) {
    throw new Error('لا توجد دعوة مطابقة لهذا البريد — تواصل مع أدمن عيادتك.');
  }
  if (invitation.role === 'patient') {
    throw new Error(
      'دعوات المرضى بالبريد وكلمة المرور فقط — دخول Google للطاقم فقط.',
    );
  }
  await createUserProfileFromInvitation(
    user.id,
    invitation,
    (user.user_metadata?.full_name as string) ??
      (user.user_metadata?.name as string) ??
      null,
    email,
  );
  await consumeInvitation(email);
  return { uid: user.id, invitation };
}
