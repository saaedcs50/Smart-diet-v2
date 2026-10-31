// تبويب طلبات التفعيل: مراجعة مدفوعات أصحاب العيادات المعلقة.

import { useCallback, useEffect, useState } from 'react';
import {
  activateSubscription,
  listPendingActivations,
  rejectActivation,
  type PendingActivation,
} from '../owner';
import type { SubscriptionPlan } from '../firestore';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  permanent: 'دائم',
  monthly: 'شهري',
  annual: 'سنوي',
};

const METHOD_LABELS: Record<string, string> = {
  instapay: 'انستاباي',
  vodafone_cash: 'فودافون كاش',
};

export function ActivationsTab({ ownerUid }: { ownerUid: string }) {
  const [items, setItems] = useState<PendingActivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>({});
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const key = (a: PendingActivation) => `${a.clinicId}:${a.paymentIndex}`;

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listPendingActivations());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التحميل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function approve(a: PendingActivation) {
    const k = key(a);
    setBusy(k);
    try {
      await activateSubscription({
        clinicId: a.clinicId,
        plan: plans[k] ?? 'annual',
        reviewedBy: ownerUid,
        paymentIndex: a.paymentIndex,
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التفعيل');
    } finally {
      setBusy(null);
    }
  }

  async function reject(a: PendingActivation) {
    const k = key(a);
    const note = (rejectNote[k] ?? '').trim();
    if (!note) {
      setError('اكتب سبب الرفض أولًا');
      return;
    }
    setBusy(k);
    try {
      await rejectActivation({
        clinicId: a.clinicId,
        paymentIndex: a.paymentIndex,
        reviewedBy: ownerUid,
        note,
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الرفض');
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
      {items.length === 0 && (
        <p className="p-4 text-center text-sm text-slate-500">
          لا توجد طلبات تفعيل معلقة.
        </p>
      )}
      {items.map((a) => {
        const k = key(a);
        return (
          <div
            key={k}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="font-bold">{a.clinicName}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">الطريقة</dt>
                <dd className="font-bold">
                  {METHOD_LABELS[a.payment.method] ?? a.payment.method}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">المبلغ</dt>
                <dd className="font-bold">
                  {a.payment.amount} {a.payment.currency}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">رقم العملية</dt>
                <dd className="font-mono font-bold" dir="ltr">
                  {a.payment.reference}
                </dd>
              </div>
              {a.payment.note && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">ملاحظة</dt>
                  <dd>{a.payment.note}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={plans[k] ?? 'annual'}
                onChange={(e) =>
                  setPlans((p) => ({
                    ...p,
                    [k]: e.target.value as SubscriptionPlan,
                  }))
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {(Object.keys(PLAN_LABELS) as SubscriptionPlan[]).map((pl) => (
                  <option key={pl} value={pl}>
                    {PLAN_LABELS[pl]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void approve(a)}
                disabled={busy === k}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white"
              >
                {busy === k ? '…' : 'تفعيل'}
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={rejectNote[k] ?? ''}
                onChange={(e) =>
                  setRejectNote((m) => ({ ...m, [k]: e.target.value }))
                }
                placeholder="سبب الرفض…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                onClick={() => void reject(a)}
                disabled={busy === k}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800"
              >
                رفض
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
