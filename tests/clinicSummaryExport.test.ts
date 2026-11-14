import { describe, expect, it } from 'vitest';
import type { PatientDoc, StaffEntry } from '../src/platform/firestore';
import type { PatientProgressSummary } from '../src/platform/patientProgressSummary';
import {
  buildClinicSummaryCsv,
  buildClinicSummarySheets,
  buildClinicSummaryXlsx,
} from '../src/platform/clinicSummaryExport';

const patients = [
  {
    uid: 'patient-1',
    doc: {
      clinicId: 'clinic-1',
      profile: { clientName: '=2+3' },
      invitedBy: 'coach-1',
      plan: {
        startWeight: 90,
        targetWeight: 80,
        dailyWaterGoalMl: 2000,
        meals: [{ id: 'meal-1' }],
        checklist: [{ id: 'task-1' }],
        medicalConditions: {
          conditions: [{ id: 'test', label: 'private diagnosis' }],
          allergies: ['private allergy'],
          showToClient: false,
        },
        notes: 'private plan note',
        adminPin: 'never-export-this',
      },
    } as unknown as PatientDoc,
  },
];

const staff = [
  {
    uid: 'coach-1',
    doc: {
      role: 'coach',
      clinicId: 'clinic-1',
      displayName: 'د. أحمد',
      email: 'doctor@example.test',
    },
  } as StaffEntry,
];

const progress: Record<string, PatientProgressSummary> = {
  'patient-1': {
    lastLogDate: '2026-11-14',
    daysSinceLastLog: 0,
    hasLogWithin30Days: true,
    needsFollowUp: false,
    completion7d: 75,
    completionDays7d: 3,
    currentWeightKg: 87.5,
    currentWaterMl: 1750,
    weightChangeKg: -2.5,
    weightTargetProgressPercent: 25,
  },
};

describe('clinic summary export', () => {
  it('builds one minimal clinic-level summary row with doctor and operational metrics', () => {
    const sheets = buildClinicSummarySheets(patients, staff, progress);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('ملخص العيادة');

    const [header, row] = sheets[0].rows;
    expect(header).toContain('الطبيب المعين');
    expect(header).toContain('آخر تسجيل');
    expect(header).toContain('الماء في أحدث سجل (مل)');
    expect(header).toContain('متوسط إكمال الوجبات/الماء/المهام آخر 7 أيام (%)');
    expect(row).toContain('د. أحمد');
    expect(row).toContain('2026-11-14');
    expect(row).toContain(1750);
    expect(row).toContain(75);
    expect(row).toContain(-2.5);
  });

  it('does not export diagnoses, allergies, notes, PINs or raw patient logs', () => {
    const csv = buildClinicSummaryCsv(patients, staff, progress);
    expect(csv).not.toContain('private diagnosis');
    expect(csv).not.toContain('private allergy');
    expect(csv).not.toContain('private plan note');
    expect(csv).not.toContain('never-export-this');
    expect(csv).not.toContain('medicalConditions');
    expect(csv).not.toContain('Patient ID');
  });

  it('escapes spreadsheet formulas in patient-controlled text', () => {
    const csv = buildClinicSummaryCsv(patients, staff, progress);
    expect(csv).toContain("'=2+3");
  });

  it('exports an XLSX ZIP workbook', () => {
    const xlsx = buildClinicSummaryXlsx(patients, staff, progress);
    expect(Array.from(xlsx.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('marks missing activity explicitly instead of fabricating a zero score', () => {
    const sheets = buildClinicSummarySheets(patients, staff, {});
    const [header, row] = sheets[0].rows;
    const statusColumn = header.indexOf('حالة النشاط');
    const completionColumn = header.indexOf('متوسط إكمال الوجبات/الماء/المهام آخر 7 أيام (%)');
    expect(row[statusColumn]).toBe('المؤشرات غير متاحة');
    expect(row[completionColumn]).toBeNull();
  });
});
