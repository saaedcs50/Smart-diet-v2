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
    adherenceConfig: {
      axes: [
        { name: 'Meals', weight: 30 },
        { name: 'Advice', weight: 25 },
        { name: 'Water', weight: 25 },
        { name: 'Activity', weight: 20 },
      ],
      updatedBy: 'coach-test',
    },
    adherenceScores: [{
      date: '2026-11-08',
      scores: [80, 70, 90, 100],
      overall: 83.5,
      enteredBy: 'coach-test',
      enteredAt: '2026-11-08T13:00:00.000Z',
      note: 'Synthetic adherence note',
    }],
  };
}



function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntries(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error('ZIP end-of-central-directory not found');

  const count = view.getUint16(endOffset + 10, true);
  let centralOffset = view.getUint32(endOffset + 16, true);
  const files = new Map<string, string>();

  for (let index = 0; index < count; index++) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error('Invalid central directory entry');
    }
    const size = view.getUint32(centralOffset + 24, true);
    const expectedCrc = view.getUint32(centralOffset + 16, true);
    const compression = view.getUint16(centralOffset + 10, true);
    if (compression !== 0) throw new Error('Expected an uncompressed ZIP entry');
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = decoder.decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const fileBytes = bytes.subarray(dataStart, dataStart + size);
    if (crc32(fileBytes) !== expectedCrc) throw new Error(`CRC mismatch for ${name}`);
    files.set(name, decoder.decode(fileBytes));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

describe('doctor data exports', () => {
  it('builds patient and daily-log sheets and redacts legacy admin PIN', () => {
    const sheets = buildDoctorExportSheets([fixture()]);
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Patients', 'Daily Logs', 'Adherence Scores']);

    const patientHeader = sheets[0].rows[0];
    const fullPlanIndex = patientHeader.indexOf('Full plan JSON (admin PIN removed)');
    expect(fullPlanIndex).toBeGreaterThan(-1);
    const exportedPlan = JSON.parse(String(sheets[0].rows[1][fullPlanIndex])) as Record<string, unknown>;
    expect(exportedPlan.adminPin).toBeUndefined();
    expect(exportedPlan.clientName).toBe('Patient A');
    const patientAdherenceIndex = patientHeader.indexOf('Adherence history (JSON)');
    const exportedAdherence = JSON.parse(String(sheets[0].rows[1][patientAdherenceIndex])) as Array<{ overall: number }>;
    expect(exportedAdherence[0].overall).toBe(83.5);

    const dailyHeader = sheets[1].rows[0];
    const fullLogIndex = dailyHeader.indexOf('Full day log JSON');
    expect(fullLogIndex).toBeGreaterThan(-1);
    const exportedLog = JSON.parse(String(sheets[1].rows[1][fullLogIndex])) as Record<string, unknown>;
    expect(exportedLog.weight).toBe(82.5);
    expect(exportedLog.notes).toBe('Synthetic daily note');

    const adherenceHeader = sheets[2].rows[0];
    expect(adherenceHeader).toContain('Overall (%)');
    expect(sheets[2].rows[1][5]).toBe(83.5);
  });

  it('quotes CSV fields and neutralizes spreadsheet formulas', () => {
    const csv = buildDoctorCsv([fixture('=HYPERLINK("https://evil.example","click")')]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"",""click"")"`);
    expect(csv).toContain('2026-11-08');
  });

  it('creates an uncompressed OpenXML workbook ZIP with two worksheets', () => {
    const bytes = buildDoctorXlsx([fixture()]);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const files = zipEntries(bytes);
    expect(files.has('[Content_Types].xml')).toBe(true);
    expect(files.get('xl/workbook.xml')).toContain('Adherence Scores');
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('Full plan JSON (admin PIN removed)');
    expect(files.get('xl/worksheets/sheet3.xml')).toContain('Synthetic adherence note');
    expect(files.get('xl/worksheets/sheet1.xml')).not.toContain('9876');
  });

  it('escapes patient-controlled HTML and includes the print-to-PDF action', () => {
    const html = buildDoctorPdfHtml([fixture('<img src=x onerror=alert(1)>')], 'Clinic', 'Doctor');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('window.print()');
    expect(html).toContain('Synthetic daily note');
    expect(html).toContain('83.5%');
    expect(html).toContain('Synthetic adherence note');
  });
});
