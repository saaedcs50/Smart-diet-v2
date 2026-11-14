import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import type { PatientDoc, StaffEntry } from './firestore';
import {
  appointmentChannelLabel,
  appointmentStatusLabel,
  appointmentVisitTypeLabel,
  buildAppointmentTimeRange,
  getClinicWeekRange,
  localDateKey,
  toDateTimeLocalValue,
  type AppointmentChannel,
  type AppointmentStatus,
  type AppointmentVisitType,
} from './appointmentUtils';
import {
  createAppointment,
  listAppointments,
  updateAppointment,
  type AppointmentRecord,
} from './appointments';

type StaffRole = 'admin' | 'coach';
type AppointmentView = 'today' | 'week' | 'unconfirmed';

interface AppointmentsSectionProps {
  clinicId: string;
  uid: string;
  role: StaffRole;
  patients: Array<{ uid: string; doc: PatientDoc }>;
  providers: StaffEntry[];
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const buttonClass =
  'rounded-xl bg-peacock-indigo px-3 py-2 text-xs font-bold text-white disabled:opacity-50';
const mutedButtonClass =
  'rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200';

function nextQuarterHour(): string {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil((date.getMinutes() + 1) / 15) * 15);
  return toDateTimeLocalValue(date);
}

function statusClass(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
    case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200';
    case 'completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'cancelled': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'no_show': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200';
  }
}

function formatAppointmentDate(value: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isClosed(status: AppointmentStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'no_show';
}

export function AppointmentsSection({
  clinicId,
  uid,
  role,
  patients,
  providers,
}: AppointmentsSectionProps) {
  const weekRange = useMemo(() => getClinicWeekRange(), []);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [view, setView] = useState<AppointmentView>('today');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AppointmentRecord | null>(null);
  const [patientUid, setPatientUid] = useState('');
  const [providerUid, setProviderUid] = useState(role === 'coach' ? uid : '');
  const [startsAtLocal, setStartsAtLocal] = useState(nextQuarterHour);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [visitType, setVisitType] = useState<AppointmentVisitType>('follow_up');
  const [channel, setChannel] = useState<AppointmentChannel>('in_person');
  const [reloadKey, setReloadKey] = useState(0);

  const activeProviders = useMemo(
    () => providers.filter((provider) => !provider.doc.disabled),
    [providers],
  );
  const patientNames = useMemo(
    () => new Map(patients.map((patient) => [patient.uid, patient.doc.profile.clientName || 'مريض'])),
    [patients],
  );
  const providerNames = useMemo(
    () => new Map(activeProviders.map((provider) => [
      provider.uid,
      provider.doc.displayName ?? provider.doc.email ?? 'طبيب',
    ])),
    [activeProviders],
  );

  useEffect(() => {
    if (role === 'admin' && !providerUid && activeProviders.length > 0) {
      setProviderUid(activeProviders[0].uid);
    }
  }, [role, providerUid, activeProviders]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAppointments(
        weekRange.start.toISOString(),
        weekRange.end.toISOString(),
      );
      setAppointments(data);
    } catch (caught) {
      setAppointments([]);
      setError(caught instanceof Error ? caught.message : 'تعذّر تحميل المواعيد.');
    } finally {
      setLoading(false);
    }
  }, [weekRange]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadKey]);

  const todayKey = localDateKey(new Date());
  const todayAppointments = appointments.filter((item) => localDateKey(new Date(item.starts_at)) === todayKey);
  const unconfirmedCount = appointments.filter((item) => item.status === 'scheduled').length;
  const visibleAppointments = appointments.filter((item) => {
    if (view === 'today') return localDateKey(new Date(item.starts_at)) === todayKey;
    if (view === 'unconfirmed') return item.status === 'scheduled';
    return true;
  });

  const resetForm = () => {
    setEditing(null);
    setPatientUid('');
    setProviderUid(role === 'coach' ? uid : (activeProviders[0]?.uid ?? ''));
    setStartsAtLocal(nextQuarterHour());
    setDurationMinutes('30');
    setVisitType('follow_up');
    setChannel('in_person');
  };

  const openCreate = () => {
    resetForm();
    setError(null);
    setShowForm(true);
  };

  const openEdit = (item: AppointmentRecord) => {
    setEditing(item);
    setPatientUid(item.patient_id);
    setProviderUid(item.provider_id);
    setStartsAtLocal(toDateTimeLocalValue(new Date(item.starts_at)));
    setDurationMinutes(String(Math.round(
      (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60_000,
    )));
    setVisitType(item.visit_type);
    setChannel(item.channel);
    setError(null);
    setShowForm(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!editing && !patientUid) {
      setError('اختر المريض أولًا.');
      return;
    }
    const effectiveProviderUid = role === 'coach' ? uid : providerUid;
    if (!effectiveProviderUid) {
      setError('اختر الطبيب المسؤول عن الموعد.');
      return;
    }
    const timeRange = buildAppointmentTimeRange(startsAtLocal, Number(durationMinutes));
    if (!timeRange) {
      setError('تحقق من تاريخ الموعد ومدته (من 15 إلى 180 دقيقة).');
      return;
    }
    if (!editing && new Date(timeRange.startsAt).getTime() <= Date.now()) {
      setError('موعد جديد يجب أن يكون في المستقبل.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateAppointment(editing.id, {
          provider_id: effectiveProviderUid,
          starts_at: timeRange.startsAt,
          ends_at: timeRange.endsAt,
          visit_type: visitType,
          channel,
        });
      } else {
        await createAppointment({
          clinic_id: clinicId,
          patient_id: patientUid,
          provider_id: effectiveProviderUid,
          created_by: uid,
          starts_at: timeRange.startsAt,
          ends_at: timeRange.endsAt,
          visit_type: visitType,
          channel,
        });
      }
      setShowForm(false);
      resetForm();
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ الموعد.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (item: AppointmentRecord, status: AppointmentStatus) => {
    setError(null);
    setBusyAppointmentId(item.id);
    try {
      await updateAppointment(item.id, { status });
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تحديث حالة الموعد.');
    } finally {
      setBusyAppointmentId(null);
    }
  };

  const canCreate = patients.length > 0 &&
    (role === 'coach' || activeProviders.length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">مواعيد العيادة</h2>
          <p className="mt-1 text-xs text-slate-500">
            نطاق هذا الأسبوع (السبت إلى الجمعة). الحجوزات مرتبطة بمرضى وطبيب من عيادتك فقط.
          </p>
        </div>
        <button type="button" className={buttonClass} disabled={!canCreate} onClick={openCreate}>
          إضافة موعد
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-[11px] text-slate-500">مواعيد اليوم</p>
          <p className="mt-1 text-xl font-black tabular-nums">{todayAppointments.length}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-[11px] text-slate-500">هذا الأسبوع</p>
          <p className="mt-1 text-xl font-black tabular-nums">{appointments.length}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-[11px] text-slate-500">بانتظار التأكيد</p>
          <p className="mt-1 text-xl font-black tabular-nums">{unconfirmedCount}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="فلترة المواعيد">
        {([
          ['today', 'اليوم'],
          ['week', 'الأسبوع'],
          ['unconfirmed', 'غير مؤكدة'],
        ] as Array<[AppointmentView, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={view === key ? buttonClass : mutedButtonClass}
          >
            {label}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={(event) => void save(event)} className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {editing ? 'تعديل الموعد' : 'موعد جديد'}
            </h3>
            <button type="button" className={mutedButtonClass} onClick={() => { setShowForm(false); resetForm(); }}>
              إغلاق
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              المريض
              <select
                className={`${inputClass} mt-1`}
                required
                disabled={Boolean(editing)}
                value={patientUid}
                onChange={(event) => setPatientUid(event.target.value)}
              >
                <option value="">اختر المريض</option>
                {patients.map((patient) => (
                  <option key={patient.uid} value={patient.uid}>
                    {patient.doc.profile.clientName || 'مريض'}
                  </option>
                ))}
              </select>
            </label>

            {role === 'admin' && (
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                الطبيب المسؤول
                <select
                  className={`${inputClass} mt-1`}
                  required
                  value={providerUid}
                  onChange={(event) => setProviderUid(event.target.value)}
                >
                  <option value="">اختر الطبيب</option>
                  {activeProviders.map((provider) => (
                    <option key={provider.uid} value={provider.uid}>
                      {provider.doc.displayName ?? provider.doc.email ?? 'طبيب'}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              التاريخ والوقت
              <input
                className={`${inputClass} mt-1`}
                type="datetime-local"
                required
                step={900}
                value={startsAtLocal}
                onChange={(event) => setStartsAtLocal(event.target.value)}
              />
            </label>

            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              مدة الموعد
              <select
                className={`${inputClass} mt-1`}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              >
                <option value="15">15 دقيقة</option>
                <option value="30">30 دقيقة</option>
                <option value="45">45 دقيقة</option>
                <option value="60">ساعة</option>
                <option value="90">ساعة ونصف</option>
                <option value="120">ساعتان</option>
                <option value="180">3 ساعات</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              نوع الزيارة
              <select
                className={`${inputClass} mt-1`}
                value={visitType}
                onChange={(event) => setVisitType(event.target.value as AppointmentVisitType)}
              >
                <option value="initial_consultation">استشارة أولى</option>
                <option value="follow_up">متابعة</option>
                <option value="measurement_review">مراجعة قياسات</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              طريقة الجلسة
              <select
                className={`${inputClass} mt-1`}
                value={channel}
                onChange={(event) => setChannel(event.target.value as AppointmentChannel)}
              >
                <option value="in_person">حضوري</option>
                <option value="video">مكالمة فيديو</option>
                <option value="phone">مكالمة هاتفية</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className={buttonClass} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'حفظ الموعد'}
            </button>
            <button type="button" className={mutedButtonClass} disabled={saving} onClick={() => { setShowForm(false); resetForm(); }}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-xs font-bold text-red-600">{error}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">جارٍ تحميل المواعيد…</p>
      ) : visibleAppointments.length === 0 ? (
        <EmptyState
          title={view === 'today' ? 'لا توجد مواعيد اليوم' : view === 'unconfirmed' ? 'كل مواعيد الأسبوع مؤكدة' : 'لا توجد مواعيد هذا الأسبوع'}
          description="يمكنك إضافة موعد جديد من الزر أعلاه، وستظهر الحجوزات هنا بعد حفظها."
          className="mt-3"
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {visibleAppointments.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {patientNames.get(item.patient_id) ?? 'مريض'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {formatAppointmentDate(item.starts_at)} — {appointmentVisitTypeLabel(item.visit_type)} — {appointmentChannelLabel(item.channel)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    الطبيب: {providerNames.get(item.provider_id) ?? (role === 'coach' ? 'أنا' : 'طبيب العيادة')}
                  </p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>
                  {appointmentStatusLabel(item.status)}
                </span>
              </div>

              {!isClosed(item.status) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === 'scheduled' && (
                    <button
                      type="button"
                      className={mutedButtonClass}
                      disabled={busyAppointmentId === item.id}
                      onClick={() => void changeStatus(item, 'confirmed')}
                    >
                      تأكيد
                    </button>
                  )}
                  <button
                    type="button"
                    className={mutedButtonClass}
                    disabled={busyAppointmentId === item.id}
                    onClick={() => openEdit(item)}
                  >
                    إعادة جدولة
                  </button>
                  <button
                    type="button"
                    className={mutedButtonClass}
                    disabled={busyAppointmentId === item.id}
                    onClick={() => void changeStatus(item, 'completed')}
                  >
                    تم الحضور
                  </button>
                  <button
                    type="button"
                    className={mutedButtonClass}
                    disabled={busyAppointmentId === item.id}
                    onClick={() => void changeStatus(item, 'no_show')}
                  >
                    لم يحضر
                  </button>
                  <button
                    type="button"
                    className={mutedButtonClass}
                    disabled={busyAppointmentId === item.id}
                    onClick={() => void changeStatus(item, 'cancelled')}
                  >
                    إلغاء الموعد
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {patients.length === 0 && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          لن تتمكن من إضافة موعد قبل وجود مريض مسجل ضمن نطاق حسابك.
        </p>
      )}
      {role === 'admin' && activeProviders.length === 0 && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          أضف طبيبًا نشطًا إلى العيادة قبل إنشاء المواعيد.
        </p>
      )}
      <p className="mt-3 text-[10px] leading-5 text-slate-500">
        الإلغاء وعدم الحضور يُسجّلان كحالة للموعد، ولا تُحذف السجلات. التنبيهات ومزامنة Google/Outlook/Apple ليست مفعلة في هذه الدفعة.
      </p>
    </section>
  );
}
