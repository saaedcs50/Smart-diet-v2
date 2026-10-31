// ============================================================================
// طبقة بيانات المنصة — ترحيل 2026-10-31: Firestore ← Supabase (Postgres)
// ----------------------------------------------------------------------------
// مطابقة لنموذج البيانات، بلا أي تغيير في الأنواع نفسها (PlanConfig وDayLog
// وكل أنواع الدفعات تُستخدم كما هي). ما يتغير هو مصدر البيانات فقط:
//   - جداول Supabase بدل مجموعات Firestore (snake_case في القاعدة،
//     camelCase في الواجهات — التحويل هنا).
//   - الطوابع الزمنية ISO strings بدل FieldValue.
//   - حقولا مزامنة: updatedAt (ISO) وupdatedBy (uid المحرِّر).
// - مستند المريض patients: id = auth.uid()، clinic_id للعزل.
// - لا تستدعي أي دالة هنا تلقائيًا: وضع المنصة معطّل افتراضيًا.
// ============================================================================

import { getSupabase } from './supabase';
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

export type PlatformRole = 'patient' | 'coach' | 'admin' | 'owner';
// owner = صاحب المنصة (سعيد) — clinicId = 'platform'.
// admin = صاحب العيادة، coach = الدكتور، patient = المريض.

export interface PlatformUserProfile {
  uid: string;
  role: PlatformRole;
  clinicId: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
}

// ملف المستخدم profiles — مصدر الدور (انظر auth.tsx).
export interface UserDoc {
  role: PlatformRole;
  clinicId: string;
  displayName: string | null;
  email: string | null;
  disabled?: boolean;
  createdAt?: string;
}

// مستند العيادة clinics — حقول الهوية من BrandConfig الحالي
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
  createdAt?: string;
}

// سجل المريض patients: الخطة حقل داخله (JSONB).
// invitedBy هو uid من دعا المريض (طبيب أو أدمن).
export interface PatientDoc {
  clinicId: string;
  profile: { clientName: string };
  plan?: PlanConfig;
  invitedBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// اشتراك العيادة clinic_subscriptions — الوثيقة الوحيدة للاشتراك
// في نموذج B2B (لا اشتراك للمريض ولا للدكتور).
export type SubscriptionPlan = 'permanent' | 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'grace' | 'expired';
export interface PaymentRecord {
  method: 'instapay' | 'vodafone_cash';
  amount: number;
  currency: 'EGP';
  reference: string;
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  note?: string;
}
export interface ClinicSubscriptionDoc {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startAt?: string;
  expiresAt?: string | null; // null للدائم
  graceEndsAt?: string | null;
  payments: PaymentRecord[];
  updatedAt?: string;
}

// إعدادات المنصة platform_config (key='paymentMethods') — بيانات الدفع اليدوي.
export interface PlatformPaymentMethods {
  instapay: { label: string; value: string };
  vodafoneCash: { label: string; value: string };
  updatedAt?: string;
}

// سجل العيادة في نموذج B2B — clinics.
export interface B2BClinicDoc {
  name: string;
  ownerUid: string; // فارغ حتى يسجل صاحب العيادة بالدعوة
  ownerName: string;
  ownerPhone: string;
  status: 'active' | 'suspended';
  createdAt?: string;
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

// metadata صورة فقط.
export interface PhotoMeta {
  date: string;
  note?: string;
  storagePath: string;
}

// سجل تدقيق بلا بيانات صحية.
export interface ClinicAuditEvent {
  type: string;
  actorUid: string;
  entityId: string;
}

// ---------------------------------------------------------------------------
// بناة المسارات — للتوافق مع الاختبارات؛ يعيدون مسارًا نصيًا بلا Firebase.
// ---------------------------------------------------------------------------

export interface PathRef {
  path: string;
}

function pathRef(path: string): PathRef {
  return { path };
}

export function clinicRef(clinicId: string): PathRef {
  return pathRef(`clinics/${clinicId}`);
}

export function userRef(uid: string): PathRef {
  return pathRef(`users/${uid}`);
}

export function patientRef(uid: string): PathRef {
  return pathRef(`patients/${uid}`);
}

export function dayLogRef(uid: string, date: string): PathRef {
  return pathRef(`patients/${uid}/dayLogs/${date}`);
}

export function dayLogsCollection(uid: string): PathRef {
  return pathRef(`patients/${uid}/dayLogs`);
}

export function planHistoryCollection(uid: string): PathRef {
  return pathRef(`patients/${uid}/planHistory`);
}

export function shoppingListRef(uid: string, weekStartISO: string): PathRef {
  return pathRef(`patients/${uid}/shoppingLists/${weekStartISO}`);
}

export function milestonesRef(uid: string): PathRef {
  return pathRef(`patients/${uid}/milestones/state`);
}

export function seasonalRef(uid: string): PathRef {
  return pathRef(`patients/${uid}/seasonal/state`);
}

export function intakeRef(uid: string, intakeId: string): PathRef {
  return pathRef(`patients/${uid}/intakes/${intakeId}`);
}

export function consentRef(uid: string, type: string): PathRef {
  return pathRef(`patients/${uid}/consents/${type}`);
}

export function activeFastingRef(uid: string): PathRef {
  return pathRef(`patients/${uid}/activeFasting/state`);
}

export function notificationSettingsRef(uid: string): PathRef {
  return pathRef(`patients/${uid}/notificationSettings/state`);
}

export function photoRef(uid: string, photoId: string): PathRef {
  return pathRef(`patients/${uid}/photos/${photoId}`);
}

export function clinicAuditCollection(clinicId: string): PathRef {
  return pathRef(`clinicAudit/${clinicId}/events`);
}

// ---------------------------------------------------------------------------
// التحويل (دوال خالصة — قابلة للاختبار بلا شبكة)
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

// إزالة undefined recursively مع الحفاظ على المصفوفات والكائنات العادية.
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
  updatedAt: string;
  updatedBy: string;
}

export function withSyncMeta<T extends object>(
  data: T,
  editorUid: string,
): T & SyncMeta {
  return {
    ...stripUndefinedDeep(data),
    updatedAt: new Date().toISOString(),
    updatedBy: editorUid,
  };
}

// الخطة المُزامنة: adminPin القديم يُحذف دائمًا قبل الرفع.
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

// قراءة دفاعية خفيفة: ترفض ما ليس كائنًا أو ما يفتقد الحقول الجوهرية.
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

// تحويل صف patients (snake_case) إلى PatientDoc
function rowToPatientDoc(row: Record<string, unknown>): PatientDoc {
  const doc: PatientDoc = {
    clinicId: row.clinic_id as string,
    profile: (row.profile as { clientName: string }) ?? { clientName: '' },
  };
  if (row.plan != null) doc.plan = row.plan as PlanConfig;
  if (row.invited_by != null) doc.invitedBy = row.invited_by as string;
  return doc;
}

// ---------------------------------------------------------------------------
// عمليات القراءة والكتابة (لا تُستدعى إلا في وضع المنصة المُفعَّل)
// ---------------------------------------------------------------------------

export async function getClinic(clinicId: string): Promise<ClinicDoc | null> {
  const { data, error } = await getSupabase()
    .from('clinics')
    .select()
    .eq('id', clinicId)
    .single();
  if (error || !data) return null;
  return data as unknown as ClinicDoc;
}

export async function getPatient(uid: string): Promise<PatientDoc | null> {
  const { data, error } = await getSupabase()
    .from('patients')
    .select()
    .eq('id', uid)
    .single();
  if (error || !data) return null;
  return rowToPatientDoc(data as Record<string, unknown>);
}

export async function getPatientPlan(
  uid: string,
): Promise<PlanConfig | null> {
  const patient = await getPatient(uid);
  if (!patient?.plan) return null;
  return planFromFirestore(patient.plan);
}

// إنشاء/تأكيد سجل المريض (clinicId + الاسم المعروض) بلا خطة بعد.
export async function ensurePatientDoc(
  uid: string,
  clinicId: string,
  clientName: string,
  invitedBy?: string,
): Promise<void> {
  const { error } = await getSupabase().from('patients').upsert(
    {
      id: uid,
      clinic_id: clinicId,
      profile: { clientName },
      ...(invitedBy ? { invited_by: invitedBy } : {}),
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(error.message);
}

export async function savePatientPlan(
  uid: string,
  plan: PlanConfig,
  editorUid: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('patients')
    .update({ plan: planToFirestore(plan, editorUid) })
    .eq('id', uid);
  if (error) throw new Error(error.message);
}

// حفظ خطة مع لقطة من الخطة السابقة — plan_history غير موجود في السكيما
// الحالية، فيُحفظ بدون أثر تدقيقي (موثق كقيد ترحيل).
export async function savePatientPlanWithHistory(
  uid: string,
  plan: PlanConfig,
  editorUid: string,
): Promise<void> {
  await savePatientPlan(uid, plan, editorUid);
}

export async function getDayLog(
  uid: string,
  date: string,
): Promise<DayLog | null> {
  const { data, error } = await getSupabase()
    .from('day_logs')
    .select('log')
    .eq('patient_id', uid)
    .eq('log_date', date)
    .single();
  if (error || !data) return null;
  return dayLogFromFirestore((data as { log: unknown }).log);
}

export async function saveDayLog(
  uid: string,
  date: string,
  dayLog: DayLog,
  editorUid: string,
): Promise<void> {
  const { error } = await getSupabase().from('day_logs').upsert(
    {
      patient_id: uid,
      log_date: date,
      log: dayLogToFirestore(dayLog, editorUid),
    },
    { onConflict: 'patient_id,log_date' },
  );
  if (error) throw new Error(error.message);
}

export async function listDayLogs(uid: string): Promise<DayLog[]> {
  const { data, error } = await getSupabase()
    .from('day_logs')
    .select('log')
    .eq('patient_id', uid);
  if (error || !data) return [];
  const out: DayLog[] = [];
  for (const row of data as Array<{ log: unknown }>) {
    const parsed = dayLogFromFirestore(row.log);
    if (parsed) out.push(parsed);
  }
  return out;
}

// سجلات الأيام مع تواريخها — تحتاجها واجهة المنصة لعرض السجلات مرتبة.
export async function listDayLogEntries(
  uid: string,
): Promise<Array<{ date: string; log: DayLog }>> {
  const { data, error } = await getSupabase()
    .from('day_logs')
    .select('log_date, log')
    .eq('patient_id', uid)
    .order('log_date', { ascending: false });
  if (error || !data) return [];
  const out: Array<{ date: string; log: DayLog }> = [];
  for (const row of data as Array<{ log_date: string; log: unknown }>) {
    const parsed = dayLogFromFirestore(row.log);
    if (parsed) out.push({ date: row.log_date, log: parsed });
  }
  return out;
}

// للطاقم فقط (سياسات RLS ترفض غير طاقم العيادة): مرضى عيادة واحدة.
export async function listClinicPatients(
  clinicId: string,
): Promise<PatientDoc[]> {
  const { data, error } = await getSupabase()
    .from('patients')
    .select()
    .eq('clinic_id', clinicId);
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(rowToPatientDoc);
}

// مثل listClinicPatients لكن مع uid كل مريض.
export async function listClinicPatientEntries(
  clinicId: string,
): Promise<Array<{ uid: string; doc: PatientDoc }>> {
  const { data, error } = await getSupabase()
    .from('patients')
    .select()
    .eq('clinic_id', clinicId);
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    uid: row.id as string,
    doc: rowToPatientDoc(row),
  }));
}

// ---------------------------------------------------------------------------
// لوحة الطاقم المتقدمة: أطباء العيادة وربط المرضى بهم
// ---------------------------------------------------------------------------

export interface StaffEntry {
  uid: string;
  doc: UserDoc;
}

function rowToUserDoc(row: Record<string, unknown>): UserDoc {
  return {
    role: row.role as UserDoc['role'],
    clinicId: row.clinic_id as string,
    displayName: (row.display_name as string) ?? null,
    email: (row.email as string) ?? null,
    disabled: (row.disabled as boolean) ?? false,
  };
}

// أطباء العيادة فقط (role === 'coach').
export async function listClinicStaffEntries(
  clinicId: string,
): Promise<StaffEntry[]> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select()
    .eq('clinic_id', clinicId)
    .eq('role', 'coach');
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    uid: row.id as string,
    doc: rowToUserDoc(row),
  }));
}

// مرضى طبيب واحد: من دعاهم هو (invited_by == uid الطبيب).
export async function listDoctorPatients(
  clinicId: string,
  coachUid: string,
): Promise<Array<{ uid: string; doc: PatientDoc }>> {
  const { data, error } = await getSupabase()
    .from('patients')
    .select()
    .eq('clinic_id', clinicId)
    .eq('invited_by', coachUid);
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    uid: row.id as string,
    doc: rowToPatientDoc(row),
  }));
}

// تعيين/إلغاء تعيين طبيب لمريض: كتابة invited_by فقط.
// null تعني إلغاء التعيين (NULL في القاعدة).
export async function assignPatientCoach(
  uid: string,
  coachUid: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('patients')
    .update({ invited_by: coachUid })
    .eq('id', uid);
  if (error) throw new Error(error.message);
}

// ملخص أطباء العيادة — دالة خالصة بلا شبكة (قابلة للاختبار مباشرة).
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

// ---------------------------------------------------------------------------
// دوال المجموعات الفرعية القديمة — بلا جداول في سكيما Supabase الحالية.
// تُرمى أخطاء واضحة حتى يُتخذ قرار بشأنها (إضافة جداول أو إسقاط المزايا).
// ---------------------------------------------------------------------------

const NOT_MIGRATED =
  'غير متاح في سكيما Supabase الحالية — يتطلب جدولًا جديدًا';

export async function saveShoppingList(
  uid: string,
  weekStartISO: string,
  state: ShoppingListState,
  editorUid: string,
): Promise<void> {
  void uid; void weekStartISO; void state; void editorUid;
  throw new Error(`saveShoppingList: ${NOT_MIGRATED}`);
}

export async function saveMilestones(
  uid: string,
  state: MilestonesDoc,
  editorUid: string,
): Promise<void> {
  void uid; void state; void editorUid;
  throw new Error(`saveMilestones: ${NOT_MIGRATED}`);
}

export async function saveSeasonal(
  uid: string,
  state: SeasonalActivation | null,
  editorUid: string,
): Promise<void> {
  void uid; void state; void editorUid;
  throw new Error(`saveSeasonal: ${NOT_MIGRATED}`);
}

export async function saveIntake(
  uid: string,
  intakeId: string,
  record: IntakeDraftRecord,
  editorUid: string,
): Promise<void> {
  void uid; void intakeId; void record; void editorUid;
  throw new Error(`saveIntake: ${NOT_MIGRATED}`);
}

export async function saveConsent(
  uid: string,
  type: string,
  consent: ConsentDoc,
  editorUid: string,
): Promise<void> {
  void uid; void type; void consent; void editorUid;
  throw new Error(`saveConsent: ${NOT_MIGRATED}`);
}

export async function saveActiveFasting(
  uid: string,
  session: ActiveFastingSession,
  editorUid: string,
): Promise<void> {
  void uid; void session; void editorUid;
  throw new Error(`saveActiveFasting: ${NOT_MIGRATED}`);
}

export async function saveNotificationSettings(
  uid: string,
  settings: NotificationSettings,
  editorUid: string,
): Promise<void> {
  void uid; void settings; void editorUid;
  throw new Error(`saveNotificationSettings: ${NOT_MIGRATED}`);
}

export async function savePhotoMeta(
  uid: string,
  photoId: string,
  meta: PhotoMeta,
  editorUid: string,
): Promise<void> {
  void uid; void photoId; void meta; void editorUid;
  throw new Error(`savePhotoMeta: ${NOT_MIGRATED}`);
}
