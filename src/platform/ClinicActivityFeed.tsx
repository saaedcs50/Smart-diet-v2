import { EmptyState } from '../components/EmptyState';
import type { ClinicActivityEvent } from './clinicActivityFeed';

const dateTime = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateOnly = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
});

function activityLabel(kind: ClinicActivityEvent['kind']): string {
  switch (kind) {
    case 'patient_created': return 'ملف مريض جديد';
    case 'plan_saved': return 'تم إعداد / تحديث الخطة';
    case 'daily_log': return 'سجل يومي جديد';
  }
}

export function ClinicActivityFeed({
  events,
  loading,
  error,
  onOpenPatient,
}: {
  events: ClinicActivityEvent[];
  loading: boolean;
  error: string | null;
  onOpenPatient: (patientUid: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">تغذية نشاط العيادة</h2>
          <p className="mt-1 text-xs text-slate-500">
            الملفات الجديدة، حفظ الخطط، والسجلات اليومية من بيانات العيادة المتاحة.
          </p>
        </div>
        {!loading && <span className="text-xs tabular-nums text-slate-500">{events.length} حدث</span>}
      </div>

      {error && (
        <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          تعذّر تحميل بعض أحداث السجلات اليومية؛ الأحداث الأخرى المعروفة ما زالت معروضة.
        </p>
      )}

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">جاري تحميل النشاط…</p>
      ) : events.length === 0 ? (
        <EmptyState
          title="لا توجد أحداث حديثة بعد"
          description="ستظهر هنا الملفات الجديدة والخطط المحفوظة والسجلات اليومية."
          className="mt-3"
        />
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {events.map((event) => (
            <li key={event.id} className="py-3">
              <button
                type="button"
                onClick={() => onOpenPatient(event.patientUid)}
                className="w-full text-right hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {event.patientName}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {activityLabel(event.kind)}
                  </span>
                </span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  {event.dateOnly
                    ? dateOnly.format(new Date(event.occurredAt))
                    : dateTime.format(new Date(event.occurredAt))}
                </span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  الطبيب المسؤول: {event.assignedDoctorName ?? 'غير محدد'}
                  {event.actorName ? ' · المحرر: ' + event.actorName : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] leading-5 text-slate-500">
        يعرض هذا القسم الأحداث التي لها تاريخ محفوظ صريح. لا يستنتج تغييرات الخطط من تعديل الوسوم أو بيانات الملف، ولا يصنّف تغيّر الوزن طبيًا.
      </p>
    </section>
  );
}
