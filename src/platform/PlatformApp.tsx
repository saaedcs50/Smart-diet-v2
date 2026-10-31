// ============================================================================
// واجهة المنصة — المرحلة الثانية من بناء المنصة
// ----------------------------------------------------------------------------
// - تعمل فقط عندما يكون وضع المنصة مفعّلًا (VITE_PLATFORM_ENABLED=true —
//   يفرضه App.tsx قبل تركيب هذا المكوّن)، وبلا إعدادات Firebase تُعرض
//   رسالة إعداد واضحة بدل انكسار غامض.
// - لا تسجيل ذاتي: التسجيل بدعوة فقط (البريد المدعو به + كلمة مرور)،
//   ودخول Google عند إنشاء الحساب للطاقم فقط (تفرضه invitations.ts).
// - لوحة الأخصائية هنا حقيقية (بيانات من Firestore عبر طبقة المرحلة
//   الأولى)، لا بيانات وهمية — مسار /prototype التجريبي منفصل ولا يُمس.
// - المزامنة opt-in صريح من واجهة المريض نفسه فقط، بعد موافقة صريحة
//   تُحفظ في consents/sync قبل أي رفع (دراسة §٦).
// - الصور السحابية ملغاة بقرار المالك (2026-10-27): لا رفع إلى Cloud
//   Storage ولا عرض صور سحابية؛ الصور تبقى محلية للمستخدم في التطبيق
//   الرئيسي، أو يرسلها المستخدم بنفسه واتساب لطبيب العيادة (سياسة فقط،
//   بلا بناء مشاركة واتساب هنا).
// - لوحة الطاقم المتقدمة: الأدمن يرى الدكاترة وعدد عملاء كل منهم ويعيّن
//   المرضى للأطباء، والطبيب يرى عملاءه فقط (من دعاهم). الربط على مستوى
//   الواجهة فقط عبر حقل invitedBy — قراءة العيادة للطاقم تبقى كما هي،
//   وصفحة المريض نفسها (الخطة + سجلات الأيام) لم تُبنَ من جديد.
// ============================================================================

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { PlatformAuthProvider, usePlatformAuth } from './auth';
import { isFirebaseConfigured } from './firebase';
import {
  assignPatientCoach,
  getPatient,
  getPatientPlan,
  listClinicPatientEntries,
  listClinicStaffEntries,
  listDayLogEntries,
  listDoctorPatients,
  saveConsent,
  summarizeDoctors,
  type PatientDoc,
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

type Route =
  | { view: 'login' }
  | { view: 'register'; email?: string }
  | { view: 'dashboard' }
  | { view: 'patient'; patientUid: string };

function parseRoute(): Route {
  const pathname = window.location.pathname;
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
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          دخول
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

function SyncSection({ patientUid }: { patientUid: string }) {
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(() => loadSyncStatus());
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(() => {
    try {
      return summarizeSnapshot(readLocalSnapshot());
    } catch {
      return { dayLogCount: 0, shoppingListCount: 0, hasPlan: false, hasActiveFasting: false };
    }
  });

  const run = async () => {
    setError(null);
    setBusy(true);
    setStatus({ state: 'syncing', at: null, dayLogCount: 0, planWritten: false, error: null });
    try {
      await saveConsent(
        patientUid,
        'sync',
        { text: SYNC_CONSENT_TEXT, grantedAt: new Date().toISOString(), revokedAt: null, version: SYNC_CONSENT_VERSION },
        patientUid,
      );
      const snapshot = readLocalSnapshot();
      setSummary(summarizeSnapshot(snapshot));
      const result = await migrateLocalToCloud(snapshot, patientUid, patientUid);
      setReport(result);
      const next: SyncStatus = {
        state: result.errors.length > 0 ? 'error' : 'success',
        at: new Date().toISOString(),
        dayLogCount: result.dayLogCount,
        planWritten: result.planWritten,
        error: result.errors.length > 0 ? result.errors.join('؛ ') : null,
      };
      setStatus(next);
      saveSyncStatus(next);
    } catch (caught) {
      const next: SyncStatus = {
        state: 'error',
        at: new Date().toISOString(),
        dayLogCount: 0,
        planWritten: false,
        error: errorText(caught),
      };
      setStatus(next);
      saveSyncStatus(next);
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
      <p className="mt-1 text-xs text-slate-500">
        على هذا الجهاز الآن: خطة {summary.hasPlan ? 'موجودة' : 'غير موجودة'}،{' '}
        {summary.dayLogCount} سجل يومي، {summary.shoppingListCount} قائمة تسوق.
        المزامنة اختيارية ولا تعمل تلقائيًا أبدًا.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>{SYNC_CONSENT_TEXT}</span>
      </label>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <button className={`${buttonClass} mt-3`} onClick={run} disabled={busy || !consent}>
        مزامنة بيانات جهازي الآن
      </button>
      {status.state !== 'idle' && (
        <p className="mt-2 text-xs text-slate-500">
          آخر حالة: {status.state === 'success' ? 'نجحت' : status.state === 'syncing' ? 'جارية…' : 'فشلت'}
          {status.at ? ` — ${status.at}` : ''}
          {status.state === 'success' ? ` — ${status.dayLogCount} يوم، والخطة ${status.planWritten ? 'رُفعت' : 'كانت موجودة سحابيًا فلم تُستبدل'}.` : ''}
          {status.error ? ` — ${status.error}` : ''}
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

  // إعادة تعيين أثناء التصيير عند تبديل المريض (نمط React المدعوم
  // «ضبط الحالة أثناء التصيير») — حتى لا تعرض بيانات المريض السابق
  // أثناء تحميل الجديد، وبلا setState متزامن داخل effect.
  if (shownUid !== patientUid) {
    setShownUid(patientUid);
    setDoc(null);
    setPlan(null);
    setEntries([]);
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

  if (loading) return <p className="text-sm text-slate-500">جاري تحميل بيانات المريض…</p>;
  if (error) return <p className="text-sm font-bold text-red-600">{error}</p>;
  if (!doc) return <p className="text-sm text-slate-500">لا يوجد ملف مريض بهذا المعرف.</p>;

  return (
    <div className="flex flex-col gap-4">
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
      <Card>
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
          سجلات الأيام ({entries.length})
        </h3>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">لا توجد سجلات أيام سحابية بعد.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
            {entries.slice(0, 30).map(({ date, log }) => (
              <li key={date} className="flex justify-between gap-2">
                <span>{date}</span>
                <span>
                  وزن: {log.weight ?? '—'} — ماء: {log.water} مل
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <AdherenceSection
        patientUid={patientUid}
        uid={viewerUid}
        isStaffView={isStaffView}
      />
      {!isStaffView && <SyncSection patientUid={patientUid} />}
      {isStaffView && (
        <p className="text-xs text-slate-500">
          عيادة هذا المريض: {doc.clinicId} — عيادتك: {viewerClinicId}
        </p>
      )}
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listClinicStaffEntries(clinicId),
      listClinicPatientEntries(clinicId),
    ])
      .then(([staff, entries]) => {
        if (cancelled) return;
        setCoaches(staff);
        setPatients(entries);
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

  return (
    <div className="flex flex-col gap-4">
      <SubscriptionCard clinicId={clinicId} />
      <Card>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          الدكاترة
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          أطباء عيادتك وعدد عملاء كل منهم — من Firestore مباشرة، لا بيانات
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
          مرضى عيادتك فقط — من Firestore مباشرة، لا بيانات وهمية. عيّن
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

function CoachDashboard({ clinicId, uid }: { clinicId: string; uid: string }) {
  const [patients, setPatients] = useState<Array<{ uid: string; doc: PatientDoc }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listDoctorPatients(clinicId, uid)
      .then((entries) => {
        if (!cancelled) setPatients(entries);
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          عملائي ({patients.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          المرضى الذين دعوتهم أنت فقط — من Firestore مباشرة، لا بيانات
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
      <InviteForm clinicId={clinicId} createdBy={uid} isAdmin={false} />
    </div>
  );
}

function StaffDashboard({ clinicId, uid, isAdmin }: { clinicId: string; uid: string; isAdmin: boolean }) {
  if (isAdmin) return <AdminDashboard clinicId={clinicId} uid={uid} />;
  return <CoachDashboard clinicId={clinicId} uid={uid} />;
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
        وضع المنصة (تجريبي) — بيانات المشروع التجريبي فقط، وليست بيانات إنتاج.
      </p>

      {!user && route.view === 'register' && <RegisterForm invitedEmail={route.email} />}
      {!user && route.view !== 'register' && <LoginForm />}

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

      {user && profile && !profile.disabled && !profileMissing && (
        <SubscriptionGate
          clinicId={profile.clinicId}
          uid={profile.uid}
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
            <StaffDashboard clinicId={profile.clinicId} uid={profile.uid} isAdmin={profile.role === 'admin'} />
          )}
        </SubscriptionGate>
      )}
    </div>
  );
}

export default function PlatformApp() {
  if (!isFirebaseConfigured()) {
    return (
      <div dir="rtl" className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-black text-slate-900">وضع المنصة غير مهيأ</h1>
        <p className="mt-2 text-sm text-slate-600">
          اضبط متغيرات بيئة Firebase (VITE_FIREBASE_*) في ملف .env المحلي أو
          بيئة النشر (انظر .env.example) ثم أعد التحميل. لا توجد قيم
          افتراضية عمدًا.
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
