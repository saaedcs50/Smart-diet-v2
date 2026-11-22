import { useEffect, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import {
  appointmentChannelLabel,
  appointmentStatusLabel,
  appointmentVisitTypeLabel,
} from './appointmentUtils';
import {
  listPatientAppointmentHistory,
  type PatientAppointmentHistory,
  type AppointmentRecord,
} from './appointments';

const statusClass: Record<AppointmentRecord['status'], string> = {
  scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  no_show: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function AppointmentList({
  title,
  items,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  items: AppointmentRecord[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h3>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} className="mt-2" />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {formatDateTime(item.starts_at)}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {appointmentVisitTypeLabel(item.visit_type)} · {appointmentChannelLabel(item.channel)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  حتى {new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.ends_at))}
                </p>
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass[item.status]}`}>
                {appointmentStatusLabel(item.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PatientAppointmentsPanel({ patientUid }: { patientUid: string }) {
  const [history, setHistory] = useState<PatientAppointmentHistory>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listPatientAppointmentHistory(patientUid)
      .then((result) => {
        if (!active) return;
        setHistory(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'تعذّر تحميل المواعيد.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientUid]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">مواعيدي</h2>
        <p className="mt-1 text-xs text-slate-500">
          المواعيد المسجلة باسمك فقط. يعرض هذا القسم أقرب 10 مواعيد خلال السنة القادمة وآخر 10 مواعيد خلال السنة الماضية.
        </p>
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">جارٍ تحميل مواعيدك…</p>
      ) : error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <AppointmentList
            title="المواعيد القادمة"
            items={history.upcoming}
            emptyTitle="لا توجد مواعيد قادمة"
            emptyDescription="ستظهر هنا المواعيد التي تسجلها العيادة لك."
          />
          <AppointmentList
            title="سجل المواعيد السابقة"
            items={history.past}
            emptyTitle="لا توجد مواعيد سابقة"
            emptyDescription="سيظهر هنا سجل زياراتك السابقة بعد تسجيلها في العيادة."
          />
        </div>
      )}
    </section>
  );
}
