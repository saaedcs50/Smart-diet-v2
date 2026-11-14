import type { DayLog, PlanConfig } from '../types';
import type { PatientDoc } from './firestore';
import type { AdherenceConfig, AdherenceScore } from './adherence';

export interface DoctorExportPatient {
  uid: string;
  doc: PatientDoc;
  entries: Array<{ date: string; log: DayLog }>;
  adherenceConfig: AdherenceConfig | null;
  adherenceScores: AdherenceScore[];
}

export type ExportCell = string | number | boolean | null | undefined;
export interface ExportSheet {
  name: string;
  rows: ExportCell[][];
}

function jsonCell(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function validNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function planOf(patient: DoctorExportPatient): PlanConfig | null {
  const plan = patient.doc.plan;
  if (!plan) return null;
  // Never export the legacy local admin PIN even if an old database row has it.
  const { adminPin: _adminPin, ...safePlan } = plan;
  void _adminPin;
  return safePlan as PlanConfig;
}

function lastEntry(patient: DoctorExportPatient): { date: string; log: DayLog } | null {
  if (patient.entries.length === 0) return null;
  return [...patient.entries].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function buildDoctorExportSheets(patients: DoctorExportPatient[]): ExportSheet[] {
  const patientRows: ExportCell[][] = [[
    'Patient ID',
    'Patient name',
    'Plan status',
    'Height (cm)',
    'Starting weight (kg)',
    'Target weight (kg)',
    'Target waist (cm)',
    'Daily water goal (ml)',
    'Target calories (kcal)',
    'Target protein (g)',
    'Target carbs (g)',
    'Target fats (g)',
    'Meal plan (JSON)',
    'Checklist (JSON)',
    'Supplements (JSON)',
    'Medical conditions (JSON)',
    'Medication plan (JSON)',
    'Daily logs count',
    'Last log date',
    'Last recorded weight (kg)',
    'Last recorded water (ml)',
    'Adherence axes (JSON)',
    'Adherence history (JSON)',
    'Latest adherence (%)',
    'Latest adherence date',
    'Full plan JSON (admin PIN removed)',
  ]];

  const dayRows: ExportCell[][] = [[
    'Patient ID',
    'Patient name',
    'Date',
    'Weight (kg)',
    'Water (ml)',
    'Water entries',
    'Sleep time',
    'Wake time',
    'Sleep hours',
    'Sleep quality',
    'Meals (JSON)',
    'Checklist (JSON)',
    'Supplements (JSON)',
    'Medications (JSON)',
    'Symptoms (JSON)',
    'Symptom notes',
    'Patient notes',
    'Mood',
    'Exercise',
    'Consumed calories',
    'Consumed protein (g)',
    'Consumed carbs (g)',
    'Consumed fats (g)',
    'Completed fasting hours',
    'Fasting',
    'Freeze day',
    'Full day log JSON',
  ]];

  for (const patient of patients) {
    const plan = planOf(patient);
    const last = lastEntry(patient);
    const adherenceLatest = [...patient.adherenceScores].sort((a, b) => b.date.localeCompare(a.date))[0];
    patientRows.push([
      patient.uid,
      patient.doc.profile.clientName,
      plan ? 'Has plan' : 'No plan',
      validNumber(plan?.heightCm),
      validNumber(plan?.startWeight),
      validNumber(plan?.targetWeight),
      validNumber(plan?.targetWaist),
      validNumber(plan?.dailyWaterGoalMl ?? plan?.waterGoalMl),
      validNumber(plan?.targetCalories),
      validNumber(plan?.targetProtein),
      validNumber(plan?.targetCarbs),
      validNumber(plan?.targetFats),
      jsonCell(plan?.meals),
      jsonCell(plan?.checklist),
      jsonCell(plan?.supplements),
      jsonCell(plan?.medicalConditions),
      jsonCell(plan?.medicationPlan),
      patient.entries.length,
      last?.date ?? '',
      validNumber(last?.log.weight),
      validNumber(last?.log.water),
      jsonCell(patient.adherenceConfig?.axes),
      jsonCell(patient.adherenceScores),
      validNumber(adherenceLatest?.overall),
      adherenceLatest?.date ?? '',
      jsonCell(plan),
    ]);

    for (const entry of patient.entries) {
      const log = entry.log;
      dayRows.push([
        patient.uid,
        patient.doc.profile.clientName,
        entry.date,
        validNumber(log.weight),
        validNumber(log.water),
        validNumber(log.waterLogs),
        log.sleep ?? '',
        log.wake ?? '',
        validNumber(log.sleepHours),
        log.quality ?? '',
        jsonCell(log.meals),
        jsonCell(log.checks),
        jsonCell(log.supps),
        jsonCell(log.medications),
        jsonCell(log.symptoms),
        log.symNotes ?? '',
        log.notes ?? '',
        validNumber(log.mood),
        validNumber(log.exercise),
        validNumber(log.consumedCalories),
        validNumber(log.consumedProtein),
        validNumber(log.consumedCarbs),
        validNumber(log.consumedFats),
        validNumber(log.completedFastingHours),
        log.isFasting === true,
        log.isFreeze === true,
        jsonCell(log),
      ]);
    }
  }

  const adherenceRows: ExportCell[][] = [[
    'Patient ID',
    'Patient name',
    'Date',
    'Axes configuration (JSON)',
    'Scores by axis (JSON)',
    'Overall (%)',
    'Entered at',
    'Note',
  ]];
  for (const patient of patients) {
    for (const score of patient.adherenceScores) {
      adherenceRows.push([
        patient.uid,
        patient.doc.profile.clientName,
        score.date,
        jsonCell(patient.adherenceConfig?.axes),
        jsonCell(score.scores),
        validNumber(score.overall),
        score.enteredAt ?? '',
        score.note ?? '',
      ]);
    }
  }

  return [
    { name: 'Patients', rows: patientRows },
    { name: 'Daily Logs', rows: dayRows },
    { name: 'Adherence Scores', rows: adherenceRows },
  ];
}

function startsWithSpreadsheetFormula(text: string): boolean {
  let index = 0;
  while (index < text.length && text.charCodeAt(index) <= 0x20) index += 1;
  return index < text.length && '=+-@'.includes(text[index]);
}

function csvSafe(value: ExportCell): string {
  if (value == null) return '';
  let text = String(value);
  // Prevent spreadsheet formula execution when a CSV is opened in Excel.
  if (typeof value !== 'number' && startsWithSpreadsheetFormula(text)) text = "'" + text;
  if (/[",\\r\\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}
/** Export one or more worksheet-style tables as a UTF-8 CSV. */
export function buildCsvFromSheets(sheets: ExportSheet[]): string {
  const rows: ExportCell[][] = [];
  for (const sheet of sheets) {
    if (sheet.rows.length === 0) continue;
    if (rows.length > 0) rows.push([]);
    if (sheets.length > 1) rows.push([sheet.name]);
    rows.push(...sheet.rows);
  }
  return '\uFEFF' + rows.map((row) => row.map(csvSafe).join(',')).join('\r\n');
}

export function buildDoctorCsv(patients: DoctorExportPatient[]): string {
  const [patientsSheet, daySheet] = buildDoctorExportSheets(patients);
  const dayHeader = daySheet.rows[0];
  const patientHeader = patientsSheet.rows[0];
  const outputHeader = [...patientHeader, ...dayHeader.slice(2)];
  const rows: ExportCell[][] = [outputHeader];

  for (let i = 1; i < patientsSheet.rows.length; i++) {
    const p = patientsSheet.rows[i];
    rows.push([...p, ...Array(dayHeader.length - 2).fill('')]);
  }

  const patientRowByUid = new Map(
    patients.map((patient, index) => [patient.uid, patientsSheet.rows[index + 1]]),
  );
  for (let i = 1; i < daySheet.rows.length; i++) {
    const day = daySheet.rows[i];
    const patientRow = patientRowByUid.get(String(day[0]));
    if (!patientRow) continue;
    rows.push([...patientRow, ...day.slice(2)]);
  }

  return '\uFEFF' + rows.map((row) => row.map(csvSafe).join(',')).join('\r\n');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function worksheetXml(rows: ExportCell[][]): string {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      if (value == null || value === '') return '';
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      if (typeof value === 'boolean') {
        return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
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

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}
function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

interface ZipEntry {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

function zipStore(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  const localParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + name.length);
    const view = new DataView(localHeader.buffer);
    u32(view, 0, 0x04034b50);
    u16(view, 4, 20);
    u16(view, 6, 0x0800); // UTF-8 names
    u16(view, 8, 0); // STORE
    u16(view, 10, 0); // 00:00
    u16(view, 12, 33); // 1980-01-01
    u32(view, 14, crc);
    u32(view, 18, data.length);
    u32(view, 22, data.length);
    u16(view, 26, name.length);
    u16(view, 28, 0);
    localHeader.set(name, 30);

    entries.push({ name, data, crc, offset });
    localParts.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  const centralOffset = offset;
  const centralParts: Uint8Array[] = [];
  for (const entry of entries) {
    const header = new Uint8Array(46 + entry.name.length);
    const view = new DataView(header.buffer);
    u32(view, 0, 0x02014b50);
    u16(view, 4, 20);
    u16(view, 6, 20);
    u16(view, 8, 0x0800);
    u16(view, 10, 0);
    u16(view, 12, 0); // 00:00
    u16(view, 14, 33); // 1980-01-01
    u32(view, 16, entry.crc);
    u32(view, 20, entry.data.length);
    u32(view, 24, entry.data.length);
    u16(view, 28, entry.name.length);
    u16(view, 30, 0);
    u16(view, 32, 0);
    u16(view, 34, 0);
    u16(view, 36, 0);
    u32(view, 38, 0);
    u32(view, 42, entry.offset);
    header.set(entry.name, 46);
    centralParts.push(header);
    offset += header.length;
  }

  const centralSize = offset - centralOffset;
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 4, 0);
  u16(endView, 6, 0);
  u16(endView, 8, entries.length);
  u16(endView, 10, entries.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, centralOffset);
  u16(endView, 20, 0);

  const total = [...localParts, ...centralParts, end]
    .reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

export function buildXlsxFromSheets(sheets: ExportSheet[]): Uint8Array {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets.map((sheet, i) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
</Relationships>`;
  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: worksheetXml(sheet.rows),
    })),
  ];
  return zipStore(files);
}

export function buildDoctorXlsx(patients: DoctorExportPatient[]): Uint8Array {
  return buildXlsxFromSheets(buildDoctorExportSheets(patients));
}

export function buildDoctorPdfHtml(patients: DoctorExportPatient[], clinicName: string, doctorName: string): string {
  const esc = (value: unknown): string => xmlEscape(String(value ?? '—'));
  const reportDate = new Date().toLocaleDateString('ar-EG');
  const patientSections = patients.map((patient) => {
    const plan = planOf(patient);
    const logs = [...patient.entries].sort((a, b) => b.date.localeCompare(a.date));
    return `<section class="patient">
      <h2>${esc(patient.doc.profile.clientName)}</h2>
      <p class="meta">معرف المريض: ${esc(patient.uid)} · عدد السجلات: ${logs.length}</p>
      <h3>الخطة</h3>
      ${plan ? `<table><tbody>
        <tr><th>الطول</th><td>${esc(plan.heightCm)} سم</td><th>وزن البداية</th><td>${esc(plan.startWeight)} كجم</td></tr>
        <tr><th>الوزن المستهدف</th><td>${esc(plan.targetWeight)} كجم</td><th>هدف الماء</th><td>${esc(plan.dailyWaterGoalMl)} مل</td></tr>
        <tr><th>السعرات</th><td>${esc(plan.targetCalories)} ك.س</td><th>البروتين</th><td>${esc(plan.targetProtein)} جم</td></tr>
        <tr><th>الكربوهيدرات</th><td>${esc(plan.targetCarbs)} جم</td><th>الدهون</th><td>${esc(plan.targetFats)} جم</td></tr>
        <tr><th>الوجبات</th><td colspan="3">${esc(plan.meals?.map((m) => `${m.name}: ${m.items}`).join(' | '))}</td></tr>
        <tr><th>بنود المتابعة</th><td colspan="3">${esc(plan.checklist?.map((c) => c.label).join(' | '))}</td></tr>
      </tbody></table>` : '<p>لا توجد خطة مسجلة.</p>'}
      <h3>الالتزام</h3>
      ${patient.adherenceConfig ? `<p>المحاور والأوزان: ${esc(patient.adherenceConfig.axes.map((axis) => `${axis.name} (${axis.weight}%)`).join('، '))}</p>` : '<p>لا يوجد إعداد لمحاور الالتزام.</p>'}
      ${patient.adherenceScores.length ? `<table><thead><tr><th>التاريخ</th><th>النسبة</th><th>الدرجات</th><th>ملاحظة</th></tr></thead><tbody>${[...patient.adherenceScores].sort((a, b) => b.date.localeCompare(a.date)).map((score) => `<tr><td>${esc(score.date)}</td><td>${esc(score.overall)}%</td><td>${esc(score.scores.join(' / '))}</td><td>${esc(score.note)}</td></tr>`).join('')}</tbody></table>` : '<p>لا توجد درجات التزام مسجلة.</p>'}
      <h3>السجلات اليومية</h3>
      ${logs.length ? `<table><thead><tr><th>التاريخ</th><th>الوزن</th><th>الماء</th><th>النوم</th><th>السعرات</th><th>ملاحظات</th></tr></thead>
        <tbody>${logs.map(({ date, log }) => `<tr>
          <td>${esc(date)}</td><td>${esc(log.weight)} كجم</td><td>${esc(log.water)} مل</td>
          <td>${esc(log.sleepHours ?? log.sleep)} / ${esc(log.quality)}</td>
          <td>${esc(log.consumedCalories)}</td><td>${esc(log.notes)}</td>
        </tr>`).join('')}</tbody></table>` : '<p>لا توجد سجلات يومية.</p>'}
    </section>`;
  }).join('');

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير مرضى الطبيب</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{font-family:Cairo,Tahoma,sans-serif;color:#0f172a;margin:24px;direction:rtl;text-align:right;font-size:12px}
h1{font-size:22px;margin:0 0 6px}h2{font-size:18px;margin:0 0 4px;color:#0f766e}h3{font-size:14px;margin:12px 0 6px}
.meta{color:#475569;margin:2px 0 8px}.patient{break-inside:avoid-page;border-top:2px solid #cbd5e1;padding-top:14px;margin-top:18px}
table{width:100%;border-collapse:collapse;margin:4px 0 10px;table-layout:fixed}
th,td{border:1px solid #cbd5e1;padding:6px;vertical-align:top;overflow-wrap:anywhere}
th{background:#f1f5f9;font-weight:700}.header{margin-bottom:18px;border-bottom:2px solid #0f766e;padding-bottom:12px}
.no-print{margin:0 0 18px;padding:8px 16px;border:0;border-radius:8px;background:#0f766e;color:white;font:inherit;font-weight:700;cursor:pointer}
@page{size:A4 landscape;margin:12mm}@media print{body{margin:0}.patient{break-before:auto}.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()">طباعة / حفظ PDF</button>
<header class="header"><h1>تقرير متابعة مرضى الطبيب</h1>
<div>العيادة: ${esc(clinicName)} · الطبيب: ${esc(doctorName)} · تاريخ التصدير: ${esc(reportDate)}</div>
<div>عدد المرضى: ${patients.length} — يحتوي التقرير على الخطط والسجلات اليومية المتاحة للطبيب المسجل.</div></header>
${patientSections || '<p>لا يوجد مرضى للتصدير.</p>'}
</body></html>`;
}

export function downloadExportBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
