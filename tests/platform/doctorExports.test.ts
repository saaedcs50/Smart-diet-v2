import { describe, expect, it } from 'vitest';
import type { DayLog, PlanConfig } from '../../src/types';
import type { PatientDoc } from '../../src/platform/firestore';
import {
  buildDoctorCsv,
  buildDoctorPdfHtml,
  buildDoctorExportSheets,
  buildDoctorXlsx,
  type DoctorExportPatient,
} from '../../src/platform/doctorExports';

function fixture(name = 'Patient A'): DoctorExportPatient {
  const plan = {
    clientName: name,
    adminPin: '9876',
    dailyWaterGoalMl: 2200,
    heightCm: 170,
    startWeight: 85,
    targetWeight: 70,
    targetWaist: 80,
    freezeDaysPerMonth: 2,
    scoreWeights: {},
    meals: [{ name: 'Breakfast', items: 'Eggs and toast' }],
    checklist: [{ label: 'Drink water' }],
    supplements: [],
    tips: [],
    symptomsList: [],
    targetCalories: 1800,
    targetProtein: 110,
    targetCarbs: 190,
    targetFats: 60,
    medicalConditions: { notes: 'Synthetic condition' },
    medicationPlan: { notes: 'Synthetic medication' },
  } as unknown as PlanConfig;
  const log = {
    water: 1800,
    waterLogs: 4,
    sleep: '23:00',
    wake: '07:00',
    sleepHours: 8,
    quality: 'good',
    meals: { breakfast: { type: 'default', eval: 'yes' } },
    checks: { water: true },
    supps: { vitamin: false },
    medications: {},
    cycleDay: {},
    notes: 'Synthetic daily note',
    weight: 82.5,
    meas: { waist: 90, chest: null, hips: null, arm: null, thigh: null, neck: null },
    symptoms: { headache: false },
    symNotes: '',
    mood: 4,
    exercise: 30,
    isFreeze: false,
    consumedCalories: 1700,
    consumedProtein: 100,
    consumedCarbs: 180,
    consumedFats: 55,
    completedFastingHours: 12,
    isFasting: true,
  } as unknown as DayLog;
  const doc = {
    clinicId: 'clinic-test',
    profile: { clientName: name },
    plan,
    invitedBy: 'coach-test',
  } as PatientDoc;
  return {
    uid: 'patient-test-uid',
    doc,
    entries: [{ date: '2026-11-08', log }],
  };
}

describe('doctor data exports', () => {
  it('builds patient and daily-log sheets and redacts legacy admin PIN', () => {
    const sheets = buildDoctorExportSheets([fixture()]);
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Patients', 'Daily Logs']);

    const patientHeader = sheets[0].rows[0];
    const fullPlanIndex = patientHeader.indexOf('Full plan JSON (admin PIN removed)');
    expect(fullPlanIndex).toBeGreaterThan(-1);
    const exportedPlan = JSON.parse(String(sheets[0].rows[1][fullPlanIndex])) as Record<string, unknown>;
    expect(exportedPlan.adminPin).toBeUndefined();
    expect(exportedPlan.clientName).toBe('Patient A');

    const dailyHeader = sheets[1].rows[0];
    const fullLogIndex = dailyHeader.indexOf('Full day log JSON');
    expect(fullLogIndex).toBeGreaterThan(-1);
    const exportedLog = JSON.parse(String(sheets[1].rows[1][fullLogIndex])) as Record<string, unknown>;
    expect(exportedLog.weight).toBe(82.5);
    expect(exportedLog.notes).toBe('Synthetic daily note');
  });

  it('quotes CSV fields and neutralizes spreadsheet formulas', () => {
    const csv = buildDoctorCsv([fixture('=HYPERLINK("https://evil.example","click")')]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"'=HYPERLINK(""https://evil.example"",""click"")"');
    expect(csv).toContain('2026-11-08');
  });

  it('creates an uncompressed OpenXML workbook ZIP with two worksheets', () => {
    const bytes = buildDoctorXlsx([fixture()]);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const archiveText = new TextDecoder().decode(bytes);
    expect(archiveText).toContain('[Content_Types].xml');
    expect(archiveText).toContain('xl/worksheets/sheet1.xml');
    expect(archiveText).toContain('xl/worksheets/sheet2.xml');
    expect(archiveText).toContain('Full plan JSON (admin PIN removed)');
    expect(archiveText).not.toContain('9876');
  });

  it('escapes patient-controlled HTML and includes the print-to-PDF action', () => {
    const html = buildDoctorPdfHtml([fixture('<img src=x onerror=alert(1)>')], 'Clinic', 'Doctor');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('window.print()');
    expect(html).toContain('Synthetic daily note');
  });
});
