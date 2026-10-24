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
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FieldValue,
} from 'firebase/firestore';
import { firestoreDb } from './firebase';
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
export interface PatientDoc {
  clinicId: string;
  profile: { clientName: string };
  plan?: PlanConfig;
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
  return doc(firestoreDb, 'clinics', clinicId);
}

export function userRef(uid: string): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'users', uid);
}

export function patientRef(uid: string): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid);
}

export function dayLogRef(
  uid: string,
  date: string,
): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'dayLogs', date);
}

export function dayLogsCollection(
  uid: string,
): CollectionReference<DocumentData> {
  return collection(firestoreDb, 'patients', uid, 'dayLogs');
}

export function planHistoryCollection(
  uid: string,
): CollectionReference<DocumentData> {
  return collection(firestoreDb, 'patients', uid, 'planHistory');
}

export function shoppingListRef(
  uid: string,
  weekStartISO: string,
): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'shoppingLists', weekStartISO);
}

export function milestonesRef(uid: string): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'milestones', 'state');
}

export function seasonalRef(uid: string): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'seasonal', 'state');
}

export function intakeRef(
  uid: string,
  intakeId: string,
): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'intakes', intakeId);
}

export function consentRef(
  uid: string,
  type: string,
): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'consents', type);
}

export function activeFastingRef(
  uid: string,
): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'activeFasting', 'state');
}

export function notificationSettingsRef(
  uid: string,
): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'notificationSettings', 'state');
}

export function photoRef(
  uid: string,
  photoId: string,
): DocumentReference<DocumentData> {
  return doc(firestoreDb, 'patients', uid, 'photos', photoId);
}

export function clinicAuditCollection(
  clinicId: string,
): CollectionReference<DocumentData> {
  return collection(firestoreDb, 'clinicAudit', clinicId, 'events');
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
export async function ensurePatientDoc(
  uid: string,
  clinicId: string,
  clientName: string,
): Promise<void> {
  await setDoc(
    patientRef(uid),
    { clinicId, profile: { clientName } },
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

// للطاقم فقط (القواعد ترفض غير طاقم العيادة): مرضى عيادة واحدة.
export async function listClinicPatients(
  clinicId: string,
): Promise<PatientDoc[]> {
  const snap = await getDocs(
    query(
      collection(firestoreDb, 'patients'),
      where('clinicId', '==', clinicId),
    ),
  );
  return snap.docs.map((d) => d.data() as PatientDoc);
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
