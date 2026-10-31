// تبويب العيادات: قائمة كل العيادات مع حالة الاشتراك والإيقاف الإداري.

import { useCallback, useEffect, useState } from 'react';
import {
  activateSubscription,
  listAllClinics,
  suspendClinic,
  unsuspendClinic,
  type ClinicSummary,
} from '../owner';
import type { SubscriptionPlan } from '../firestore';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  permanent: 'دائم',
  monthly: 'شهري',
  annual: 'سنوي',
};

function daysLeft(expiresAt: unknown): number | null {
  if (!expiresAt || typeof expiresAt !== 'object') return null;
  const t = (expiresAt as { toDate?: () => Date }).toDate?.();
  if (!t) return null;
  return Math.ceil((t.getTime() - Date.now()) / 86400000);
}

function StatusBadge({ clinic }: { clinic: ClinicSummary }) {
  if (clinic.status === 'suspended') {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
        موقوفة إداريًا
      </span>
    );
  }
  const s = clinic.subscription?.status;
  if (s === 'active') {
    const left = daysLeft(clinic.subscription?.expiresAt);
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        نشط{left != null ? ` — باقي ${left} يوم` : ' (دائم)'}
      </span>
    );
  }
  if (s === 'grace') {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        فترة سماح
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {s === 'expired' ? 'منتهي' : 'بلا اشتراك'}
    </span>
  );
}

export function ClinicsTab({ ownerUid }: { ownerUid: string }) {
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [renewPlan, setRenewPlan] = useState<SubscriptionPlan>('annual');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setClinics(await listAllClinics());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التحميل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function toggleSuspend(c: ClinicSummary) {
    setBusy(c.id);
    try {
      if (c.status === 'suspended') await unsuspendClinic(c.id);
      else await suspendClinic(c.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التنفيذ');
    } finally {
      setBusy(null);
    }
  }

  async function doRenew(c: ClinicSummary) {
    setBusy(c.id);
    try {
      await activateSubscription({
        clinicId: c.id,
        plan: renewPlan,
        reviewedBy: ownerUid,
      });
      setRenewFor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التجديد');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="p-4 text-center">جارٍ التحميل…</p>;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {clinics.length === 0 && (
        <p className="p-4 text-center text-sm text-slate-500">
          لا توجد عيادات بعد — أنشئ أول عيادة من تبويب «عيادة جديدة».
        </p>
      )}
      {clinics.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold">{c.name}</h3>
              <p className="text-xs text-slate-500">
                {c.ownerName}
                {c.ownerPhone ? ` — ${c.ownerPhone}` : ''}
                {c.ownerUid ? '' : ' (لم يسجل بعد)'}
              </p>
            </div>
            <StatusBadge clinic={c} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setRenewFor(renewFor === c.id ? null : c.id)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              تفعيل / تجديد
            </button>
            <button
              onClick={() => void toggleSuspend(c)}
              disabled={busy === c.id}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700"
            >
              {busy === c.id
                ? '…'
                : c.status === 'suspended'
                  ? 'فك الإيقاف'
                  : 'إيقاف إداري'}
            </button>
          </div>
          {renewFor === c.id && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <select
                value={renewPlan}
                onChange={(e) => setRenewPlan(e.target.value as SubscriptionPlan)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {(Object.keys(PLAN_LABELS) as SubscriptionPlan[]).map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABELS[p]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void doRenew(c)}
                disabled={busy === c.id}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
              >
                {busy === c.id ? '…' : 'تأكيد التفعيل'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
