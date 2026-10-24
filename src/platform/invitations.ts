// ============================================================================
// دعوات المنصة — المرحلة الثانية من بناء المنصة
// ----------------------------------------------------------------------------
// - لا تسجيل ذاتي مفتوح أبدًا: الحساب يُنشأ فقط بدعوة صادرة من طاقم العيادة.
// - تصميم معرّف الدعوة (مفروض من قواعد Firestore): القواعد لا تستطيع
//   الاستعلام عن مجموعة بالبريد، بل تقرأ مستندًا بمسار معروف فقط؛ لذلك
//   معرّف مستند الدعوة هو البريد نفسه بعد التطبيع (صغير الحروف ومقصوص
//   الأطراف). التسجيل يجب أن يتم بالبريد المدعو به بالظبط (بعد التطبيع)
//   حتى يطابق بريد الـ Auth token بريد الدعوة في القواعد.
// - الدعوة تُستهلك بانتقال حالتها pending → consumed، ولا يمكن إعادة
//   استخدامها. إعادة الدعوة لنفس البريد يسمح بها طاقم العيادة فقط عبر
//   إعادة الحالة consumed → pending (انظر firestore.rules).
// - دخول Google عند إنشاء الحساب للطاقم فقط (قرار مسجل): دعوة بدور مريض
//   لا تُقبل عبر Google، بل بالبريد وكلمة المرور فقط. الدور يأتي من
//   الدعوة حصرًا، لا من زر الدخول.
// - لا توجد أي قيم حقيقية هنا: البريد والدور والعيادة تأتي من مدخلات
//   الطاقم/المدعو وقت التشغيل فقط.
// ============================================================================

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb } from './firebase';
import type { PlatformRole } from './firestore';

export type InvitationStatus = 'pending' | 'consumed';

export interface Invitation {
  email: string;
  role: PlatformRole;
  clinicId: string;
  createdBy: string;
  status: InvitationStatus;
  createdAt?: FieldValue | string;
}

const PLATFORM_ROLES: ReadonlySet<string> = new Set([
  'patient',
  'coach',
  'admin',
]);

// تطبيع البريد لمعرّف الدعوة: قصّ الأطراف + حروف صغيرة. القواعد تقارن
// بريد الـ Auth token ببريد الدعوة، لذلك يجب أن يسجّل المدعو بالبريد
// المطبّع نفسه (انظر registerWithInvitation).
export function invitationIdForEmail(email: string): string {
  return email.trim().toLowerCase();
}

// تحقق خالص (قابل للاختبار بلا Firebase) من شكل مستند الدعوة.
export function parseInvitation(data: unknown): Invitation | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const { email, role, clinicId, createdBy, status } = record;
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

export function invitationRef(email: string) {
  return doc(getFirestoreDb(), 'invitations', invitationIdForEmail(email));
}

export async function getInvitation(email: string): Promise<Invitation | null> {
  const snap = await getDoc(invitationRef(email));
  if (!snap.exists()) return null;
  return parseInvitation(snap.data());
}

// ينشئها طاقم العيادة لعيادته فقط (تفرضه القواعد: clinicId == عيادة
// المنشئ، ودور المريض فقط للطبيب، وأي دور للأدمن). كتابة setDoc على
// دعوة مستهلكة موجودة ستُرفض كتحديث (انظر القواعد) — إعادة الدعوة تتم
// عبر إعادة الحالة، لا عبر الكتابة فوقها.
export async function createInvitation(input: {
  email: string;
  role: PlatformRole;
  clinicId: string;
  createdBy: string;
}): Promise<string> {
  const id = invitationIdForEmail(input.email);
  await setDoc(doc(getFirestoreDb(), 'invitations', id), {
    email: id,
    role: input.role,
    clinicId: input.clinicId,
    createdBy: input.createdBy,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function consumeInvitation(email: string): Promise<void> {
  await updateDoc(invitationRef(email), { status: 'consumed' });
}

// إعادة دعوة: طاقم العيادة يعيد دعوة مستهلكة إلى pending (القواعد تسمح
// بذلك للطاقم فقط، مع بقاء باقي الحقول كما هي).
export async function reopenInvitation(email: string): Promise<void> {
  await updateDoc(invitationRef(email), { status: 'pending' });
}

// ينشئ مستند المستخدم من دعوة صالحة بعد المصادقة. القواعد تسمح بالإنشاء
// فقط عند مطابقة دعوة غير مستهلكة لنفس البريد والدور والعيادة.
async function createUserDocFromInvitation(
  uid: string,
  invitation: Invitation,
  displayName: string | null,
  email: string,
): Promise<void> {
  await setDoc(doc(getFirestoreDb(), 'users', uid), {
    role: invitation.role,
    clinicId: invitation.clinicId,
    displayName,
    email,
    disabled: false,
    createdAt: serverTimestamp(),
  });
}

// تسجيل مدعو بالبريد وكلمة المرور. يجب أن يكون البريد المُدخل هو البريد
// المدعو به (بعد التطبيع) حتى تقبل القواعد إنشاء مستند المستخدم.
export async function registerWithInvitation(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ uid: string; invitation: Invitation }> {
  const email = invitationIdForEmail(input.email);
  const credential: UserCredential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    input.password,
  );
  const invitation = await getInvitation(email);
  if (!invitation) {
    throw new Error('لا توجد دعوة مطابقة لهذا البريد — تواصل مع أدمن عيادتك.');
  }
  // الدور والعيادة من الدعوة نفسها؛ أي تلاعب بهما سترفضه القواعد.
  await createUserDocFromInvitation(
    credential.user.uid,
    invitation,
    input.displayName,
    email,
  );
  await consumeInvitation(email);
  return { uid: credential.user.uid, invitation };
}

// إنشاء حساب طاقم عبر Google: بعد الدخول، تُقرأ الدعوة ويُتحقق منها.
// دعوة بدور مريض تُرفض هنا (Google للطاقم فقط حسب القرار المسجل) ولا
// يُنشأ لها مستند مستخدم — على المستخدم تسجيل الخروج واختيار البريد
// وكلمة المرور بدلًا من ذلك.
export async function registerStaffWithGoogleInvitation(): Promise<{
  uid: string;
  invitation: Invitation;
}> {
  const credential = await signInWithPopup(
    getFirebaseAuth(),
    new GoogleAuthProvider(),
  );
  const email = credential.user.email;
  if (!email) {
    throw new Error('حساب Google بلا بريد — لا يمكن إتمام التسجيل بالدعوة.');
  }
  const invitation = await getInvitation(email);
  if (!invitation) {
    throw new Error('لا توجد دعوة مطابقة لهذا البريد — تواصل مع أدمن عيادتك.');
  }
  if (invitation.role === 'patient') {
    throw new Error(
      'دعوات المرضى بالبريد وكلمة المرور فقط — دخول Google للطاقم فقط.',
    );
  }
  await createUserDocFromInvitation(
    credential.user.uid,
    invitation,
    credential.user.displayName,
    invitationIdForEmail(email),
  );
  await consumeInvitation(email);
  return { uid: credential.user.uid, invitation };
}
