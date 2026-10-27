// ============================================================================
// طبقة بيانات Firestore — المرحلة الأولى من بناء المنصة
// ----------------------------------------------------------------------------
// مطابقة لنموذج البيانات في دراسة التصميم §٣، بلا أي تغيير في الأنواع
// الحالية نفسها (PlanConfig وDayLog وكل أنواع الدفعات ١–٣ تُستخدم كما هي).
// ما يُضاف هنا فقط هو:
//   - مسارات المستندات والمجموعات الفرعية،
//   - تحويل من/إلى Firestore (إزالة undefined الذي يرفضه Firestore، وحذف
//     حقل adminPin القديم نهائيًا من أي خطة تُزامن — لا يُرفع أي أثر PIN
//     إلى السحابة أبدًا)،
//   - حقولا مزامنة فقط: updatedAt (طابع خادم) وupdatedBy (uid المحرِّر).
// - مستند المريض `patients/{uid}` يحمل `clinicId` نفسه (uid الحساب = uid
//   المريض، بلا معرّف منفصل) حتى تعمل قواعد العزل على مستوى المستند.
// - الصور: metadata فقط هنا؛ رفع الملفات إلى Cloud Storage خطوة لاحقة
//   (لا يوجد رفع Storage في هذه المرحلة).
// - لا تستدعي أي دالة هنا تلقائيًا: وضع المنصة معطّل افتراضيًا
//   (platformMode.ts) ولا يوجد ربط له في App.tsx في هذه المرحلة.
// ============================================================================

import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FieldValue,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import type {
  ActiveFastingSession,
  DayLog,
  PlanConfig,
} from '../types/index';
import type { IntakeDraftRecord } from '../utils/intake';
import type { MilestonesUnlocked } from '../utils/milestones';
import type { NotificationSettings } from '../utils/notifications';
import type { SeasonalActivation } from '../utils/seasonalTemplate';
import type { ShoppingListState } from '../utils/shoppingList';

export type PlatformRole = 'patient' | 'coach' | 'admin';

export interface PlatformUserProfile {
  uid: string;
  role: PlatformRole;
  clinicId: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
}

// مستند سجل الحساب users/{uid} — مصدر الدور في هذه المرحلة (انظر auth.tsx
// لملاحظة التقوية اللاحقة إلى claims).
export interface UserDoc {
  role: PlatformRole;
  clinicId: string;
  displayName: string | null;
  email: string | null;
  disabled?: boolean;
  createdAt?: FieldValue;
}

// مستند العيادة clinics/{clinicId} — حقول الهوية من BrandConfig الحالي
// (clients/white-label.json) + حقولا المنصة الجديدة فقط.
export interface ClinicDoc {
  appName: string;
  shortName: string;
  clinicName: string;
  doctorName: string;
  doctorNameAlt: string;
  specialistTitle: string;
  specialistShort: string;
  specialistTo: string;
  description: string;
  themeColor: string;
  accentColor: string;
  backgroundColor: string;
  whatsapp: string;
  logoPath: string;
  status: 'active' | 'suspended';
  planTier?: string;
  createdAt?: FieldValue;
}

// مستند المريض patients/{uid}: الخطة حقل داخله، والسجلات مجموعات فرعية.
// invitedBy هو uid من دعا المريض (طبيب أو أدمن) — يُخزَّن عند التسجيل
// بالدعوة، ويُستخدم لربط المريض بطبيبه في لوحة الطاقم المتقدمة. غيابه
// يعني أن المريض غير معيّن لطبيب بعد (مرضى تجريبيون قدامى أو مدعوون
// من أدمن).
export interface PatientDoc {
  clinicId: string;
  profile: { clientName: string };
  plan?: PlanConfig;
  invitedBy?: string;
  updatedAt?: FieldValue;
  updatedBy?: string;
}

export interface MilestonesDoc {
  unlocked: MilestonesUnlocked;
  initialized: boolean;
  reportSharedAt: string | null;
}

export interface ConsentDoc {
  text: string;
  grantedAt: string | null;
  revokedAt: string | null;
  version: string;
}

// metadata صورة فقط — الملف نفسه في Cloud Storage (لاحقًا).
export interface PhotoMeta {
  date: string;
  note?: string;
  storagePath: string;
}

// سجل تدقيق بلا بيانات صحية — كتابة خادم فقط حسب القواعد (لا توجد دالة
// كتابة له هنا عمدًا).
export interface ClinicAuditEvent {
  type: string;
  actorUid: string;
  entityId: string;
}

// ---------------------------------------------------------------------------
// بناة المسارات
// ---------------------------------------------------------------------------

export function clinicRef(
  clinicId: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'clinics', clinicId);
}

export function userRef(uid: string): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'users', uid);
}

export function patientRef(uid: string): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid);
}

export function dayLogRef(
  uid: string,
  date: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'dayLogs', date);
}

export function dayLogsCollection(
  uid: string,
): CollectionReference<DocumentData> {
  return collection(getFirestoreDb(), 'patients', uid, 'dayLogs');
}

export function planHistoryCollection(
  uid: string,
): CollectionReference<DocumentData> {
  return collection(getFirestoreDb(), 'patients', uid, 'planHistory');
}

export function shoppingListRef(
  uid: string,
  weekStartISO: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'shoppingLists', weekStartISO);
}

export function milestonesRef(uid: string): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'milestones', 'state');
}

export function seasonalRef(uid: string): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'seasonal', 'state');
}

export function intakeRef(
  uid: string,
  intakeId: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'intakes', intakeId);
}

export function consentRef(
  uid: string,
  type: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'consents', type);
}

export function activeFastingRef(
  uid: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'activeFasting', 'state');
}

export function notificationSettingsRef(
  uid: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'notificationSettings', 'state');
}

export function photoRef(
  uid: string,
  photoId: string,
): DocumentReference<DocumentData> {
  return doc(getFirestoreDb(), 'patients', uid, 'photos', photoId);
}

export function clinicAuditCollection(
  clinicId: string,
): CollectionReference<DocumentData> {
  return collection(getFirestoreDb(), 'clinicAudit', clinicId, 'events');
}

// ---------------------------------------------------------------------------
// التحويل من/إلى Firestore (دوال خالصة — قابلة للاختبار بلا شبكة)
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

// Firestore يرفض undefined في أي موضع: يُحذف recursively مع الحفاظ على
// المصفوفات والكائنات العادية. الطوابع والتواريخ تُمرَّر كما هي.
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) out[key] = stripUndefinedDeep(entry);
    }
    return out as T;
  }
  return value;
}

export interface SyncMeta {
  updatedAt: FieldValue;
  updatedBy: string;
}

export function withSyncMeta<T extends object>(
  data: T,
  editorUid: string,
): T & SyncMeta {
  return {
    ...stripUndefinedDeep(data),
    updatedAt: serverTimestamp(),
    updatedBy: editorUid,
  };
}

// الخطة المُزامنة: adminPin القديم يُحذف دائمًا قبل الرفع (حقل إرثي مُفرَّغ
// عند التحميل محليًا أصلًا، ولا مكان له في السحابة).
export function planToFirestore(
  plan: PlanConfig,
  editorUid: string,
): Omit<PlanConfig, 'adminPin'> & SyncMeta {
  const { adminPin: _adminPin, ...rest } = plan;
  void _adminPin;
  return withSyncMeta(rest, editorUid);
}

export function dayLogToFirestore(
  dayLog: DayLog,
  editorUid: string,
): DayLog & SyncMeta {
  return withSyncMeta(dayLog, editorUid);
}

// قراءة دفاعية خفيفة: ترفض ما ليس كائنًا أو ما يفتقد الحقول الجوهرية،
// وتعيد النوع الحالي كما هو بلا تحويل موازٍ.
export function planFromFirestore(data: unknown): PlanConfig | null {
  if (!isPlainObject(data)) return null;
  if (typeof data.clientName !== 'string') return null;
  if (!Array.isArray(data.meals) || !Array.isArray(data.checklist)) return null;
  return data as unknown as PlanConfig;
}

export function dayLogFromFirestore(data: unknown): DayLog | null {
  if (!isPlainObject(data)) return null;
  if (typeof data.water !== 'number') return null;
  if (!isPlainObject(data.meals) || !isPlainObject(data.meas)) return null;
  return data as unknown as DayLog;
}

// ---------------------------------------------------------------------------
// عمليات القراءة والكتابة (لا تُستدعى إلا في وضع المنصة المُفعَّل)
// ---------------------------------------------------------------------------

export async function getClinic(clinicId: string): Promise<ClinicDoc | null> {
  const snap = await getDoc(clinicRef(clinicId));
  return snap.exists() ? (snap.data() as ClinicDoc) : null;
}

export async function getPatient(uid: string): Promise<PatientDoc | null> {
  const snap = await getDoc(patientRef(uid));
  return snap.exists() ? (snap.data() as PatientDoc) : null;
}

export async function getPatientPlan(
  uid: string,
): Promise<PlanConfig | null> {
  const patient = await getPatient(uid);
  if (!patient?.plan) return null;
  return planFromFirestore(patient.plan);
}

// إنشاء/تأكيد مستند المريض (clinicId + الاسم المعروض) بلا خطة بعد.
// invitedBy اختياري: يُمرَّر عند التسجيل بالدعوة (uid الداعي)، ويُحفظ
// فقط عند توفره — Firestore يرفض undefined، فلا يُكتب الحقل أبدًا بقيمة
// فارغة. ملاحظة: setDoc مع merge لا يمسح invitedBy موجودًا عند غياب
// المعامل (لا يُمرَّر حقل أصلًا)، فتعيين الطبيب يتم عبر assignPatientCoach.
export async function ensurePatientDoc(
  uid: string,
  clinicId: string,
  clientName: string,
  invitedBy?: string,
): Promise<void> {
  await setDoc(
    patientRef(uid),
    {
      clinicId,
      profile: { clientName },
      ...(invitedBy ? { invitedBy } : {}),
    },
    { merge: true },
  );
}

export async function savePatientPlan(
  uid: string,
  plan: PlanConfig,
  editorUid: string,
): Promise<void> {
  await setDoc(
    patientRef(uid),
    { plan: planToFirestore(plan, editorUid) },
    { merge: true },
  );
}

// حفظ خطة مع لقطة من الخطة السابقة في planHistory (أثر تدقيقي، دراسة §٣).
export async function savePatientPlanWithHistory(
  uid: string,
  plan: PlanConfig,
  editorUid: string,
): Promise<void> {
  const previous = await getPatientPlan(uid);
  if (previous) {
    await addDoc(planHistoryCollection(uid), {
      plan: stripUndefinedDeep(previous),
      savedAt: serverTimestamp(),
      savedBy: editorUid,
    });
  }
  await savePatientPlan(uid, plan, editorUid);
}

export async function getDayLog(
  uid: string,
  date: string,
): Promise<DayLog | null> {
  const snap = await getDoc(dayLogRef(uid, date));
  if (!snap.exists()) return null;
  return dayLogFromFirestore(snap.data());
}

// مستند اليوم هو وحدة التعارض (دراسة §٧): يُستبدل كاملًا عند الحفظ.
export async function saveDayLog(
  uid: string,
  date: string,
  dayLog: DayLog,
  editorUid: string,
): Promise<void> {
  await setDoc(dayLogRef(uid, date), dayLogToFirestore(dayLog, editorUid));
}

export async function listDayLogs(uid: string): Promise<DayLog[]> {
  const snap = await getDocs(dayLogsCollection(uid));
  const out: DayLog[] = [];
  for (const d of snap.docs) {
    const parsed = dayLogFromFirestore(d.data());
    if (parsed) out.push(parsed);
  }
  return out;
}

// سجلات الأيام مع تواريخها (معرّف المستند = تاريخ اليوم) — تحتاجها
// واجهة المنصة لعرض السجلات مرتبة، بينما listDayLogs الأصلية تُسقط
// التواريخ.
export async function listDayLogEntries(
  uid: string,
): Promise<Array<{ date: string; log: DayLog }>> {
  const snap = await getDocs(dayLogsCollection(uid));
  const out: Array<{ date: string; log: DayLog }> = [];
  for (const d of snap.docs) {
    const parsed = dayLogFromFirestore(d.data());
    if (parsed) out.push({ date: d.id, log: parsed });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

// للطاقم فقط (القواعد ترفض غير طاقم العيادة): مرضى عيادة واحدة.
export async function listClinicPatients(
  clinicId: string,
): Promise<PatientDoc[]> {
  const snap = await getDocs(
    query(
      collection(getFirestoreDb(), 'patients'),
      where('clinicId', '==', clinicId),
    ),
  );
  return snap.docs.map((d) => d.data() as PatientDoc);
}

// مثل listClinicPatients لكن مع uid كل مريض (معرّف المستند) — تحتاجه
// واجهة المنصة للتنقل إلى صفحة المريض.
export async function listClinicPatientEntries(
  clinicId: string,
): Promise<Array<{ uid: string; doc: PatientDoc }>> {
  const snap = await getDocs(
    query(
      collection(getFirestoreDb(), 'patients'),
      where('clinicId', '==', clinicId),
    ),
  );
  return snap.docs.map((d) => ({ uid: d.id, doc: d.data() as PatientDoc }));
}

// ---------------------------------------------------------------------------
// لوحة الطاقم المتقدمة: أطباء العيادة وربط المرضى بهم (واجهة فقط)
// ---------------------------------------------------------------------------
// تنبيه نطاق صريح: الربط هنا على مستوى الواجهة فقط (حقل invitedBy في
// مستند المريض). قراءة الطاقم على مستوى العيادة تبقى كما هي اليوم —
// طبيب يستطيع فتح صفحة مريض لطبيب آخر برابط مباشر، تمامًا كما اليوم.
// عزل صارم لكل طبيب على مستوى القواعد سيكسر استعلامات المجموعات
// الفرعية، ولم يُنفَّذ عمدًا.

// مدخل طاقم: uid الحساب + مستند المستخدم كما هو.
export interface StaffEntry {
  uid: string;
  doc: UserDoc;
}

// أطباء العيادة فقط (role === 'coach') — الاستعلام على clinicId فقط بلا
// فهرس مركّب، والترشيح للدور يتم هنا بعد القراءة. يعتمد على قاعدة
// قراءة مستخدمي العيادة نفسها التي تعتمد عليها قائمة المرضى.
export async function listClinicStaffEntries(
  clinicId: string,
): Promise<StaffEntry[]> {
  const snap = await getDocs(
    query(
      collection(getFirestoreDb(), 'users'),
      where('clinicId', '==', clinicId),
    ),
  );
  const out: StaffEntry[] = [];
  for (const d of snap.docs) {
    const doc = d.data() as UserDoc;
    if (doc.role === 'coach') out.push({ uid: d.id, doc });
  }
  return out;
}

// مرضى طبيب واحد: من دعاهم هو (invitedBy == uid الطبيب). المدعوون من
// أدمن أو المرضى القدامى بلا invitedBy لا يظهرون هنا — بل في «بلا طبيب».
// تحذير قواعد (درس PR #6 يتكرر هنا): استعلام القائمة يُرفض بقاعدة
// resource.data.clinicId == عيادة القارئ ما لم يُقيَّد الاستعلام نفسه
// على clinicId — استعلام بـ invitedBy وحده مرفوض بـ «Missing or
// insufficient permissions» حتى لو كل النتائج من نفس العيادة، لأن
// القواعد لا تستطيع إثبات ذلك من قيود الاستعلام. لذلك يُقيَّد
// الاستعلام على الحقلين معًا (مساواة فقط، بلا فهرس مركّب).
export async function listDoctorPatients(
  clinicId: string,
  coachUid: string,
): Promise<Array<{ uid: string; doc: PatientDoc }>> {
  const snap = await getDocs(
    query(
      collection(getFirestoreDb(), 'patients'),
      where('clinicId', '==', clinicId),
      where('invitedBy', '==', coachUid),
    ),
  );
  return snap.docs.map((d) => ({ uid: d.id, doc: d.data() as PatientDoc }));
}

// تعيين/إلغاء تعيين طبيب لمريض: كتابة invitedBy فقط — clinicId لا يُمس
// أبدًا، فيبقى التحديث مقبولًا بقواعد الطاقم الحالية بلا أي تغيير فيها.
// null تعني إلغاء التعيين (حذف الحقل بـ deleteField).
export async function assignPatientCoach(
  uid: string,
  coachUid: string | null,
): Promise<void> {
  await updateDoc(
    patientRef(uid),
    coachUid === null
      ? { invitedBy: deleteField() }
      : { invitedBy: coachUid },
  );
}

// ملخص أطباء العيادة — دالة خالصة بلا شبكة (قابلة للاختبار مباشرة).
// المريض يُحسب لطبيب فقط عندما يكون invitedBy مساويًا تمامًا لـ uid
// الطبيب؛ أي مريض آخر — بلا invitedBy، أو مدعو من أدمن/غير طبيب
// بالعيادة — يُحسب «بلا طبيب معيّن». الاسم المعروض: displayName ثم
// البريد ثم «طبيب بلا اسم».
export interface DoctorSummary {
  uid: string;
  displayName: string;
  email: string | null;
  count: number;
}

export function summarizeDoctors(
  coaches: Array<{ uid: string; displayName: string | null; email: string | null }>,
  patients: Array<{ uid: string; invitedBy?: string }>,
): { perDoctor: DoctorSummary[]; unassignedCount: number } {
  const counts = new Map<string, number>();
  for (const coach of coaches) counts.set(coach.uid, 0);
  let unassignedCount = 0;
  for (const patient of patients) {
    if (patient.invitedBy && counts.has(patient.invitedBy)) {
      counts.set(patient.invitedBy, (counts.get(patient.invitedBy) ?? 0) + 1);
    } else {
      unassignedCount += 1;
    }
  }
  const perDoctor = coaches.map((coach) => ({
    uid: coach.uid,
    displayName: coach.displayName ?? coach.email ?? 'طبيب بلا اسم',
    email: coach.email,
    count: counts.get(coach.uid) ?? 0,
  }));
  return { perDoctor, unassignedCount };
}

export async function saveShoppingList(
  uid: string,
  weekStartISO: string,
  state: ShoppingListState,
  editorUid: string,
): Promise<void> {
  await setDoc(
    shoppingListRef(uid, weekStartISO),
    withSyncMeta(state, editorUid),
  );
}

export async function saveMilestones(
  uid: string,
  state: MilestonesDoc,
  editorUid: string,
): Promise<void> {
  await setDoc(milestonesRef(uid), withSyncMeta(state, editorUid));
}

export async function saveSeasonal(
  uid: string,
  state: SeasonalActivation | null,
  editorUid: string,
): Promise<void> {
  await setDoc(
    seasonalRef(uid),
    withSyncMeta({ value: state }, editorUid),
  );
}

export async function saveIntake(
  uid: string,
  intakeId: string,
  record: IntakeDraftRecord,
  editorUid: string,
): Promise<void> {
  await setDoc(intakeRef(uid, intakeId), withSyncMeta(record, editorUid));
}

export async function saveConsent(
  uid: string,
  type: string,
  consent: ConsentDoc,
  editorUid: string,
): Promise<void> {
  await setDoc(consentRef(uid, type), withSyncMeta(consent, editorUid));
}

export async function saveActiveFasting(
  uid: string,
  session: ActiveFastingSession,
  editorUid: string,
): Promise<void> {
  await setDoc(activeFastingRef(uid), withSyncMeta(session, editorUid));
}

export async function saveNotificationSettings(
  uid: string,
  settings: NotificationSettings,
  editorUid: string,
): Promise<void> {
  await setDoc(
    notificationSettingsRef(uid),
    withSyncMeta(settings, editorUid),
  );
}

export async function savePhotoMeta(
  uid: string,
  photoId: string,
  meta: PhotoMeta,
  editorUid: string,
): Promise<void> {
  await setDoc(photoRef(uid, photoId), withSyncMeta(meta, editorUid));
}
