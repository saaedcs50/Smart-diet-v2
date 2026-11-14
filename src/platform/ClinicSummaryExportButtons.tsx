import { useState } from 'react';
import type { PatientProgressSummary } from './patientProgressSummary';
import type { StaffEntry } from './firestore';
import {
  buildClinicSummaryCsv,
  buildClinicSummaryXlsx,
  type ClinicSummaryExportPatient,
} from './clinicSummaryExport';
import { downloadExportBlob } from './doctorExports';

type Format = 'csv' | 'xlsx';

function todayStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ClinicSummaryExportButtons({
  clinicId,
  patients,
  staff,
  progressByUid,
  loading,
  progressAvailable,
}: {
  clinicId: string;
  patients: ClinicSummaryExportPatient[];
  staff: StaffEntry[];
  progressByUid: Record<string, PatientProgressSummary>;
  loading: boolean;
  progressAvailable: boolean;
}) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function exportAs(format: Format) {
    setNotice(null);
    setError(null);
    if (patients.length === 0) {
      setError('لا يوجد مرضى في العيادة للتصدير.');
      return;
    }
    if (!progressAvailable) {
      setError('مؤشرات النشاط لم تكتمل؛ حدّث لوحة العيادة ثم أعد التصدير.');
      return;
    }

    setBusy(format);
    try {
      const stamp = todayStamp();
      if (format === 'csv') {
        const csv = buildClinicSummaryCsv(patients, staff, progressByUid);
        downloadExportBlob(
          new Blob([csv], { type: 'text/csv;charset=utf-8' }),
          `clinic-summary-${stamp}.csv`,
        );
      } else {
        const workbook = buildClinicSummaryXlsx(patients, staff, progressByUid);
        downloadExportBlob(
          new Blob([workbook as BlobPart], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          `clinic-summary-${stamp}.xlsx`,
        );
      }
      setNotice(`تم تجهيز ملخص ${patients.length} مريضًا للعيادة ${clinicId}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تجهيز ملخص العيادة.');
    } finally {
      setBusy(null);
    }
  }

  const disabled = loading || busy !== null || !progressAvailable || patients.length === 0;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">تصدير ملخص العيادة</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        CSV أو Excel ببيانات تشغيلية مختصرة: اسم المريض والطبيب والخطة وآخر تسجيل ومؤشرات الوزن والماء وإكمال آخر 7 أيام.
        لا يتضمن اليوميات الكاملة أو الملاحظات أو التشخيصات.
      </p>
      <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
        يحتوي الملف على بيانات صحية شخصية. احفظه في مكان آمن وشاركه مع المصرّح لهم فقط.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
          disabled={disabled}
          onClick={() => exportAs('csv')}
        >
          {busy === 'csv' ? 'جارٍ تجهيز CSV…' : 'تنزيل CSV'}
        </button>
        <button
          type="button"
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          disabled={disabled}
          onClick={() => exportAs('xlsx')}
        >
          {busy === 'xlsx' ? 'جارٍ تجهيز Excel…' : 'تنزيل Excel'}
        </button>
      </div>
      {loading && <p className="mt-2 text-xs text-slate-500">جارٍ تحميل بيانات العيادة…</p>}
      {!loading && !progressAvailable && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">مؤشرات النشاط غير متاحة، لذلك أوقف التصدير لتجنب ملف ناقص.</p>}
      {notice && <p role="status" className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </section>
  );
}
