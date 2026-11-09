import { useState } from 'react';
import {
  listDoctorPatientsForExport,
  listPatientDayLogsForExport,
} from './firestore';
import {
  buildDoctorCsv,
  buildDoctorPdfHtml,
  buildDoctorXlsx,
  downloadExportBlob,
  type DoctorExportPatient,
} from './doctorExports';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

async function loadDoctorExportData(
  clinicId: string,
  coachUid: string,
): Promise<DoctorExportPatient[]> {
  // Re-query on click: never trust a stale list or client-side filter for export scope.
  const assignedPatients = await listDoctorPatientsForExport(clinicId, coachUid);
  const output: DoctorExportPatient[] = [];

  // Limit concurrent queries so a large patient list does not exhaust PostgREST.
  for (let offset = 0; offset < assignedPatients.length; offset += 4) {
    const batch = assignedPatients.slice(offset, offset + 4);
    const results = await Promise.all(batch.map(async (patient) => ({
      ...patient,
      entries: await listPatientDayLogsForExport(patient.uid),
    })));
    output.push(...results);
  }

  return output;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DoctorExportButtons({
  clinicId,
  coachUid,
  doctorName,
}: {
  clinicId: string;
  coachUid: string;
  doctorName: string;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function exportAs(format: ExportFormat): Promise<void> {
    setError(null);
    setNotice(null);
    let printWindow: Window | null = null;

    if (format === 'pdf') {
      // Open synchronously inside the click event so popup blockers do not
      // discard the report while the network requests are loading.
      printWindow = window.open('', '_blank');
      if (!printWindow) {
        setError('اسمح بفتح نافذة التقرير حتى تستطيع طباعته أو حفظه PDF.');
        return;
      }
      printWindow.opener = null;
      printWindow.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تجهيز التقرير</title><body style="font-family:Tahoma;padding:24px">جاري تجهيز التقرير الآمن لمرضى الطبيب…</body></html>');
      printWindow.document.close();
    }

    setBusy(format);
    try {
      const patients = await loadDoctorExportData(clinicId, coachUid);
      if (patients.length === 0) {
        throw new Error('لا يوجد مرضى مرتبطون بحساب الطبيب الحالي للتصدير.');
      }

      const stamp = todayStamp();
      if (format === 'csv') {
        const csv = buildDoctorCsv(patients);
        downloadExportBlob(
          new Blob([csv], { type: 'text/csv;charset=utf-8' }),
          `doctor-patients-${stamp}.csv`,
        );
        setNotice(`تم تجهيز CSV لعدد ${patients.length} مريض.`);
      } else if (format === 'xlsx') {
        const workbook = buildDoctorXlsx(patients);
        downloadExportBlob(
          new Blob([workbook as BlobPart], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          `doctor-patients-${stamp}.xlsx`,
        );
        setNotice(`تم تجهيز Excel لعدد ${patients.length} مريض.`);
      } else if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(buildDoctorPdfHtml(
          patients,
          clinicId,
          doctorName,
        ));
        printWindow.document.close();
        printWindow.focus();
        setNotice('التقرير جاهز. اختر «طباعة / حفظ PDF» من نافذة التقرير.');
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'تعذّر تجهيز ملف التصدير.';
      setError(message);
      if (printWindow && !printWindow.closed) {
        printWindow.document.open();
        printWindow.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>فشل التصدير</title><body style="font-family:Tahoma;padding:24px;color:#b91c1c"></body></html>');
        printWindow.document.close();
        printWindow.document.body.textContent = message;
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
        تصدير بيانات مرضاي
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        يتم جلب مرضاك المعيّنين لحسابك فقط من قاعدة البيانات، مع خططهم وسجلاتهم اليومية. لا يشمل مرضى بقية العيادة.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
          disabled={busy !== null}
          onClick={() => void exportAs('csv')}
        >
          {busy === 'csv' ? 'جاري تجهيز CSV…' : 'تنزيل CSV'}
        </button>
        <button
          type="button"
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => void exportAs('xlsx')}
        >
          {busy === 'xlsx' ? 'جاري تجهيز Excel…' : 'تنزيل Excel'}
        </button>
        <button
          type="button"
          className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => void exportAs('pdf')}
        >
          {busy === 'pdf' ? 'جاري تجهيز PDF…' : 'تقرير PDF / طباعة'}
        </button>
      </div>
      {notice && <p role="status" className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      {busy && <p className="mt-2 text-xs text-slate-500">يتم جمع سجلات المرضى على دفعات. لا تغلق الصفحة أثناء التصدير.</p>}
    </section>
  );
}
