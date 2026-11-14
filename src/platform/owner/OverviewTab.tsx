import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAllClinics, type ClinicSummary } from '../owner';
import { EmptyState } from '../../components/EmptyState';
import {
  daysRemaining,
  parseDashboardDate,
  summarizeOwnerDashboard,
} from '../ownerDashboard';

const money = new Intl.NumberFormat('ar-EG', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type OwnerTab = 'clinics' | 'activations' | 'new' | 'paymentHistory' | 'payments';

function Metric({
  label,
  value,
  note,
  onClick,
}: {
  label: string;
  value: string | number;
  note: string;
  onClick?: () => void;
}) {
  const classes =
    'rounded-2xl border border-slate-200 bg-white p-4 text-right dark:border-slate-800 dark:bg-slate-900';
  const content = (
    <>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${classes} w-full hover:border-indigo-300 hover:shadow-sm`}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}

export function OverviewTab({ onNavigate }: { onNavigate: (tab: OwnerTab) => void }) {
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setClinics(await listAllClinics());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تحميل مؤشرات المنصة');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const summary = useMemo(() => summarizeOwnerDashboard(clinics), [clinics]);
  const maxMonthlyAmount = Math.max(
    1,
    ...summary.monthlyApprovedPayments.map((month) => month.amount),
  );

  const soonExpiring = clinics
    .filter((clinic) => {
      if (
        clinic.status === 'suspended' ||
        clinic.subscription?.status !== 'active' ||
        clinic.subscription.plan === 'permanent'
      ) return false;
      const remaining = daysRemaining(clinic.subscription.expiresAt);
      return remaining != null && remaining >= 0 && remaining <= 30;
    })
    .sort((a, b) => {
      const aDays = daysRemaining(a.subscription?.expiresAt) ?? 9999;
      const bDays = daysRemaining(b.subscription?.expiresAt) ?? 9999;
      return aDays - bDays;
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">نظرة عامة على المنصة</h2>
          <p className="mt-1 text-xs text-slate-500">مؤشرات فعلية من قاعدة البيانات — لا توجد أرقام تجريبية أو تقديرية.</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700 disabled:opacity-50"
        >
          {loading ? 'جارٍ التحديث…' : 'تحديث البيانات'}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="إجمالي العيادات" value={loading ? '—' : summary.totalClinics} note="كل العيادات المسجلة" onClick={() => onNavigate('clinics')} />
        <Metric label="اشتراكات نشطة" value={loading ? '—' : summary.activeSubscriptions} note="لا تشمل العيادات الموقوفة" onClick={() => onNavigate('clinics')} />
        <Metric label="طلبات دفع معلّقة" value={loading ? '—' : summary.pendingPaymentCount} note="تحتاج مراجعة المالك" onClick={() => onNavigate('activations')} />
        <Metric label="تنتهي خلال 30 يومًا" value={loading ? '—' : summary.expiringWithin30Days} note="اشتراكات شهرية أو سنوية" onClick={() => onNavigate('clinics')} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="في فترة السماح" value={loading ? '—' : summary.graceSubscriptions} note="وفق حالة الاشتراك المسجلة" />
        <Metric label="منتهية / بلا اشتراك" value={loading ? '—' : summary.expiredOrUnsubscribed} note="تحتاج تفعيلًا أو تجديدًا" />
        <Metric label="موقوفة إداريًا" value={loading ? '—' : summary.suspendedClinics} note="إيقاف مستقل عن الاشتراك" />
        <Metric label="مدفوعات معتمدة خلال 6 أشهر" value={loading ? '—' : money.format(summary.approvedPaymentsLastSixMonths)} note="من طلبات الدفع التي راجعها المالك" onClick={() => onNavigate('paymentHistory')} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black text-slate-900 dark:text-slate-100">المدفوعات المعتمدة — آخر 6 أشهر</h3>
            <span className="text-[11px] text-slate-500">جنيه مصري</span>
          </div>
          {summary.approvedPaymentsLastSixMonths === 0 ? (
            <EmptyState
              title="لا توجد مدفوعات معتمدة بعد"
              description="ستظهر حركة التحصيل هنا بعد اعتماد أول عملية دفع."
              className="mt-4"
            />
          ) : (
            <div className="mt-5 flex h-40 items-end gap-2">
              {summary.monthlyApprovedPayments.map((month) => {
                const height = month.amount > 0
                  ? Math.max(8, (month.amount / maxMonthlyAmount) * 124)
                  : 3;
                return (
                  <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="max-w-full truncate text-[10px] tabular-nums text-slate-500">
                      {month.amount > 0 ? money.format(month.amount) : '—'}
                    </span>
                    <div className="flex h-32 w-full items-end rounded-t-lg bg-slate-100 dark:bg-slate-800">
                      <div
                        className="w-full rounded-t-lg bg-indigo-600"
                        style={{ height: `${height}px` }}
                        title={money.format(month.amount)}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">{month.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            الإجمالي محسوب من سجلات الدفع التي تحمل تاريخ مراجعة ولم تُسجّل كمرفوضة. التجديد اليدوي دون سجل دفع لا يدخل في هذا المؤشر.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black text-slate-900 dark:text-slate-100">متابعة الاشتراكات</h3>
            <button type="button" onClick={() => onNavigate('clinics')} className="text-xs font-bold text-indigo-700 dark:text-indigo-300">فتح العيادات</button>
          </div>
          {soonExpiring.length === 0 ? (
            <EmptyState
              title="لا توجد اشتراكات قاربت على الانتهاء"
              description="لا توجد اشتراكات نشطة تنتهي خلال الثلاثين يومًا القادمة."
              className="mt-3"
            />
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {soonExpiring.map((clinic) => {
                const left = daysRemaining(clinic.subscription?.expiresAt);
                const expiryDate = parseDashboardDate(clinic.subscription?.expiresAt);
                return (
                  <li key={clinic.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{clinic.name}</p>
                      <p className="text-xs text-slate-500">{expiryDate ? dateTime.format(expiryDate) : 'تاريخ الانتهاء غير متاح'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      {left} يوم
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-slate-900 dark:text-slate-100">طلبات الدفع المعلّقة</h3>
            <p className="mt-1 text-xs text-slate-500">أحدث الطلبات المسجلة التي لم يراجعها المالك.</p>
          </div>
          <button type="button" onClick={() => onNavigate('activations')} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">
            مراجعة الطلبات
          </button>
        </div>
        {summary.pendingPayments.length === 0 ? (
          <EmptyState
            title="لا توجد طلبات دفع معلّقة"
            description="جميع الطلبات المسجلة تمت مراجعتها أو لا توجد طلبات جديدة."
            className="mt-3"
          />
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {summary.pendingPayments.slice(0, 4).map((request) => {
              const submittedAt = parseDashboardDate(request.payment.submittedAt);
              return (
                <li key={request.key} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{request.clinicName}</p>
                    <span className="text-sm font-black tabular-nums">{money.format(Number(request.payment.amount) || 0)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.payment.method === 'instapay' ? 'انستاباي' : 'فودافون كاش'}
                    {submittedAt ? ` — ${dateTime.format(submittedAt)}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-black text-slate-900 dark:text-slate-100">إجراءات سريعة</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <button type="button" onClick={() => onNavigate('new')} className="rounded-xl bg-indigo-600 px-3 py-3 text-sm font-bold text-white">إنشاء عيادة</button>
          <button type="button" onClick={() => onNavigate('clinics')} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold dark:border-slate-700">إدارة العيادات</button>
          <button type="button" onClick={() => onNavigate('activations')} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold dark:border-slate-700">طلبات التفعيل</button>
          <button type="button" onClick={() => onNavigate('payments')} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold dark:border-slate-700">وسائل الدفع</button>
        </div>
      </section>
    </div>
  );
}
