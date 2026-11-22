import { EmptyState } from '../components/EmptyState';
import type { PatientFollowUpCandidate } from './patientFollowUpQueue';
import { buildPatientFollowUpQueue } from './patientFollowUpQueue';

export function PatientFollowUpQueue({
  candidates,
  loading,
  error,
  onOpenPatient,
}: {
  candidates: PatientFollowUpCandidate[];
  loading: boolean;
  error: string | null;
  onOpenPatient: (patientUid: string) => void;
}) {
  const visible = buildPatientFollowUpQueue(candidates, 8);
  const total = candidates.filter((candidate) => candidate.progress?.needsFollowUp === true).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">مرضى يحتاجون متابعة</h2>
          <p className="mt-1 text-xs text-slate-500">
            لا يوجد سجل خلال آخر 30 يومًا، أو مضت 3 أيام فأكثر على آخر سجل.
          </p>
        </div>
        {!loading && !error && (
          <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">
            {total} مريض
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">جاري تحميل مؤشرات المتابعة…</p>
      ) : error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-red-600">
          تعذّر تحميل قائمة المتابعة: {error}
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="لا يوجد مرضى يحتاجون متابعة حاليًا"
          description="ستظهر هنا الحالات التي لم تسجل منذ 3 أيام أو أكثر."
          className="mt-3"
        />
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-2">
            {visible.map((patient) => {
              const days = patient.progress?.daysSinceLastLog ?? null;
              const lastLog = patient.progress?.lastLogDate;
              return (
                <li key={patient.uid}>
                  <button
                    type="button"
                    onClick={() => onOpenPatient(patient.uid)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-right hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {patient.name || 'مريض'}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                        {days == null ? 'لا سجل خلال 30 يومًا' : 'آخر سجل منذ ' + days + ' أيام'}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {lastLog ? 'آخر تسجيل: ' + lastLog : 'لا يوجد تاريخ تسجيل حديث'}
                      {patient.progress?.completion7d != null
                        ? ' · إكمال آخر 7 أيام: ' + patient.progress.completion7d + '%'
                        : ''}
                    </span>
                    {patient.doctorName && (
                      <span className="mt-1 block text-[11px] text-slate-500">
                        الطبيب المسؤول: {patient.doctorName}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {total > visible.length && (
            <p className="mt-2 text-[11px] text-slate-500">
              تظهر أكثر {visible.length} حالات تأخرًا أولًا؛ افتح قائمة المرضى لعرض الباقي.
            </p>
          )}
        </>
      )}
    </section>
  );
}
