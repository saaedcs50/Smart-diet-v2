export type MedicationSlot =
  | 'before_breakfast'
  | 'with_breakfast'
  | 'after_breakfast'
  | 'before_lunch'
  | 'with_lunch'
  | 'after_lunch'
  | 'before_dinner'
  | 'with_dinner'
  | 'after_dinner'
  | 'before_sleep'
  | 'morning'
  | 'evening'
  | 'prn';

export interface MedicationTiming {
  id: string;
  slot: MedicationSlot;
  label: string; // نص عربي جاهز
}

export type WithFoodOption = 'required' | 'optional' | 'empty_stomach' | 'unspecified';
export type AppetiteEffect = 'increase' | 'decrease' | 'none' | 'unknown';
export type WeightEffect = 'gain' | 'loss' | 'none' | 'unknown';

export interface MedicationItem {
  id: string;
  name: string;                 // اسم الدواء
  dose: string;                 // مثال: 500 مجم
  timesPerDay: number;          // 1-4
  timings: MedicationTiming[];
  withFood?: WithFoodOption;
  appetiteEffect?: AppetiteEffect;
  weightEffect?: WeightEffect;
  foodInteractionNote?: string; // تنويه غذائي عام يكتبه الأخصائي
  coachNotes?: string;
  active: boolean;
}

export interface MedicationPlanConfig {
  showToClient: boolean;
  items: MedicationItem[];
  lastUpdatedAt?: string;
  lastUpdatedBy?: 'coach';
}

export type DoseStatus = 'taken' | 'skipped' | 'postponed';

export interface DoseLogEntry {
  status: DoseStatus;
  time?: string;      // وقت فعلي اختياري مثلاً "08:30"
  note?: string;      // ملاحظة اختيارية
  loggedAt?: number;  // timestamp
}

// Map key: `${medicationId}__${timingSlot}` or `${medicationId}__${timingId}`
export type DailyMedicationLogs = Record<string, DoseLogEntry>;

export type CycleRegularity = 'regular' | 'irregular' | 'unknown';
export type ClinicalCycleFlag = 'pcos' | 'endometriosis' | 'fluid_retention' | 'other';

export interface CycleTrackingConfig {
  enabled: boolean;                 // تفعيل للعميلة
  showPhaseToClient: boolean;
  regularity: 'regular' | 'irregular' | 'unknown';
  typicalCycleLength: number;       // 21-45 (default 28)
  typicalPeriodLength: number;      // 2-10 (default 5)
  lastPeriodStart?: string;         // YYYY-MM-DD
  clinicalFlags: ClinicalCycleFlag[];
  coachNotes?: string;
  cycleStarts?: string[];          // YYYY-MM-DD historical cycle starts
  lastUpdatedAt?: string;
  lastUpdatedBy?: 'coach' | 'client';
}

export interface CycleDayLog {
  periodStartedToday?: boolean;
  energy?: number | null;           // 1-5
  symptoms: string[];               // symptom ids e.g. "cramps", "bloating", etc.
  spotting?: boolean;
  note?: string;
}

export interface LabEntry {
  id: string;
  testId: string;          // from catalog or 'custom'
  customName?: string;
  value: number;
  unit: string;
  date: string;            // YYYY-MM-DD
  note?: string;
  addedBy: 'coach' | 'client';
  createdAt: string;
}

export interface LabTrackingConfig {
  showToClient: boolean;
  allowClientAdd: boolean;
  entries: LabEntry[];
  lastUpdatedAt?: string;
  lastUpdatedBy?: 'coach' | 'client';
}

export interface MealItem {
  id: string;
  name: string;
  items: string;
  alternatives: string[];
  calories?: number;
  proteinGrams?: number;
  exchanges?: Record<string, number>;
  time?: string;
}

export interface CheckItem {
  id: string;
  label: string;
}

export interface SupplementItem {
  id: string;
  name: string;
  time?: string;
  notes?: string;
  category?: string;
  scientificName?: string;
}

export interface SymptomItem {
  id: string;
  label: string;
}

export interface ScoreWeights {
  checklist: number;
  water: number;
  sleep: number;
  meals: number;
}

export interface SectionVisibility {
  scoreCard?: boolean;
  macrosTracker?: boolean;
  fastingTimer?: boolean;
  tipsBanner?: boolean;
  mealsList?: boolean;
  waterTracker?: boolean;
  sleepTracker?: boolean;
  moodTracker?: boolean;
  exerciseTracker?: boolean;
  checklistTracker?: boolean;
  supplementsTracker?: boolean;
  symptomsTracker?: boolean;
  medicationsTracker?: boolean; // New
  cycleTracker?: boolean;       // New: Menstrual Cycle Tracker
  labTracker?: boolean;         // New: Lab Tests Tracker
  doctorNotes?: boolean;
  quickReportBtn?: boolean;
  bodyTab?: boolean;
  reportsTab?: boolean;
}

export interface ConditionItem {
  id: string;           // e.g. "t2dm", "pcos", "ibs"
  label: string;        // الاسم بالعربي
  notes?: string;       // ملاحظات الأخصائي
  severity?: 'mild' | 'moderate' | 'severe'; // اختياري
  diagnosedAt?: string; // تاريخ تقريبي اختياري
}

export interface MedicalConditionsConfig {
  conditions: ConditionItem[];
  allergies: string[];    // نص حر: جلوتين، لاكتوز، ...
  showToClient: boolean;  // إظهار ملخص للعميل في ملفه الصحي؟
  customConditionNotes?: string;
  lastUpdatedAt?: string;
  lastUpdatedBy?: 'coach';
}

// ============================================================================
// نظام الصيام المتقدم (إسلامي / مسيحي / متقطع)
// ============================================================================
export type FastingType = 'none' | 'islamic' | 'christian' | 'intermittent';

export type IslamicFastingPattern = 
  | 'single_day'    // يوم منفصل / تطوع
  | 'mon_thu'       // الإثنين والخميس أسبوعياً
  | 'white_days'    // الأيام البيض (13 و 14 و 15 هجرياً)
  | 'ramadan'       // شهر رمضان المبارك
  | 'custom_dates'; // تواريخ محددة

export interface IslamicFastingConfig {
  pattern: IslamicFastingPattern;
  fajrTime?: string;         // e.g. "04:30" (أذان الفجر / الإمساك)
  maghribTime?: string;      // e.g. "18:15" (أذان المغرب / الإفطار)
  autoRemapMeals?: boolean;  // تحويل مسميات الوجبات لسحور وإفطار تلقائياً
  rehydrationPlan?: boolean; // جدول شرب الماء وتوزيع الحصص الذكي
  suhurTips?: boolean;       // إرشادات السحور لتقليل العطش والجوع
}

export type ChristianFastType = 
  | 'with_fish'      // صيام درجة ثانية (مسموح بالأسماك: صوم الميلاد، الرسل، العذراء)
  | 'strict_vegan'   // صيام درجة أولى (نباتي صرف بدون أسماك: الصوم الكبير، يونان، أسبوع الآلام، البرامون)
  | 'custom';

export interface ChristianFastingConfig {
  fastType: ChristianFastType;
  fastName?: string;              // e.g. "الصوم الكبير", "صوم الميلاد"
  abstinenceHoursEnabled: boolean;// صيام انقطاعي صباحي
  abstinenceEndTime?: string;     // e.g. "12:00" أو "15:00"
  allowFish?: boolean;            // هل مسموح بالأسماك في هذا الصوم
  plantProteinCombiner?: boolean; // إرشاد دمج مصادر البروتين النباتي
  supplementReminders?: string[]; // e.g. ["b12", "iron", "zinc", "calcium"]
}

export interface IntermittentFastingConfig {
  targetHours: number;            // 16, 18, 20, 14, 12
  eatingWindowStart?: string;     // e.g. "12:00"
  eatingWindowEnd?: string;       // e.g. "20:00"
  fastingHours?: number;
}

export interface FastingPlanConfig {
  enabled: boolean;
  type: FastingType;
  islamic?: IslamicFastingConfig;
  christian?: ChristianFastingConfig;
  intermittent?: IntermittentFastingConfig;
  notes?: string;
  lastUpdatedAt?: string;
  lastUpdatedBy?: 'coach' | 'client';
}

// ============================================================================
// Batch 2.4: هدف الأسبوع الواحد (WeeklyFocus)
// ============================================================================
export type WeeklyFocusType = 'water' | 'sleep' | 'meals' | 'checklist' | 'custom';

export interface WeeklyFocusConfig {
  type: WeeklyFocusType;
  /** نص حر إلزامي عمليًا لنوع custom، واختياري وصفي لباقي الأنواع */
  label?: string;
  /** الهدف الرقمي خلال الأسبوع (مل ماء / ساعات نوم / عدد وجبات / بنود مهام / أيام إنجاز للمخصص) */
  target: number;
  /** تاريخ بداية الأسبوع YYYY-MM-DD */
  weekStartISO: string;
}

export interface PlanConfig {
  clientName: string;
  dailyWaterGoalMl: number;
  heightCm: number | null;
  startWeight?: number | null;
  targetWeight: number | null;
  targetWaist: number | null;
  freezeDaysPerMonth: number;
  adminPin: string;
  scoreWeights: ScoreWeights;
  meals: MealItem[];
  checklist: CheckItem[];
  supplements: SupplementItem[];
  tips: string[];
  symptomsList: SymptomItem[];
  // Medical Conditions & Diagnoses
  medicalConditions?: MedicalConditionsConfig;
  // Medications & Interactions
  medicationPlan?: MedicationPlanConfig;
  // Menstrual Cycle Tracking
  cycleTracking?: CycleTrackingConfig;
  // Lab Tests Tracking
  labTracking?: LabTrackingConfig;
  // Advanced Fasting System (Islamic / Christian / Intermittent)
  fastingPlan?: FastingPlanConfig;
  // Batch 2.4: Weekly Focus (اختياري — غيابه يعني لا بطاقة)
  weeklyFocus?: WeeklyFocusConfig;
  // Features & Visibility
  targetCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFats?: number | null;
  enableMacrosTracker?: boolean;
  enableFastingTimer?: boolean;
  fastingTargetHours?: number;
  visibleSections?: SectionVisibility;
  // حقول اختيارية تُستخدم فعليًا في الواجهة (كانت تُقرأ دون تعريف)
  goal?: string;
  notes?: string;
  waterGoalMl?: number;
  waterTargetLiters?: number;
}

export interface MealLogState {
  type?: 'default' | 'alt' | 'none';
  detail?: string;
  reason?: string;
  eval?: 'yes' | 'no';
  protein?: boolean;
  veggies?: boolean;
  hungerBefore?: number | null; // 1 to 10 scale (before meal)
  fullnessAfter?: number | null; // 1 to 10 scale (after meal)
}

export interface BodyMeasurements {
  waist: number | null;
  chest: number | null;
  hips: number | null;
  arm: number | null;
  thigh: number | null;
  neck: number | null;
}

export interface ActiveFastingSession {
  isActive: boolean;
  startTime: number | null; // timestamp in ms
  targetHours?: number;
  startDateStr?: string; // YYYY-MM-DD of the day fasting started
}

export interface DayLog {
  water: number;
  waterLogs: number;
  sleep: string;
  wake: string;
  sleepHours?: number | null;
  quality: string;
  meals: Record<string, MealLogState>;
  checks: Record<string, boolean>;
  supps: Record<string, boolean>;
  medications?: DailyMedicationLogs; // New: Dose adherence logs
  cycleDay?: CycleDayLog;            // New: Menstrual cycle tracking log
  notes: string;
  weight: number | null;
  meas: BodyMeasurements;
  symptoms: Record<string, boolean>;
  symNotes: string;
  mood: number | null;
  exercise: number;
  isFreeze: boolean;
  // New macro & fasting tracking
  consumedCalories?: number;
  consumedProtein?: number;
  consumedCarbs?: number;
  consumedFats?: number;
  fastingStartTime?: number | null; // timestamp
  fastingEndTime?: number | null;
  completedFastingHours?: number | null;
  isFasting?: boolean;
  // Batch 1.3: Day-complete celebration shown once per day
  celebrationShown?: boolean;
  // Batch 2.4: «أنجزت اليوم» لهدف الأسبوع المخصص (مرة واحدة في اليوم بحكم الحقل)
  focusDone?: boolean;
  // Today fasting status override by client or schedule
  isFastingDay?: boolean;
  fastingTypeOverride?: FastingType;
  christianFishOverride?: boolean;
}

export interface PhotoRecord {
  id?: number;
  date: string;
  data: string; // base64 data url
  ts: number;
  note?: string;
}

export type ActiveTab = 'today' | 'body' | 'reports';
