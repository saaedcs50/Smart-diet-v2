// ============================================================================
// النموذج الثابت للمنصة (static prototype) — بيانات وهمية بالكامل.
// لا يقرأ من localStorage ولا من أي مصدر بيانات حقيقي، ولا يرسل أي شيء.
// كل الأسماء هنا مستعارة ومخترعة لغرض العرض فقط، ولا تشير لأي شخص حقيقي.
// ============================================================================

export interface DemoPatientSummary {
  id: string;
  /** اسم مستعار مخترع — ليس اسم عميل حقيقي. */
  alias: string;
  todayAdherencePct: number;
  weightKg: number;
  lastActivityLabel: string;
  daysAbsent: number;
  goalLabel: string;
}

export interface DemoWeightPoint {
  date: string;
  weight: number;
}

export interface DemoPatientDetail {
  summary: DemoPatientSummary;
  startWeight: number;
  targetWeight: number;
  weightPoints: DemoWeightPoint[];
  focusLabel: string;
  focusProgressPct: number;
  milestonesUnlocked: string[];
  milestonesNext: string;
  planMeals: string[];
}

export const DEMO_PATIENTS: DemoPatientSummary[] = [
  {
    id: 'demo-1',
    alias: 'نور (اسم مستعار)',
    todayAdherencePct: 86,
    weightKg: 78.4,
    lastActivityLabel: 'اليوم، 09:20 صباحًا',
    daysAbsent: 0,
    goalLabel: 'إنقاص 8 كجم',
  },
  {
    id: 'demo-2',
    alias: 'كريم (اسم مستعار)',
    todayAdherencePct: 64,
    weightKg: 92.1,
    lastActivityLabel: 'أمس، 06:40 مساءً',
    daysAbsent: 1,
    goalLabel: 'تثبيت الوزن',
  },
  {
    id: 'demo-3',
    alias: 'ليلى (اسم مستعار)',
    todayAdherencePct: 0,
    weightKg: 71.0,
    lastActivityLabel: 'قبل 6 أيام',
    daysAbsent: 6,
    goalLabel: 'إنقاص 5 كجم',
  },
  {
    id: 'demo-4',
    alias: 'عمر (اسم مستعار)',
    todayAdherencePct: 100,
    weightKg: 84.6,
    lastActivityLabel: 'اليوم، 08:05 صباحًا',
    daysAbsent: 0,
    goalLabel: 'زيادة الكتلة العضلية',
  },
  {
    id: 'demo-5',
    alias: 'هند (اسم مستعار)',
    todayAdherencePct: 45,
    weightKg: 66.8,
    lastActivityLabel: 'قبل 3 أيام',
    daysAbsent: 3,
    goalLabel: 'تحسين عادات الأكل',
  },
];

export const DEMO_PATIENT_DETAILS: Record<string, DemoPatientDetail> = {
  'demo-1': {
    summary: DEMO_PATIENTS[0],
    startWeight: 86.0,
    targetWeight: 78.0,
    weightPoints: [
      { date: '01 أكتوبر', weight: 86.0 },
      { date: '08 أكتوبر', weight: 84.2 },
      { date: '15 أكتوبر', weight: 82.5 },
      { date: '22 أكتوبر', weight: 78.4 },
    ],
    focusLabel: 'شرب 8 أكواب ماء يوميًا',
    focusProgressPct: 86,
    milestonesUnlocked: ['🎉 أول أسبوع ملتزم', '💧 7 أيام ماء كامل'],
    milestonesNext: 'إنقاص 10 كجم إجمالي',
    planMeals: ['فطور: بيض + خبز أسمر + خضار', 'غداء: دجاج مشوي + أرز + سلطة', 'عشاء: زبادي + فاكهة'],
  },
  'demo-2': {
    summary: DEMO_PATIENTS[1],
    startWeight: 92.0,
    targetWeight: 90.0,
    weightPoints: [
      { date: '01 أكتوبر', weight: 92.0 },
      { date: '08 أكتوبر', weight: 92.4 },
      { date: '15 أكتوبر', weight: 91.6 },
      { date: '22 أكتوبر', weight: 92.1 },
    ],
    focusLabel: 'المشي 30 دقيقة يوميًا',
    focusProgressPct: 64,
    milestonesUnlocked: ['🎉 أول أسبوع ملتزم'],
    milestonesNext: 'أسبوعان متتاليان بلا غياب',
    planMeals: ['فطور: شوفان + حليب + موز', 'غداء: سمك + خضار سوتيه', 'عشاء: سلطة تونة'],
  },
  'demo-3': {
    summary: DEMO_PATIENTS[2],
    startWeight: 76.0,
    targetWeight: 71.0,
    weightPoints: [
      { date: '01 أكتوبر', weight: 76.0 },
      { date: '08 أكتوبر', weight: 74.8 },
      { date: '15 أكتوبر', weight: 73.5 },
      { date: '22 أكتوبر', weight: 71.0 },
    ],
    focusLabel: 'تسجيل الوجبات يوميًا',
    focusProgressPct: 0,
    milestonesUnlocked: ['🎉 أول أسبوع ملتزم', '⚖️ أول 5 كجم'],
    milestonesNext: 'العودة بعد الغياب',
    planMeals: ['فطور: فول + بيض + خبز بلدي', 'غداء: لحم + خضار + أرز', 'عشاء: جبن قريش + خيار'],
  },
  'demo-4': {
    summary: DEMO_PATIENTS[3],
    startWeight: 80.0,
    targetWeight: 86.0,
    weightPoints: [
      { date: '01 أكتوبر', weight: 80.0 },
      { date: '08 أكتوبر', weight: 81.8 },
      { date: '15 أكتوبر', weight: 83.1 },
      { date: '22 أكتوبر', weight: 84.6 },
    ],
    focusLabel: 'بروتين في كل وجبة',
    focusProgressPct: 100,
    milestonesUnlocked: ['🎉 أول أسبوع ملتزم', '💪 زيادة 4 كجم صحية', '🔥 14 يومًا متتاليًا'],
    milestonesNext: 'الوصول للهدف 86 كجم',
    planMeals: ['فطور: بيض + شوفان + مكسرات', 'غداء: دجاج + بطاطس + سلطة', 'عشاء: تونة + أرز'],
  },
  'demo-5': {
    summary: DEMO_PATIENTS[4],
    startWeight: 69.0,
    targetWeight: 65.0,
    weightPoints: [
      { date: '01 أكتوبر', weight: 69.0 },
      { date: '08 أكتوبر', weight: 68.4 },
      { date: '15 أكتوبر', weight: 67.2 },
      { date: '22 أكتوبر', weight: 66.8 },
    ],
    focusLabel: 'وجبة خفيفة صحية واحدة يوميًا',
    focusProgressPct: 45,
    milestonesUnlocked: ['🎉 أول أسبوع ملتزم'],
    milestonesNext: 'أسبوع كامل بلا سكريات مضافة',
    planMeals: ['فطور: زبادي + شوفان + عسل', 'غداء: خضار + دجاج + خبز', 'عشاء: شوربة خضار'],
  },
};

/** حد تنبيه الغياب في النموذج: 3 أيام بلا نشاط. */
export const ABSENCE_THRESHOLD_DAYS = 3;

export function getAbsentPatients(patients: DemoPatientSummary[]): DemoPatientSummary[] {
  return patients.filter((p) => p.daysAbsent >= ABSENCE_THRESHOLD_DAYS);
}
