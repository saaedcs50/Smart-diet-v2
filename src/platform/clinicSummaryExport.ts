import type { PatientDoc, StaffEntry } from './firestore';
import type { PatientProgressSummary } from './patientProgressSummary';
import {
  buildCsvFromSheets,
  buildXlsxFromSheets,
  type ExportCell,
  type ExportSheet,
} from './doctorExports';

export interface ClinicSummaryExportPatient {
  uid: string;
  doc: PatientDoc;
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A deliberately minimal clinic-level export. It contains operational
 * summaries only: no notes, diagnoses, raw meal records, or full day logs.
 */
export function buildClinicSummarySheets(
  patients: ClinicSummaryExportPatient[],
  staff: StaffEntry[],
  progressByUid: Record<string, PatientProgressSummary>,
): ExportSheet[] {
  const nameByUid = new Map(
    staff.map((member) => [
      member.uid,
      member.doc.displayName || member.doc.email || 'طبيب بلا اسم',
    ]),
  );

  const rows: ExportCell[][] = [[
    'اسم المريض',
    'الطبيب المعين',
    'حالة الخطة',
    'آخر تسجيل',
    'أيام منذ آخر تسجيل',
    'حالة النشاط',
    'وزن البداية (كجم)',
    'آخر وزن مسجل خلال 30 يومًا (كجم)',
    'الوزن المستهدف (كجم)',
    'الفرق عن وزن البداية (كجم)',
    'هدف الماء اليومي (مل)',
    'الماء في أحدث سجل (مل)',
    'متوسط إكمال الوجبات/المهام آخر 7 أيام (%)',
    'عدد الأيام القابلة للمقارنة',
  ]];

  for (const patient of patients) {
    const summary = progressByUid[patient.uid];
    const plan = patient.doc.plan;
    const assignedDoctor = patient.doc.invitedBy
      ? nameByUid.get(patient.doc.invitedBy) ?? 'طبيب غير موجود في قائمة العيادة'
      : 'غير معيّن';
    const activityStatus = !summary
      ? 'المؤشرات غير متاحة'
      : !summary.hasLogWithin30Days
        ? 'لا سجل خلال 30 يومًا'
        : summary.needsFollowUp
          ? 'يحتاج متابعة — آخر سجل منذ 3 أيام أو أكثر'
          : 'نشط خلال 30 يومًا';

    rows.push([
      patient.doc.profile.clientName,
      assignedDoctor,
      plan ? 'لديه خطة سحابية' : 'بلا خطة سحابية',
      summary?.lastLogDate ?? '',
      summary?.daysSinceLastLog ?? '',
      activityStatus,
      safeNumber(plan?.startWeight),
      safeNumber(summary?.currentWeightKg),
      safeNumber(plan?.targetWeight),
      safeNumber(summary?.weightChangeKg),
      safeNumber(plan?.dailyWaterGoalMl ?? plan?.waterGoalMl),
      safeNumber(summary?.currentWaterMl),
      safeNumber(summary?.completion7d),
      summary?.completionDays7d ?? 0,
    ]);
  }

  return [{ name: 'ملخص العيادة', rows }];
}

export function buildClinicSummaryCsv(
  patients: ClinicSummaryExportPatient[],
  staff: StaffEntry[],
  progressByUid: Record<string, PatientProgressSummary>,
): string {
  return buildCsvFromSheets(buildClinicSummarySheets(patients, staff, progressByUid));
}

export function buildClinicSummaryXlsx(
  patients: ClinicSummaryExportPatient[],
  staff: StaffEntry[],
  progressByUid: Record<string, PatientProgressSummary>,
): Uint8Array {
  return buildXlsxFromSheets(buildClinicSummarySheets(patients, staff, progressByUid));
}
