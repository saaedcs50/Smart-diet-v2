import { useEffect, useState } from 'react';
import type { PatientDoc } from './database';
import {
  listRecentDayLogDetails,
  type RecentDayLogDetail,
} from './database';
import {
  listPatientJournalComments,
  type PatientJournalComment,
} from './patientJournalComments';
import {
  listPatientReflections,
  type PatientReflectionRecord,
} from './patientReflections';
import {
  listPatientIntakes,
  type PatientIntakeRecord,
} from './patientIntakes';
import {
  listPatientAppointmentHistory,
  type PatientAppointmentHistory,
} from './appointments';
import { appointmentStatusLabel, appointmentVisitTypeLabel } from './appointmentUtils';

interface PatientHubItem {
  uid: string;
  doc: PatientDoc;
}

interface PatientQuickHubProps {
  patient: PatientHubItem;
  onClose: () => void;
}

interface PatientHubData {
  logs: RecentDayLogDetail[];
  comments: PatientJournalComment[];
  reflections: PatientReflectionRecord[];
  intakes: PatientIntakeRecord[];
  appointments: PatientAppointmentHistory;
}

const EMPTY_DATA: PatientHubData = {
  logs: [],
  comments: [],
  reflections: [],
  intakes: [],
  appointments: { upcoming: [], past: [] },
};

function dateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function dateTimeLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-100">{children}</h3>;
}

function PatientQuickHub({ patient, onClose }: PatientQuickHubProps) {
  const [data, setData] = useState<PatientHubData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrors([]);

    void Promise.allSettled([
      listRecentDayLogDetails([patient.uid], 4),
      listPatientJournalComments(patient.uid),
      // Staff only receive reflections explicitly shared by the patient.
      listPatientReflections(patient.uid, true),
      listPatientIntakes(patient.uid),
      listPatientAppointmentHistory(patient.uid),
    ]).then((results) => {
      if (!active) return;
      const [logs, comments, reflections, intakes, appointments] = results;
      const failureLabels = [
        'السجلات اليومية',
        'تعليقات العيادة',
        'اليوميات المشتركة',
        'الاستبيانات',
        'المواعيد',
      ];
      setErrors(results.flatMap((result, index) =>
        result.status === 'rejected' ? [failureLabels[index]] : [],
      ));
      setData({
        logs: logs.status === 'fulfilled' ? logs.value : [],
        comments: comments.status === 'fulfilled' ? comments.value : [],
        reflections: reflections.status === 'fulfilled' ? reflections.value : [],
        intakes: intakes.status === 'fulfilled' ? intakes.value : [],
        appointments: appointments.status === 'fulfilled'
          ? appointments.value
          : { upcoming: [], past: [] },
      });
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [patient.uid]);

  const plan = patient.doc.plan;
  const labs = (plan?.labTracking?.entries ?? [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const recentComments = data.comments.slice(0, 3);
  const recentReflections = data.reflections.slice(0, 3);
  const nextAppointment = data.appointments.upcoming[0] ?? null;
  const latestIntake = data.intakes[0] ?? null;

  return (
    <article
      dir="rtl"
      aria-label={`ملف سريع: ${patient.doc.profile.clientName}`}
      className="flex max-h-[72vh] w-[min(22rem,calc(100vw-1.5rem))] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-sky-700 dark:text-sky-300">Client Hub</p>
          <h2 className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-slate-100">
            {patient.doc.profile.clientName || 'ملف المريض'}
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {patient.doc.tags?.length ? patient.doc.tags.map((tag) => tag.label).join(' · ') : 'ملف مختصر للمتابعة'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized((value) => !value)}
            aria-label={minimized ? 'توسيع الملف السريع' : 'تصغير الملف السريع'}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {minimized ? 'توسيع' : 'تصغير'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الملف السريع"
            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            إغلاق
          </button>
        </div>
      </header>

      {!minimized && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-xs">
          {errors.length > 0 && (
            <p role="status" className="rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              بعض أقسام الملف غير متاحة الآن: {errors.join('، ')}.
            </p>
          )}

          <section className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <SectionHeading>ملخص الخطة</SectionHeading>
            {plan ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-500">الوزن</p>
                  <p className="mt-1 font-black">{plan.startWeight ?? '—'} ← {plan.targetWeight ?? '—'} كجم</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-500">هدف الماء</p>
                  <p className="mt-1 font-black">{plan.dailyWaterGoalMl ?? '—'} مل</p>
                </div>
                {plan.targetCalories != null && (
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                    <p className="text-[10px] text-slate-500">السعرات المحددة</p>
                    <p className="mt-1 font-black">{plan.targetCalories} سعرة</p>
                  </div>
                )}
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-500">آخر تحديث للخطة</p>
                  <p className="mt-1 font-black">{dateLabel(patient.doc.planUpdatedAt)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">لا توجد خطة محفوظة بعد.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading>السجلات اليومية</SectionHeading>
              <span className="text-[10px] text-slate-500">{data.logs.length} حديثة</span>
            </div>
            {loading ? (
              <p className="mt-2 text-[10px] text-slate-500">جارٍ التحميل…</p>
            ) : data.logs.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {data.logs.map((entry) => {
                  const plannedMeals = plan?.meals?.length ?? 0;
                  const recordedMeals = Object.values(entry.log.meals ?? {}).filter((meal) =>
                    meal.type === 'default' || meal.type === 'alt' || meal.eval === 'yes',
                  ).length;
                  return (
                    <li key={entry.date} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <p className="font-bold">{dateLabel(entry.date)}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        الوزن: {entry.log.weight ?? '—'} كجم · الماء: {entry.log.water ?? '—'} مل
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        الوجبات المسجلة: {recordedMeals}/{plannedMeals || '—'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">لا توجد سجلات يومية حديثة.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading>المواعيد</SectionHeading>
              <span className="text-[10px] text-slate-500">{data.appointments.upcoming.length} قادمة · {data.appointments.past.length} سابقة</span>
            </div>
            {nextAppointment ? (
              <p className="mt-2 text-[10px] leading-5">
                الموعد القادم: <strong>{dateTimeLabel(nextAppointment.starts_at)}</strong>
                <span className="block text-slate-500">{appointmentVisitTypeLabel(nextAppointment.visit_type)} · {appointmentStatusLabel(nextAppointment.status)}</span>
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">لا يوجد موعد قادم مسجل.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <SectionHeading>النماذج والاستبيانات</SectionHeading>
            {latestIntake ? (
              <p className="mt-2 text-[10px] leading-5">
                آخر استبيان: <strong>{latestIntake.status === 'reviewed' ? 'تمت مراجعته' : 'بانتظار المراجعة'}</strong>
                <span className="block text-slate-500">{dateTimeLabel(latestIntake.submitted_at)}</span>
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">لا توجد استبيانات مرسلة.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading>ملاحظات العيادة واليوميات المشتركة</SectionHeading>
              <span className="text-[10px] text-slate-500">{recentComments.length + recentReflections.length}</span>
            </div>
            {recentComments.length === 0 && recentReflections.length === 0 ? (
              <p className="mt-2 text-[10px] text-slate-500">لا توجد ملاحظات أو يوميات شاركها المريض.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {recentComments.map((comment) => (
                  <li key={comment.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                    <p className="whitespace-pre-wrap break-words text-[10px] leading-5">{comment.content}</p>
                    <p className="mt-1 text-[9px] text-slate-500">ملاحظة العيادة · {dateTimeLabel(comment.created_at)}</p>
                  </li>
                ))}
                {recentReflections.map((reflection) => (
                  <li key={reflection.id} className="rounded-lg bg-emerald-50/70 p-2 dark:bg-emerald-950/20">
                    {reflection.content && <p className="whitespace-pre-wrap break-words text-[10px] leading-5">{reflection.content}</p>}
                    {reflection.symptoms && <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-5"><strong>ملاحظات جسدية:</strong> {reflection.symptoms}</p>}
                    <p className="mt-1 text-[9px] text-slate-500">يومية شاركها المريض · {dateLabel(reflection.entry_date)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading>نتائج المختبر</SectionHeading>
              <span className="text-[10px] text-slate-500">{labs.length} حديثة</span>
            </div>
            {labs.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {labs.map((lab) => (
                  <li key={lab.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                    <span className="min-w-0 truncate text-[10px]">{lab.customName || lab.testId}</span>
                    <strong dir="ltr" className="shrink-0 text-[10px]">{lab.value} {lab.unit}</strong>
                    <span className="shrink-0 text-[9px] text-slate-500">{dateLabel(lab.date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">لا توجد نتائج مختبر مسجلة.</p>
            )}
          </section>

          {loading && <p className="text-center text-[10px] text-slate-400">جارٍ تحميل بقية أقسام الملف…</p>}
        </div>
      )}
    </article>
  );
}

export function PatientQuickHubDock({
  patients,
  openPatientUids,
  onClose,
}: {
  patients: PatientHubItem[];
  openPatientUids: string[];
  onClose: (patientUid: string) => void;
}) {
  if (openPatientUids.length === 0) return null;
  const patientByUid = new Map(patients.map((patient) => [patient.uid, patient]));

  return (
    <div
      dir="rtl"
      aria-label="ملفات المرضى السريعة المفتوحة"
      className="fixed bottom-3 right-3 z-[80] flex max-w-[calc(100vw-1.5rem)] gap-3 overflow-x-auto pb-2 lg:right-4 lg:max-w-[calc(100vw-2rem)]"
    >
      {openPatientUids.map((patientUid) => {
        const patient = patientByUid.get(patientUid);
        if (!patient) return null;
        return (
          <PatientQuickHub
            key={patientUid}
            patient={patient}
            onClose={() => onClose(patientUid)}
          />
        );
      })}
    </div>
  );
}
