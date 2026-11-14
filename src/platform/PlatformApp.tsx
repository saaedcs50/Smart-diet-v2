// ============================================================================
// واجهة المنصة — المرحلة الثانية من بناء المنصة
// ----------------------------------------------------------------------------
// - تعمل فقط عندما يكون وضع المنصة مفعّلًا (VITE_PLATFORM_ENABLED=true —
//   يفرضه App.tsx قبل تركيب هذا المكوّن)، وبلا إعدادات Firebase تُعرض
//   رسالة إعداد واضحة بدل انكسار غامض.
// - لا تسجيل ذاتي: التسجيل بدعوة فقط (البريد المدعو به + كلمة مرور)،
//   ودخول Google عند إنشاء الحساب للطاقم فقط (تفرضه invitations.ts).
// - لوحة الطبيب ومدير العيادة تعتمد على Supabase وقواعد RLS.
//   مسار /prototype التجريبي منفصل ولا يُمس.
// - المزامنة opt-in صريح من واجهة المريض نفسه فقط، بعد موافقة صريحة
//   تُحفظ في consents/sync قبل أي رفع (دراسة §٦).
// - الصور السحابية ملغاة بقرار المالك (2026-10-27): لا رفع إلى Cloud
//   Storage ولا عرض صور سحابية؛ الصور تبقى محلية للمستخدم في التطبيق
//   الرئيسي، أو يرسلها المستخدم بنفسه واتساب لطبيب العيادة (سياسة فقط،
//   بلا بناء مشاركة واتساب هنا).
// - لوحة المدير والطبيب تعرض مؤشرات مبنية على صفوف نطاق العيادة
//   أو مرضى الطبيب فقط؛ لا تجمع بيانات سريرية خارج صلاحية العرض.
// ============================================================================

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { PlatformAuthProvider, usePlatformAuth } from './auth';
import { isSupabaseConfigured } from './supabase';
import {
  assignPatientCoach,
  getPatient,
  getPatientPlan,
  listClinicPatientEntries,
  listClinicStaffEntries,
  listDayLogEntries,
  listRecentDayLogActivity,
  listDoctorPatients,
  saveConsent,
  summarizeDoctors,
  type PatientDoc,
  type RecentDayLogActivity,
  type StaffEntry,
} from './firestore';
import {
  createInvitation,
  registerStaffWithGoogleInvitation,
  registerWithInvitation,
} from './invitations';
import {
  SYNC_CONSENT_TEXT,
  SYNC_CONSENT_VERSION,
  loadSyncStatus,
  migrateLocalToCloud,
  readLocalSnapshot,
  saveSyncStatus,
  summarizeSnapshot,
  type SyncReport,
  type SyncStatus,
} from './sync';
import type { DayLog, PlanConfig } from '../types';
import { SubscriptionGate } from './subscription/SubscriptionGate';
import { SubscriptionCard } from './subscription/SubscriptionCard';
import { AdherenceSection } from './adherence/AdherenceSection';
import { registerFcmToken, isFcmConfigured, isPushDeliveryEnabled, notifyPatient } from './fcm';
import { getSupabase } from './supabase';
import { bindLocalDataToPatient, getLocalDataBindingStatus, type LocalDataBindingStatus } from './localDataOwnership';
import { copyLegacyPatientDataToUser } from '../utils/storageKeys';
import { withStorageScope } from '../utils/storageScope';
import { DoctorExportButtons } from './DoctorExportButtons';
import { migrateLegacyPhotosToCurrentUser } from '../utils/indexedDB';
import { summarizePatientDayLog } from './patientDashboardMetrics';
import { PatientProgressCharts } from './PatientProgressCharts';

type Route =
  | { view: 'login' }
  | { view: 'register'; email?: string }
  | { view: 'updatePassword' }
  | { view: 'dashboard' }
  | { view: 'patient'; patientUid: string };

function parseRoute(): Route {
  const pathname = window.location.pathname;
  if (pathname === '/platform/update-password') return { view: 'updatePassword' };
  if (pathname.startsWith('/platform/patients/')) {
    const uid = decodeURIComponent(pathname.split('/')[3] ?? '');
    return { view: 'patient', patientUid: uid };
  }
  if (pathname.startsWith('/platform/register')) {
    const email = new URLSearchParams(window.location.search).get('email');
    return { view: 'register', email: email ?? undefined };
  }
  if (pathname.startsWith('/platform/dashboard')) return { view: 'dashboard' };
  return { view: 'login' };
}

function navigate(path: string): void {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function DashboardMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function RecentActivityCard({
  title,
  activity,
  nameByUid,
  loading,
  error,
  onOpenPatient,
}: {
  title: string;
  activity: RecentDayLogActivity[];
  nameByUid: Map<string, string>;
  loading: boolean;
  error: string | null;
  onOpenPatient: (patientUid: string) => void;
}) {
  return (
    <Card>
      <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">
        أحدث تواريخ السجلات فقط، دون عرض تفاصيل صحية في موجز النشاط.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">جاري تحميل النشاط…</p>
      ) : error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p>
      ) : activity.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">لا توجد سجلات أيام بعد ضمن نطاق العرض.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {activity.map((item, index) => (
            <li key={`${item.patientUid}:${item.date}:${index}`}>
              <button
                type="button"
                onClick={() => onOpenPatient(item.patientUid)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-right hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                    {nameByUid.get(item.patientUid) ?? 'مريض'}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">سجل يوم {item.date}</span>
                </span>
                <span className="shrink-0 text-xs font-bold text-indigo-700 dark:text-indigo-300">فتح الملف</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const buttonClass =
  'rounded-xl bg-peacock-indigo px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const ghostButtonClass =
  'rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200';

// ---------------------------------------------------------------------------
// الدخول
// ---------------------------------------------------------------------------

function LoginForm() {
  const { signInWithEmail, signInWithGoogle } = usePlatformAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResetMessage(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    setResetMessage(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('اكتب بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟».');
      return;
    }
    setBusy(true);
    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: `${window.location.origin}/platform/update-password` },
      );
      if (resetError) throw resetError;
      setResetMessage(
        'لو البريد مرتبط بحساب، هيوصلك رابط استعادة. افتحه من نفس الجهاز، ثم اختَر كلمة مرور جديدة. افحص Spam لو لم تجده.',
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setResetMessage(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
        دخول المنصة
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        حسابات المنصة بدعوة فقط — إن لم تكن لديك دعوة، تواصل مع أدمن عيادتك.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <Field label="البريد الإلكتروني">
          <input
            className={inputClass}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="كلمة المرور">
          <input
            className={inputClass}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}
        {resetMessage && <p role="status" className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{resetMessage}</p>}
        <button className={buttonClass} type="submit" disabled={busy}>
          دخول
        </button>
        <button
          className={ghostButtonClass}
          type="button"
          onClick={() => void resetPassword()}
          disabled={busy}
        >
          نسيت كلمة المرور؟
        </button>
        <button className={ghostButtonClass} type="button" onClick={google} disabled={busy}>
          دخول Google — للطاقم
        </button>
        <button
          className={ghostButtonClass}
          type="button"
          onClick={() => navigate('/platform/register')}
        >
          تسجيل بدعوة
        </button>
      </form>
    </Card>
  );
}

function UpdatePasswordForm() {
  const { user } = usePlatformAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Card>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          رابط الاستعادة غير صالح أو انتهت صلاحيته
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          ارجع لصفحة الدخول واطلب رابط استعادة جديدًا. لا تشارك رابط الاستعادة مع أي شخص.
        </p>
        <button className={buttonClass} type="button" onClick={() => navigate('/platform')}>
          الرجوع لتسجيل الدخول
        </button>
      </Card>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف.');
      return;
    }
    if (password !== confirmPassword) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
        تعيين كلمة مرور جديدة
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        أدخل كلمة مرور جديدة لحسابك. استخدم 8 أحرف على الأقل.
      </p>
      {success ? (
        <div className="mt-4 flex flex-col gap-3">
          <p role="status" className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
            تم تحديث كلمة المرور بنجاح.
          </p>
          <button className={buttonClass} type="button" onClick={() => navigate('/owner')}>
            فتح لوحة صاحب المنصة
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-3">
          <Field label="كلمة المرور الجديدة">
            <input
              className={inputClass}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="تأكيد كلمة المرور">
            <input
              className={inputClass}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
          {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}
          <button className={buttonClass} type="submit" disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور الجديدة'}
          </button>
        </form>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// التسجيل بدعوة
// ---------------------------------------------------------------------------

function RegisterForm({ invitedEmail }: { invitedEmail?: string }) {
  const [email, setEmail] = useState(invitedEmail ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await registerWithInvitation({ email, password, displayName });
      navigate('/platform/dashboard');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      await registerStaffWithGoogleInvitation();
      navigate('/platform/dashboard');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
        تسجيل بدعوة
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        سجّل بالبريد المدعو به بالظبط (حروف صغيرة) — الدور والعيادة يأتيان
        من الدعوة نفسها، ولا يوجد تسجيل ذاتي.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <Field label="البريد المدعو به">
          <input
            className={inputClass}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="الاسم المعروض">
          <input
            className={inputClass}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>
        <Field label="كلمة المرور">
          <input
            className={inputClass}
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        <button className={buttonClass} type="submit" disabled={busy}>
          إنشاء الحساب
        </button>
        <button className={ghostButtonClass} type="button" onClick={google} disabled={busy}>
          إنشاء حساب طاقم عبر Google
        </button>
        <p className="text-xs text-slate-500">
          دعوات المرضى بالبريد وكلمة المرور فقط — زر Google للطاقم فقط،
          ودعوة مريض عبره ستُرفض.
        </p>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// نموذج دعوة (للطاقم)
// ---------------------------------------------------------------------------

function InviteForm({ clinicId, createdBy, isAdmin }: { clinicId: string; createdBy: string; isAdmin: boolean }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'patient' | 'coach' | 'admin'>('patient');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await createInvitation({ email, role, clinicId, createdBy });
      setMessage(`تم إنشاء الدعوة لـ ${email.trim().toLowerCase()} — أبلغ المدعو بالبريد المدعو به بالظبط، فالتسجيل يتم به.`);
      setEmail('');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
        إنشاء دعوة
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        الدعوة لعيادتك فقط. الطبيب يدعو مرضى فقط؛ الأدمن يدعو أي دور.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <Field label="بريد المدعو">
          <input
            className={inputClass}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="الدور">
          <select
            className={inputClass}
            value={role}
            onChange={(event) => setRole(event.target.value as 'patient' | 'coach' | 'admin')}
          >
            <option value="patient">مريض</option>
            {isAdmin && <option value="coach">طبيب/أخصائية</option>}
            {isAdmin && <option value="admin">أدمن</option>}
          </select>
        </Field>
        {message && <p className="text-xs font-bold text-peacock-indigo-dark">{message}</p>}
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        <button className={buttonClass} type="submit" disabled={busy}>
          إنشاء الدعوة
        </button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// قسم المزامنة (واجهة المريض نفسه فقط)
// ---------------------------------------------------------------------------

// SDV2-P1-2: تسميات عربية للأقسام غير المدعومة سحابيًا (تُعرض عند المزامنة الجزئية)
function sectionLabelAr(section: string): string {
  switch (section) {
    case 'activeFasting': return 'الصيام النشط';
    case 'notificationSettings': return 'إعدادات التنبيهات';
    case 'milestones': return 'المعالم';
    case 'seasonal': return 'القالب الموسمي';
    case 'shoppingLists': return 'قوائم التسوق';
    default: return section;
  }
}

const EMPTY_LOCAL_SYNC_SUMMARY = { dayLogCount: 0, shoppingListCount: 0, hasPlan: false, hasActiveFasting: false };

function SyncSection({ patientUid }: { patientUid: string }) {
  const [consent, setConsent] = useState(false);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [photoOwnershipConfirmed, setPhotoOwnershipConfirmed] = useState(false);
  const [localMigrationBusy, setLocalMigrationBusy] = useState(false);
  const [localMigrationMessage, setLocalMigrationMessage] = useState<string | null>(null);
  const [photoMigrationBusy, setPhotoMigrationBusy] = useState(false);
  const [photoMigrationMessage, setPhotoMigrationMessage] = useState<string | null>(null);
  const [bindingStatus, setBindingStatus] = useState<LocalDataBindingStatus>(() =>
    getLocalDataBindingStatus(patientUid),
  );
  const [status, setStatus] = useState<SyncStatus>(() => loadSyncStatus(undefined, patientUid));
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(() => {
    const initialBinding = getLocalDataBindingStatus(patientUid);
    if (['mismatch', 'unavailable'].includes(initialBinding)) return EMPTY_LOCAL_SYNC_SUMMARY;
    try {
      const snapshot = initialBinding === 'unbound'
        ? withStorageScope('local', readLocalSnapshot)
        : readLocalSnapshot();
      return summarizeSnapshot(snapshot);
    } catch {
      return EMPTY_LOCAL_SYNC_SUMMARY;
    }
  });

  useEffect(() => {
    const nextBinding = getLocalDataBindingStatus(patientUid);
    setBindingStatus(nextBinding);
    setOwnershipConfirmed(false);
    setPhotoOwnershipConfirmed(false);
    setLocalMigrationMessage(null);
    setPhotoMigrationMessage(null);
    setConsent(false);
    setStatus(loadSyncStatus(undefined, patientUid));
    setReport(null);
    setError(null);
    if (nextBinding === 'mismatch' || nextBinding === 'unavailable') {
      setSummary(EMPTY_LOCAL_SYNC_SUMMARY);
      return;
    }
    try {
      if (nextBinding === 'matched') {
        // The same account was bound by the previous app version. Move only
        // the approved patient-data keys into this UID namespace, never photos
        // or coach credentials, and never overwrite newer UID-scoped records.
        copyLegacyPatientDataToUser(patientUid);
        setSummary(summarizeSnapshot(readLocalSnapshot()));
      } else {
        // Unbound legacy data is shown for review only; no copy happens until
        // the patient explicitly confirms ownership in the UI.
        setSummary(summarizeSnapshot(withStorageScope('local', readLocalSnapshot)));
      }
    } catch {
      setSummary(EMPTY_LOCAL_SYNC_SUMMARY);
      setError('تعذّر قراءة البيانات المحلية بأمان؛ لم يتم نقل أو رفع أي بيانات.');
    }
  }, [patientUid]);

  const migrateLocalDataToAccount = async () => {
    setError(null);
    const currentBinding = getLocalDataBindingStatus(patientUid);
    if (currentBinding === 'mismatch' || currentBinding === 'unavailable') {
      setError('تعذّر التحقق من ملكية بيانات الجهاز؛ لم يتم نقل أي بيانات.');
      return;
    }
    if (currentBinding === 'unbound' && !ownershipConfirmed) {
      setError('أكّد أولًا أن الخطة والسجلات القديمة تخص الحساب الحالي.');
      return;
    }

    setLocalMigrationBusy(true);
    try {
      if (currentBinding === 'unbound') {
        bindLocalDataToPatient(patientUid);
        setBindingStatus('matched');
      }
      const result = copyLegacyPatientDataToUser(patientUid);
      setSummary(summarizeSnapshot(readLocalSnapshot()));
      setLocalMigrationMessage(
        result.copiedKeys > 0
          ? `تم حفظ ${result.copiedKeys} عنصرًا محليًا في مساحة هذا الحساب. لم تُرفع هذه البيانات إلى السحابة.`
          : 'بيانات الحساب موجودة بالفعل في مساحته المحلية؛ لم تُستبدل أي بيانات.',
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLocalMigrationBusy(false);
    }
  };

  const migratePhotosToAccount = async () => {
    setError(null);
    const currentBinding = getLocalDataBindingStatus(patientUid);
    if (currentBinding === 'mismatch' || currentBinding === 'unavailable') {
      setError('بيانات الجهاز مرتبطة بحساب آخر أو تعذّر التحقق منها؛ لم يتم نقل الصور.');
      return;
    }
    if (currentBinding === 'unbound' && !ownershipConfirmed) {
      setError('أكّد أولًا ملكية بيانات الجهاز قبل نقل الصور.');
      return;
    }
    if (!photoOwnershipConfirmed) {
      setError('أكّد أن صور التقدم القديمة تخص الحساب الحالي قبل نقلها.');
      return;
    }

    setPhotoMigrationBusy(true);
    try {
      if (currentBinding === 'unbound') {
        bindLocalDataToPatient(patientUid);
        setBindingStatus('matched');
        copyLegacyPatientDataToUser(patientUid);
        setSummary(summarizeSnapshot(readLocalSnapshot()));
      }
      const copied = await migrateLegacyPhotosToCurrentUser();
      setPhotoMigrationMessage(
        copied > 0
          ? `تم نسخ ${copied} صورة إلى مساحة هذا الحساب على الجهاز فقط. النسخة الأصلية ما زالت محفوظة ولم تُرفع أي صورة للسحابة.`
          : 'لا توجد صور قديمة لنقلها، أو أن الصور موجودة بالفعل في مساحة هذا الحساب.',
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPhotoMigrationBusy(false);
    }
  };

  const run = async () => {
    setError(null);
    const currentBinding = getLocalDataBindingStatus(patientUid);
    if (currentBinding === 'mismatch') {
      setBindingStatus(currentBinding);
      setError('بيانات هذا الجهاز مرتبطة بحساب آخر؛ لن نرفعها إلى هذا الحساب.');
      return;
    }
    if (currentBinding === 'unavailable') {
      setBindingStatus(currentBinding);
      setError('التخزين المحلي غير متاح؛ تعذّر التحقق من ملكية البيانات.');
      return;
    }
    if (currentBinding === 'unbound' && !ownershipConfirmed) {
      setError('أكّد أولًا أن البيانات المحلية على هذا الجهاز تخص الحساب الحالي.');
      return;
    }
    setBusy(true);
    setStatus({ state: 'syncing', at: null, dayLogCount: 0, planWritten: false, error: null, unsupportedSections: [] });
    try {
      await saveConsent(
        patientUid,
        'sync',
        { text: SYNC_CONSENT_TEXT, grantedAt: new Date().toISOString(), revokedAt: null, version: SYNC_CONSENT_VERSION },
        patientUid,
      );
      if (currentBinding === 'unbound') {
        bindLocalDataToPatient(patientUid);
        setBindingStatus('matched');
      }
      // Idempotent local-only copy. Cloud upload remains separately consented.
      copyLegacyPatientDataToUser(patientUid);
      const snapshot = readLocalSnapshot();
      setSummary(summarizeSnapshot(snapshot));
      const result = await migrateLocalToCloud(snapshot, patientUid, patientUid);
      setReport(result);
      // SDV2-P1-2: لا تُعرض المزامنة «ناجحة» بينما أقسام لم تُرفع — حالة جزئية صريحة.
      const next: SyncStatus = {
        state: result.errors.length > 0 ? 'error' : result.unsupportedSections.length > 0 ? 'partial' : 'success',
        at: new Date().toISOString(),
        dayLogCount: result.dayLogCount,
        planWritten: result.planWritten,
        error: result.errors.length > 0 ? result.errors.join('؛ ') : null,
        unsupportedSections: result.unsupportedSections,
      };
      setStatus(next);
      saveSyncStatus(next, undefined, patientUid);
    } catch (caught) {
      const next: SyncStatus = {
        state: 'error',
        at: new Date().toISOString(),
        dayLogCount: 0,
        planWritten: false,
        error: errorText(caught),
        unsupportedSections: [],
      };
      setStatus(next);
      saveSyncStatus(next, undefined, patientUid);
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
        مزامنة بيانات جهازي
      </h3>
      {bindingStatus === 'mismatch' ? (
        <p className="mt-1 text-xs font-bold text-red-700">
          بيانات هذا الجهاز مرتبطة بحساب آخر. تم إخفاء ملخصها ومنع رفعها إلى الحساب الحالي لحماية الخصوصية.
          استخدم حساب المريض المرتبط بهذه البيانات أو جهازًا/ملف متصفح منفصلًا.
        </p>
      ) : bindingStatus === 'unavailable' ? (
        <p className="mt-1 text-xs font-bold text-red-700">
          تعذّر الوصول الآمن إلى التخزين المحلي؛ أُوقفت المزامنة حتى يمكن التحقق من ملكية البيانات.
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          على هذا الجهاز الآن: خطة {summary.hasPlan ? 'موجودة' : 'غير موجودة'}،{' '}
          {summary.dayLogCount} سجل يومي، {summary.shoppingListCount} قائمة تسوق.
          المزامنة اختيارية ولا تعمل تلقائيًا أبدًا.
        </p>
      )}
      {bindingStatus === 'unbound' && (
        <label className="mt-3 flex items-start gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
          <input
            type="checkbox"
            checked={ownershipConfirmed}
            onChange={(event) => setOwnershipConfirmed(event.target.checked)}
          />
          <span>
            أؤكد أن كل بيانات الخطة والسجلات المحلية على هذا الجهاز تخص الحساب المسجل حاليًا.
            عند التأكيد ستُربط بيانات هذا الجهاز بهذا الحساب، ولن يُسمح لحساب آخر بمزامنتها.
          </span>
        </label>
      )}
      {bindingStatus === 'matched' && (
        <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          تم ربط بيانات هذا الجهاز بالحساب الحالي؛ لن تُرفع إلى حساب آخر.
        </p>
      )}
      {bindingStatus === 'unbound' && ownershipConfirmed && (
        <button
          type="button"
          className={`${ghostButtonClass} mt-3`}
          onClick={() => void migrateLocalDataToAccount()}
          disabled={localMigrationBusy}
        >
          {localMigrationBusy ? 'جارٍ حفظ البيانات محليًا…' : 'حفظ بيانات الجهاز في مساحة حسابي فقط'}
        </button>
      )}
      {localMigrationMessage && (
        <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {localMigrationMessage}
        </p>
      )}
      {bindingStatus !== 'mismatch' && bindingStatus !== 'unavailable' && (
        <>
          <label className="mt-3 flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={photoOwnershipConfirmed}
              onChange={(event) => setPhotoOwnershipConfirmed(event.target.checked)}
            />
            <span>
              أؤكد أن صور التقدم القديمة على هذا الجهاز تخص الحساب الحالي. سيتم نسخها إلى مساحة الحساب المحلية فقط، ولن تُرفع إلى السحابة.
            </span>
          </label>
          {photoOwnershipConfirmed && (
            <button
              type="button"
              className={`${ghostButtonClass} mt-2`}
              onClick={() => void migratePhotosToAccount()}
              disabled={photoMigrationBusy || (bindingStatus === 'unbound' && !ownershipConfirmed)}
            >
              {photoMigrationBusy ? 'جارٍ نقل الصور محليًا…' : 'نقل صور التقدم إلى مساحة هذا الحساب'}
            </button>
          )}
        </>
      )}
      {photoMigrationMessage && (
        <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {photoMigrationMessage}
        </p>
      )}
      <label className="mt-3 flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>{SYNC_CONSENT_TEXT}</span>
      </label>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <button
        className={`${buttonClass} mt-3`}
        onClick={run}
        disabled={busy || !consent || bindingStatus === 'mismatch' || bindingStatus === 'unavailable' || (bindingStatus === 'unbound' && !ownershipConfirmed)}
      >
        مزامنة بيانات جهازي الآن
      </button>
      {status.state !== 'idle' && (
        <p className="mt-2 text-xs text-slate-500">
          آخر حالة: {status.state === 'success' ? 'نجحت' : status.state === 'partial' ? 'نجحت جزئيًا' : status.state === 'syncing' ? 'جارية…' : 'فشلت'}
          {status.at ? ` — ${status.at}` : ''}
          {(status.state === 'success' || status.state === 'partial') ? ` — ${status.dayLogCount} يوم، والخطة ${status.planWritten ? 'رُفعت' : 'كانت موجودة سحابيًا فلم تُستبدل'}.` : ''}
          {status.error ? ` — ${status.error}` : ''}
        </p>
      )}
      {status.state === 'partial' && status.unsupportedSections.length > 0 && (
        <p className="mt-2 text-xs font-bold text-amber-700">
          تنبيه: بعض الأقسام لم تُرفع سحابيًا وبقيت على جهازك فقط:{' '}
          {status.unsupportedSections.map(sectionLabelAr).join('، ')}.
        </p>
      )}
      {report && report.planSkippedCloudExists && (
        <p className="mt-2 text-xs font-bold text-amber-700">
          تنبيه: وُجدت خطة سحابية بالفعل فلم تُستبدل بخطة الجهاز (تعديل الطبيب محفوظ).
        </p>
      )}
      {report && report.dayLogFailed.length > 0 && (
        <p className="mt-2 text-xs font-bold text-red-600">
          أيام لم تُزامن: {report.dayLogFailed.join('، ')}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// صفحة المريض (خطة + سجلات)
// ---------------------------------------------------------------------------

function PatientDetail({
  patientUid,
  viewerClinicId,
  viewerUid,
  isStaffView,
}: {
  patientUid: string;
  viewerClinicId: string;
  viewerUid: string;
  isStaffView: boolean;
}) {
  const [doc, setDoc] = useState<PatientDoc | null>(null);
  const [plan, setPlan] = useState<PlanConfig | null>(null);
  const [entries, setEntries] = useState<Array<{ date: string; log: DayLog }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shownUid, setShownUid] = useState(patientUid);
  const [visibleEntryCount, setVisibleEntryCount] = useState(30);

  // إعادة تعيين أثناء التصيير عند تبديل المريض (نمط React المدعوم
  // «ضبط الحالة أثناء التصيير») — حتى لا تعرض بيانات المريض السابق
  // أثناء تحميل الجديد، وبلا setState متزامن داخل effect.
  if (shownUid !== patientUid) {
    setShownUid(patientUid);
    setDoc(null);
    setPlan(null);
    setEntries([]);
    setVisibleEntryCount(30);
    setError(null);
    setLoading(true);
  }

  const load = () => {
    let cancelled = false;
    Promise.all([
      getPatient(patientUid),
      getPatientPlan(patientUid),
      listDayLogEntries(patientUid),
    ])
      .then(([patientDoc, patientPlan, dayEntries]) => {
        if (cancelled) return;
        setDoc(patientDoc);
        setPlan(patientPlan);
        setEntries(dayEntries);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorText(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(load, [patientUid]);

  // تسجيل توكن FCM للمريض (مرة واحدة عند فتح ملفه)
  useEffect(() => {
    if (!isStaffView && isFcmConfigured()) {
      void registerFcmToken(patientUid).catch(() => {});
    }
  }, [patientUid, isStaffView]);

  if (loading) return <p className="text-sm text-slate-500">جاري تحميل بيانات المريض…</p>;
  if (error) return <p className="text-sm font-bold text-red-600">{error}</p>;
  if (!doc) return <p className="text-sm text-slate-500">لا يوجد ملف مريض بهذا المعرف.</p>;

  const latestEntry = entries[0] ?? null;
  const latestWeightEntry = entries.find(({ log }) => log.weight != null) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardMetric
          label="سجلات الأيام"
          value={entries.length}
          note="سجلات محفوظة على قاعدة المنصة"
        />
        <DashboardMetric
          label="آخر تاريخ تسجيل"
          value={latestEntry?.date ?? '—'}
          note="تاريخ السجل الأحدث"
        />
        <DashboardMetric
          label="آخر وزن مدخل"
          value={latestWeightEntry ? `${latestWeightEntry.log.weight} كجم` : '—'}
          note="القيمة المسجلة دون تفسير آلي"
        />
        <DashboardMetric
          label="الماء في أحدث سجل"
          value={latestEntry ? `${latestEntry.log.water} مل` : '—'}
          note="القيمة التي سُجلت لذلك اليوم"
        />
      </div>
      <Card>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          {doc.profile.clientName}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {isStaffView ? 'عرض طاقم العيادة (قراءة فقط)' : 'ملفي السحابي'}
        </p>
        {plan ? (
          <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
            <p>الوزن الابتدائي: {plan.startWeight} — المستهدف: {plan.targetWeight}</p>
            <p>هدف الماء اليومي: {plan.dailyWaterGoalMl} مل</p>
            <p>عدد الوجبات: {plan.meals.length} — عدد بنود المتابعة: {plan.checklist.length}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">لا توجد خطة سحابية بعد لهذا المريض.</p>
        )}
      </Card>
      <PatientProgressCharts entries={entries} plan={plan} />
      <Card>
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
          سجلات الأيام ({entries.length})
        </h3>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">لا توجد سجلات أيام سحابية بعد.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
            {entries.slice(0, visibleEntryCount).map(({ date, log }) => {
              const daySummary = summarizePatientDayLog(log, plan);
              return (
                <li key={date} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{date}</span>
                    <span className="text-xs text-slate-500">
                      وزن: {log.weight ?? '—'} — ماء: {log.water} مل
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {daySummary.plannedMeals != null && <span>وجبات مختارة: {daySummary.recordedMeals} / {daySummary.plannedMeals}</span>}
                    {daySummary.plannedTasks != null && <span>مهام مكتملة: {daySummary.completedTasks} / {daySummary.plannedTasks}</span>}
                    {log.sleepHours != null && <span>النوم: {log.sleepHours} ساعة</span>}
                    {log.quality && <span>جودة النوم: {log.quality}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {entries.length > visibleEntryCount && (
          <button
            type="button"
            onClick={() => setVisibleEntryCount((count) => Math.min(entries.length, count + 30))}
            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            عرض 30 سجلًا إضافيًا ({entries.length - visibleEntryCount} متبقٍ)
          </button>
        )}
      </Card>
      <AdherenceSection
        patientUid={patientUid}
        uid={viewerUid}
        isStaffView={isStaffView}
      />
      {isStaffView && (
        isPushDeliveryEnabled() ? (
          <NotifyPatientButton patientUid={patientUid} clientName={doc.profile.clientName} />
        ) : (
          <p className="text-xs text-slate-500">
            الإشعارات متوقفة مؤقتًا لحين تنفيذ واختبار تشفير Web Push RFC 8291.
          </p>
        )
      )}
      {!isStaffView && <SyncSection key={patientUid} patientUid={patientUid} />}
      {isStaffView && (
        <p className="text-xs text-slate-500">
          عيادة هذا المريض: {doc.clinicId} — عيادتك: {viewerClinicId}
        </p>
      )}
    </div>
  );
}

// زر إشعار المريض (للدكتور) — يرسل FCM عبر الـ Worker.
function NotifyPatientButton({
  patientUid,
  clientName,
}: {
  patientUid: string;
  clientName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const {
        data: { user },
      } = await getSupabase().auth.getUser();
      if (!user) throw new Error('غير مسجل');
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      const accessToken = session?.access_token ?? '';
      const res = await notifyPatient(
        patientUid,
        'تحديث من دكتورك',
        `دكتورك حدّث خطتك — افتح التطبيق للاطلاع`,
        accessToken,
      );
      setResult(res.sent > 0 ? `تم إرسال الإشعار (${res.sent})` : 'لا توجد أجهزة مسجلة للمريض');
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'فشل الإرسال');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={() => void send()}
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? 'جارٍ الإرسال…' : `🔔 إشعار ${clientName}`}
      </button>
      {result && <span className="text-xs text-slate-600 dark:text-slate-400">{result}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// لوحة الطاقم: أدمن (إدارة الدكاترة) وطبيب (عملائي فقط)
// ---------------------------------------------------------------------------

type DoctorFilter = 'all' | 'unassigned' | { doctorUid: string };

function filterLabel(filter: DoctorFilter, coaches: StaffEntry[]): string {
  if (filter === 'all') return 'كل المرضى';
  if (filter === 'unassigned') return 'عملاء بلا طبيب معيّن';
  const coach = coaches.find((c) => c.uid === filter.doctorUid);
  return coach
    ? `عملاء ${coach.doc.displayName ?? coach.doc.email ?? 'طبيب بلا اسم'}`
    : 'عملاء الطبيب';
}

function AdminDashboard({ clinicId, uid }: { clinicId: string; uid: string }) {
  const [coaches, setCoaches] = useState<StaffEntry[]>([]);
  const [patients, setPatients] = useState<Array<{ uid: string; doc: PatientDoc }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DoctorFilter>('all');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningUid, setAssigningUid] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activity, setActivity] = useState<RecentDayLogActivity[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActivity([]);
    setActivityError(null);
    Promise.all([
      listClinicStaffEntries(clinicId),
      listClinicPatientEntries(clinicId),
    ])
      .then(async ([staff, entries]) => {
        if (cancelled) return;
        setCoaches(staff);
        setPatients(entries);
        setError(null);
        try {
          const recent = await listRecentDayLogActivity(entries.map((entry) => entry.uid), 8);
          if (!cancelled) setActivity(recent);
        } catch (caught: unknown) {
          if (!cancelled) setActivityError(errorText(caught));
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorText(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId, reloadKey]);

  const summary = summarizeDoctors(
    coaches.map((coach) => ({
      uid: coach.uid,
      displayName: coach.doc.displayName,
      email: coach.doc.email,
    })),
    patients.map((patient) => ({ uid: patient.uid, invitedBy: patient.doc.invitedBy })),
  );
  const coachUids = new Set(coaches.map((coach) => coach.uid));
  const visiblePatients = patients.filter((patient) => {
    if (filter === 'all') return true;
    if (filter === 'unassigned') {
      return !patient.doc.invitedBy || !coachUids.has(patient.doc.invitedBy);
    }
    return patient.doc.invitedBy === filter.doctorUid;
  });

  const assign = async (patientUid: string, coachUid: string | null) => {
    setAssignError(null);
    setAssigningUid(patientUid);
    try {
      await assignPatientCoach(patientUid, coachUid);
      setReloadKey((key) => key + 1);
    } catch (caught: unknown) {
      setAssignError(errorText(caught));
    } finally {
      setAssigningUid(null);
    }
  };

  const patientsWithPlan = patients.filter((patient) => Boolean(patient.doc.plan)).length;

  return (
    <div className="flex flex-col gap-4">
      <SubscriptionCard clinicId={clinicId} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardMetric label="مرضى العيادة" value={loading ? '—' : patients.length} note="ضمن نطاق عيادتك فقط" />
        <DashboardMetric label="الأطباء" value={loading ? '—' : coaches.length} note="حسابات الطبيب النشطة في القائمة" />
        <DashboardMetric label="لديهم خطة" value={loading ? '—' : patientsWithPlan} note="خطة محفوظة على قاعدة المنصة" />
        <DashboardMetric label="بلا طبيب معيّن" value={loading ? '—' : summary.unassignedCount} note="يمكن تعيينهم من قائمة المرضى" />
      </div>
      <RecentActivityCard
        title="آخر نشاط المرضى"
        activity={activity}
        nameByUid={new Map(patients.map((patient) => [patient.uid, patient.doc.profile.clientName]))}
        loading={loading}
        error={activityError}
        onOpenPatient={(patientUid) => navigate(`/platform/patients/${encodeURIComponent(patientUid)}`)}
      />
      <Card>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          الدكاترة
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          أطباء عيادتك وعدد عملاء كل منهم — من قاعدة المنصة مباشرة، لا بيانات
          وهمية. اضغط على طبيب لعرض عملائه فقط.
        </p>
        {loading && <p className="mt-3 text-sm text-slate-500">جاري تحميل الدكاترة…</p>}
        {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
        {!loading && !error && coaches.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">لا يوجد أطباء بعد — ادعُ طبيبًا من نموذج الدعوة بالأسفل.</p>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {summary.perDoctor.map((doctor) => (
            <li key={doctor.uid}>
              <button
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => setFilter({ doctorUid: doctor.uid })}
              >
                {doctor.displayName} — {doctor.count} {doctor.count === 1 ? 'عميل' : 'عملاء'}
              </button>
            </li>
          ))}
          <li>
            <button
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => setFilter('unassigned')}
            >
              عملاء بلا طبيب معيّن — {summary.unassignedCount} {summary.unassignedCount === 1 ? 'عميل' : 'عملاء'}
            </button>
          </li>
        </ul>
        {filter !== 'all' && (
          <button className={`${ghostButtonClass} mt-3`} onClick={() => setFilter('all')}>
            عرض الكل
          </button>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          مرضى العيادة — {filterLabel(filter, coaches)}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          مرضى عيادتك فقط — من قاعدة المنصة مباشرة، لا بيانات وهمية. عيّن
          الطبيب من القائمة المنسدلة لكل مريض.
        </p>
        {loading && <p className="mt-3 text-sm text-slate-500">جاري تحميل المرضى…</p>}
        {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
        {assignError && <p className="mt-3 text-sm font-bold text-red-600">{assignError}</p>}
        {!loading && !error && visiblePatients.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">لا يوجد مرضى في هذا العرض.</p>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {visiblePatients.map(({ uid: patientUid, doc }) => (
            <li key={patientUid} className="flex items-center gap-2">
              <button
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => navigate(`/platform/patients/${encodeURIComponent(patientUid)}`)}
              >
                {doc.profile.clientName} — {doc.plan ? 'له خطة سحابية' : 'بلا خطة سحابية بعد'}
              </button>
              <select
                className={`${inputClass} w-auto`}
                aria-label={`طبيب ${doc.profile.clientName}`}
                value={doc.invitedBy && coachUids.has(doc.invitedBy) ? doc.invitedBy : ''}
                disabled={assigningUid === patientUid}
                onChange={(event) => void assign(patientUid, event.target.value === '' ? null : event.target.value)}
              >
                <option value="">بلا طبيب</option>
                {coaches.map((coach) => (
                  <option key={coach.uid} value={coach.uid}>
                    {coach.doc.displayName ?? coach.doc.email ?? 'طبيب بلا اسم'}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </Card>
      <InviteForm clinicId={clinicId} createdBy={uid} isAdmin />
    </div>
  );
}

function CoachDashboard({ clinicId, uid, doctorName }: { clinicId: string; uid: string; doctorName: string }) {
  const [patients, setPatients] = useState<Array<{ uid: string; doc: PatientDoc }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<RecentDayLogActivity[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActivity([]);
    setActivityError(null);
    listDoctorPatients(clinicId, uid)
      .then(async (entries) => {
        if (cancelled) return;
        setPatients(entries);
        try {
          const recent = await listRecentDayLogActivity(entries.map((entry) => entry.uid), 8);
          if (!cancelled) setActivity(recent);
        } catch (caught: unknown) {
          if (!cancelled) setActivityError(errorText(caught));
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorText(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId, uid]);

  const patientsWithPlan = patients.filter((patient) => Boolean(patient.doc.plan)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <DashboardMetric label="عملائي" value={loading ? '—' : patients.length} note="المرضى الذين دعوتهم أنت فقط" />
        <DashboardMetric label="لديهم خطة" value={loading ? '—' : patientsWithPlan} note="خطة محفوظة سحابيًا" />
        <DashboardMetric label="يحتاجون إعداد خطة" value={loading ? '—' : patients.length - patientsWithPlan} note="لا توجد لهم خطة سحابية بعد" />
      </div>
      <RecentActivityCard
        title="آخر نشاط مرضاي"
        activity={activity}
        nameByUid={new Map(patients.map((patient) => [patient.uid, patient.doc.profile.clientName]))}
        loading={loading}
        error={activityError}
        onOpenPatient={(patientUid) => navigate(`/platform/patients/${encodeURIComponent(patientUid)}`)}
      />
      <Card>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          عملائي ({patients.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          المرضى الذين دعوتهم أنت فقط — من قاعدة المنصة مباشرة، لا بيانات
          وهمية. اضغط على مريض لعرض خطته وسجلات تقدمه.
        </p>
        {loading && <p className="mt-3 text-sm text-slate-500">جاري تحميل عملائي…</p>}
        {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
        {!loading && !error && patients.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">لا يوجد عملاء بعد — أنشئ دعوة لمريضك الأول بالأسفل، وسيظهر هنا تلقائيًا بعد تسجيله.</p>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {patients.map(({ uid: patientUid, doc }) => (
            <li key={patientUid}>
              <button
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => navigate(`/platform/patients/${encodeURIComponent(patientUid)}`)}
              >
                {doc.profile.clientName} — {doc.plan ? 'له خطة سحابية' : 'بلا خطة سحابية بعد'}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <DoctorExportButtons
        clinicId={clinicId}
        coachUid={uid}
        doctorName={doctorName}
      />
      <InviteForm clinicId={clinicId} createdBy={uid} isAdmin={false} />
    </div>
  );
}

function StaffDashboard({
  clinicId,
  uid,
  isAdmin,
  doctorName,
}: {
  clinicId: string;
  uid: string;
  isAdmin: boolean;
  doctorName: string;
}) {
  if (isAdmin) return <AdminDashboard clinicId={clinicId} uid={uid} />;
  return <CoachDashboard clinicId={clinicId} uid={uid} doctorName={doctorName} />;
}

// ---------------------------------------------------------------------------
// الهيكل
// ---------------------------------------------------------------------------

function PlatformShell() {
  const { user, profile, loading, profileMissing, signOutPlatform } = usePlatformAuth();
  const [route, setRoute] = useState<Route>(() => parseRoute());

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // صاحب المنصة له مساحة مستقلة ولا يجب أن يسقط في لوحة الطبيب/الأدمن.
  // رابط الاستعادة يحتفظ بمساره حتى يتمكن من تعيين كلمة مرور جديدة أولًا.
  useEffect(() => {
    if (
      !loading &&
      user &&
      profile?.role === 'owner' &&
      !profile.disabled &&
      route.view !== 'updatePassword' &&
      window.location.pathname.startsWith('/platform')
    ) {
      window.location.replace('/owner');
    }
  }, [loading, user, profile?.role, profile?.disabled, route.view]);

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">جاري التحقق من الجلسة…</p>;
  }

  return (
    <div dir="rtl" className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-slate-50 p-4 dark:bg-slate-950">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
          منصة التغذية والصحة
        </h1>
        {user && (
          <button className={ghostButtonClass} onClick={() => void signOutPlatform()}>
            خروج
          </button>
        )}
      </header>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        نسخة تشغيل تجريبي محدودة — الدخول بدعوة فقط. استخدم حسابك المخصص لك، ولا تشارك بيانات المرضى خارج صلاحياتك.
      </p>

      {route.view === 'updatePassword' && <UpdatePasswordForm />}
      {!user && route.view === 'register' && <RegisterForm invitedEmail={route.email} />}
      {!user && route.view !== 'register' && route.view !== 'updatePassword' && <LoginForm />}

      {user && profileMissing && (
        <Card>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
            حسابك بلا ملف دور
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            تم الدخول لكن لا يوجد ملف مستخدم صالح لحسابك (دور/عيادة). إن
            سجلت بدعوة، تأكد أنك استخدمت البريد المدعو به بالظبط وأن الدعوة
            ما زالت سارية، أو تواصل مع أدمن عيادتك.
          </p>
          <button className={`${ghostButtonClass} mt-3`} onClick={() => navigate('/platform/register')}>
            التسجيل بدعوة
          </button>
        </Card>
      )}

      {user && profile && profile.disabled && (
        <Card>
          <p className="text-sm font-bold text-red-600">
            حسابك موقوف — تواصل مع أدمن عيادتك.
          </p>
        </Card>
      )}

      {user && profile?.role === 'owner' && !profile.disabled && route.view !== 'updatePassword' && (
        <Card>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            جاري تحويلك إلى لوحة صاحب المنصة…
          </p>
        </Card>
      )}

      {user && profile && !profile.disabled && !profileMissing && profile.role !== 'owner' && (
        <SubscriptionGate
          clinicId={profile.clinicId}
          role={profile.role}
        >
          {route.view === 'patient' && (
            <>
              {profile.role === 'patient' && profile.uid !== route.patientUid ? (
                <Card>
                  <p className="text-sm font-bold text-red-600">
                    لا يمكنك عرض ملف مريض آخر — يمكنك عرض ملفك فقط.
                  </p>
                </Card>
              ) : (
                <PatientDetail
                  patientUid={route.patientUid}
                  viewerClinicId={profile.clinicId}
                  viewerUid={profile.uid}
                  isStaffView={profile.role !== 'patient'}
                />
              )}
            </>
          )}

          {route.view !== 'patient' && profile.role === 'patient' && (
            <PatientDetail
              patientUid={profile.uid}
              viewerClinicId={profile.clinicId}
              viewerUid={profile.uid}
              isStaffView={false}
            />
          )}

          {route.view !== 'patient' && profile.role !== 'patient' && (
            <StaffDashboard
              clinicId={profile.clinicId}
              uid={profile.uid}
              isAdmin={profile.role === 'admin'}
              doctorName={profile.displayName ?? profile.email ?? profile.uid}
            />
          )}
        </SubscriptionGate>
      )}
    </div>
  );
}

export default function PlatformApp() {
  if (!isSupabaseConfigured()) {
    return (
      <div dir="rtl" className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-black text-slate-900">وضع المنصة غير مهيأ</h1>
        <p className="mt-2 text-sm text-slate-600">
          اضبط متغيرات بيئة Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY)
          في ملف .env المحلي أو بيئة النشر (انظر .env.example) ثم أعد التحميل.
          لا توجد قيم افتراضية عمدًا.
        </p>
      </div>
    );
  }
  return (
    <PlatformAuthProvider>
      <PlatformShell />
    </PlatformAuthProvider>
  );
}
