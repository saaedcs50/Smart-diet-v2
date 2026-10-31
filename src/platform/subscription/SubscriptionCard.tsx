// بطاقة الاشتراك في لوحة صاحب العيادة: الخطة وتاريخ الانتهاء والعدّاد.

import { useEffect, useState } from 'react';
import {
  daysUntilExpiry,
  getSubscription,
  type ClinicSubscriptionDoc,
  type SubscriptionPlan,
} from '../subscription';

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  permanent: 'دائم',
  monthly: 'شهري',
  annual: 'سنوي',
};

export function SubscriptionCard({ clinicId }: { clinicId: string }) {
  const [sub, setSub] = useState<ClinicSubscriptionDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getSubscription(clinicId)
      .then((s) => {
        if (!cancelled) {
          setSub(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  if (loading) return null;

  const daysLeft = daysUntilExpiry(sub);
  const status = sub?.status;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-bold">الاشتراك</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">الخطة</dt>
          <dd className="font-bold">
            {sub ? PLAN_LABELS[sub.plan] : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">الحالة</dt>
          <dd className="font-bold">
            {status === 'active'
              ? 'نشط'
              : status === 'grace'
                ? 'فترة سماح'
                : status === 'expired'
                  ? 'منتهي'
                  : '—'}
          </dd>
        </div>
        {daysLeft != null && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">المتبقي</dt>
            <dd
              className={`font-bold ${daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}
            >
              {daysLeft} يوم
            </dd>
          </div>
        )}
        {sub?.plan === 'permanent' && (
          <div className="col-span-2">
            <dd className="font-bold text-emerald-600">دائم — لا ينتهي</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
