import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAllClinics, type ClinicSummary } from '../owner';
import type { PaymentRecord } from '../firestore';

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

interface HistoryItem {
  key: string;
  clinicName: string;
  payment: PaymentRecord;
  status: Exclude<Filter, 'all'>;
}

function paymentStatus(payment: PaymentRecord): HistoryItem['status'] {
  if (payment.reviewedAt == null) return 'pending';
  return payment.note?.trim().startsWith('مرفوض:') ? 'rejected' : 'approved';
}

function displayDate(value: unknown): string {
  if (typeof value !== 'string') return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

const STATUS: Record<HistoryItem['status'], { label: string; classes: string }> = {
  pending: { label: 'معلّق', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  approved: { label: 'معتمد', classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  rejected: { label: 'مرفوض', classes: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
};

export function PaymentHistoryTab() {
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setClinics(await listAllClinics());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تحميل سجل المدفوعات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const items = useMemo(() => {
    const rows: HistoryItem[] = [];
    clinics.forEach((clinic) => {
      (clinic.subscription?.payments ?? []).forEach((payment, index) => {
        rows.push({
          key: `${clinic.id}:${index}`,
          clinicName: clinic.name,
          payment,
          status: paymentStatus(payment),
        });
      });
    });
    return rows.sort((a, b) => {
      const aTime = a.payment.submittedAt ? new Date(a.payment.submittedAt).getTime() : 0;
      const bTime = b.payment.submittedAt ? new Date(b.payment.submittedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [clinics]);

  const filtered = filter === 'all' ? items : items.filter((item) => item.status === filter);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
  }), [items]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">سجل المدفوعات</h2>
          <p className="mt-1 text-xs text-slate-500">سجل طلبات الدفع المرسلة من أصحاب العيادات ومراجعتها.</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700 disabled:opacity-50"
        >
          {loading ? 'جارٍ التحديث…' : 'تحديث'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'الكل'],
          ['pending', 'معلّق'],
          ['approved', 'معتمد'],
          ['rejected', 'مرفوض'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === key ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-slate-500">جارٍ تحميل السجل…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          لا توجد سجلات في هذا التصنيف.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {filtered.map((item) => (
            <article key={item.key} className="grid gap-2 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800 md:grid-cols-[1.3fr_1fr_1fr_1fr] md:items-center">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">{item.clinicName}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {item.payment.method === 'instapay' ? 'انستاباي' : 'فودافون كاش'} · {displayDate(item.payment.submittedAt)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">المبلغ</p>
                <p className="font-black tabular-nums">{new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(item.payment.amount) || 0)} {item.payment.currency || 'EGP'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">مرجع العملية</p>
                <p className="break-all font-mono text-sm" dir="ltr">{item.payment.reference || '—'}</p>
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[item.status].classes}`}>{STATUS[item.status].label}</span>
                {item.payment.reviewedAt && <span className="text-[11px] text-slate-500">{displayDate(item.payment.reviewedAt)}</span>}
              </div>
              {item.status === 'rejected' && item.payment.note && (
                <p className="text-xs text-red-700 dark:text-red-300 md:col-span-4">{item.payment.note}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
