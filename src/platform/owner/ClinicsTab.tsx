// تبويب العيادات: قائمة كل العيادات مع البحث والتصفية وحالة الاشتراك والإيقاف الإداري.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  activateSubscription,
  listAllClinics,
  suspendClinic,
  unsuspendClinic,
  type ClinicSummary,
} from '../owner';
import type { SubscriptionPlan } from '../firestore';
import { daysRemaining } from '../ownerDashboard';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  permanent: 'دائم',
  monthly: 'شهري',
  annual: 'سنوي',
};

type StatusFilter = 'all' | 'active' | 'grace' | 'expired' | 'suspended';

function StatusBadge({ clinic }: { clinic: ClinicSummary }) {
  if (clinic.status === 'suspended') {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
        موقوفة إداريًا
      </span>
    );
  }

  const status = clinic.subscription?.status;
  if (status === 'active') {
    const remaining = daysRemaining(clinic.subscription?.expiresAt);
    const label = clinic.subscription?.plan === 'permanent'
      ? 'نشط — دائم'
      : remaining != null
        ? remaining < 0
          ? `تجاوز تاريخ الانتهاء بـ ${Math.abs(remaining)} يوم`
          : `نشط — باقي ${remaining} يوم`
        : 'نشط';
    const classes = remaining != null && remaining < 0
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${classes}`}>{label}</span>;
  }

  if (status === 'grace') {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        فترة سماح
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {status === 'expired' ? 'منتهي' : 'بلا اشتراك'}
    </span>
  );
}

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'active', label: 'اشتراك نشط' },
  { id: 'grace', label: 'فترة سماح' },
  { id: 'expired', label: 'منتهي / بلا اشتراك' },
  { id: 'suspended', label: 'موقوفة إداريًا' },
];

function matchesFilter(clinic: ClinicSummary, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'suspended') return clinic.status === 'suspended';
  if (clinic.status === 'suspended') return false;
  if (filter === 'active') return clinic.subscription?.status === 'active';
  if (filter === 'grace') return clinic.subscription?.status === 'grace';
  return !clinic.subscription || clinic.subscription.status === 'expired';
}

function clinicSearchText(clinic: ClinicSummary): string {
  return [
    clinic.name,
    clinic.ownerName,
    clinic.ownerPhone,
    clinic.id,
  ].filter(Boolean).join(' ').toLocaleLowerCase('ar');
}

export function ClinicsTab() {
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [renewPlan, setRenewPlan] = useState<SubscriptionPlan>('annual');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setClinics(await listAllClinics());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل العيادات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => ({
    all: clinics.length,
    active: clinics.filter((clinic) => matchesFilter(clinic, 'active')).length,
    grace: clinics.filter((clinic) => matchesFilter(clinic, 'grace')).length,
    expired: clinics.filter((clinic) => matchesFilter(clinic, 'expired')).length,
    suspended: clinics.filter((clinic) => matchesFilter(clinic, 'suspended')).length,
  }), [clinics]);

  const visibleClinics = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ar');
    return clinics.filter((clinic) => {
      if (!matchesFilter(clinic, statusFilter)) return false;
      return !normalizedQuery || clinicSearchText(clinic).includes(normalizedQuery);
    });
  }, [clinics, query, statusFilter]);

  async function toggleSuspend(clinic: ClinicSummary) {
    setError('');
    setBusy(clinic.id);
    try {
      if (clinic.status === 'suspended') await unsuspendClinic(clinic.id);
      else await suspendClinic(clinic.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التنفيذ');
    } finally {
      setBusy(null);
    }
  }

  async function doRenew(clinic: ClinicSummary) {
    setError('');
    setBusy(clinic.id);
    try {
      await activateSubscription({
        clinicId: clinic.id,
        plan: renewPlan,
      });
      setRenewFor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التجديد');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">إدارة العيادات</h2>
          <p className="mt-1 text-xs text-slate-500">ابحث باسم العيادة أو المالك أو الهاتف أو معرّف العيادة.</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700 disabled:opacity-50"
        >
          {loading ? 'جارٍ التحديث…' : 'تحديث القائمة'}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {clinics.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                aria-pressed={statusFilter === filter.id}
                className={`rounded-xl border p-3 text-right transition-colors ${
                  statusFilter === filter.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <span className="block text-[11px] font-bold text-slate-500">{filter.label}</span>
                <span className="mt-1 block text-xl font-black tabular-nums text-slate-900 dark:text-slate-100">
                  {counts[filter.id]}
                </span>
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-200">
            البحث في العيادات
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="اسم العيادة، صاحبها، الهاتف أو المعرّف…"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </>
      )}

      {loading ? (
        <p className="p-6 text-center text-sm text-slate-500">جارٍ تحميل العيادات…</p>
      ) : clinics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-bold text-slate-900 dark:text-slate-100">لا توجد عيادات بعد</h3>
          <p className="mt-2 text-sm text-slate-500">أنشئ أول عيادة من تبويب «عيادة جديدة»؛ ستظهر هنا بعد نجاح الحفظ.</p>
        </div>
      ) : visibleClinics.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">لا توجد نتائج مطابقة</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
            }}
            className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700"
          >
            مسح البحث والتصفية
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">عرض {visibleClinics.length} من {clinics.length} عيادة.</p>
          {visibleClinics.map((clinic) => (
            <article
              key={clinic.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-bold text-slate-900 dark:text-slate-100">{clinic.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {clinic.ownerName || 'اسم المالك غير مسجل'}
                    {clinic.ownerPhone ? ` — ${clinic.ownerPhone}` : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {clinic.ownerUid ? 'حساب المالك مرتبط' : 'بانتظار تسجيل المالك'} · {clinic.id}
                  </p>
                </div>
                <StatusBadge clinic={clinic} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
                <div>
                  <span className="block text-slate-500">الخطة</span>
                  <span className="mt-1 block font-bold text-slate-800 dark:text-slate-100">
                    {clinic.subscription ? PLAN_LABELS[clinic.subscription.plan] : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">حالة الاشتراك</span>
                  <span className="mt-1 block font-bold text-slate-800 dark:text-slate-100">
                    {clinic.subscription?.status === 'active'
                      ? 'نشط'
                      : clinic.subscription?.status === 'grace'
                        ? 'فترة سماح'
                        : clinic.subscription?.status === 'expired'
                          ? 'منتهي'
                          : 'غير مسجل'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRenewFor(renewFor === clinic.id ? null : clinic.id)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
                >
                  تفعيل / تجديد
                </button>
                <button
                  type="button"
                  onClick={() => void toggleSuspend(clinic)}
                  disabled={busy === clinic.id}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700 disabled:opacity-50"
                >
                  {busy === clinic.id
                    ? 'جارٍ التنفيذ…'
                    : clinic.status === 'suspended'
                      ? 'فك الإيقاف الإداري'
                      : 'إيقاف إداري'}
                </button>
              </div>

              {renewFor === clinic.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                    خطة الاشتراك الجديدة
                    <select
                      value={renewPlan}
                      onChange={(event) => setRenewPlan(event.target.value as SubscriptionPlan)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      {(Object.keys(PLAN_LABELS) as SubscriptionPlan[]).map((plan) => (
                        <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void doRenew(clinic)}
                    disabled={busy === clinic.id}
                    className="self-end rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busy === clinic.id ? 'جارٍ الحفظ…' : 'تأكيد التفعيل'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
