import { PlanConfig, DayLog, SectionVisibility, ActiveFastingSession } from '../types';
import { StorageKeys } from './storageKeys';

export const DEFAULT_VISIBLE_SECTIONS: SectionVisibility = {
  scoreCard: true,
  macrosTracker: true,
  fastingTimer: true,
  tipsBanner: true,
  mealsList: true,
  waterTracker: true,
  sleepTracker: true,
  moodTracker: true,
  exerciseTracker: true,
  checklistTracker: true,
  supplementsTracker: true,
  symptomsTracker: true,
  medicationsTracker: true,
  cycleTracker: true,
  labTracker: true,
  doctorNotes: true,
  quickReportBtn: true,
  bodyTab: true,
  reportsTab: true,
};

export function isSectionVisible(plan?: PlanConfig | null, key?: keyof SectionVisibility): boolean {
  if (!plan || !key) return true;
  if (plan.visibleSections && typeof plan.visibleSections[key] === 'boolean') {
    return plan.visibleSections[key]!;
  }
  // Backwards compatibility with boolean flags
  if (key === 'macrosTracker' && plan.enableMacrosTracker === false) return false;
  if (key === 'fastingTimer' && plan.enableFastingTimer === false) return false;
  return true;
}

export const DEFAULT_PLAN: PlanConfig = {
  clientName: 'المتدرب',
  dailyWaterGoalMl: 3000,
  heightCm: 175,
  startWeight: 88,
  targetWeight: 75,
  targetWaist: 82,
  freezeDaysPerMonth: 2,
  adminPin: '',
  targetCalories: 2000,
  targetProtein: 140,
  targetCarbs: 180,
  targetFats: 55,
  enableMacrosTracker: true,
  enableFastingTimer: true,
  fastingTargetHours: 16,
  visibleSections: DEFAULT_VISIBLE_SECTIONS,
  scoreWeights: {
    checklist: 30,
    water: 25,
    sleep: 15,
    meals: 30,
  },
  meals: [
    {
      id: 'm_breakfast',
      name: 'وجبة الإفطار',
      items: '3 بيضات مسلوقة أو أومليت بقليل من زيت الزيتون + نصف رغيف خبز بلدي + خضار طازج',
      alternatives: [
        '120 جم جبن قريش بزيت الزيتون والزعتر + شريحة توست أسمر + خضار',
        '4 ملاعق شوفان مع حليب خالي الدسم وحصة بروتين وموزة صغيرة',
      ],
      calories: 450,
      proteinGrams: 30,
    },
    {
      id: 'm_lunch',
      name: 'وجبة الغداء',
      items: '180 جم صدور دجاج مشوية أو مسلوقة + 6 ملاعق أرز مسلوق + طبق سلطة خضراء كبير',
      alternatives: [
        '200 جم سمك مشوي + 150 جم بطاطس مشوية + سلطة خضراء',
        'علبة تونة مصفاة من الزيت + خبز أسمر أو بطاطس مسلوقة + سلطة خضراء',
      ],
      calories: 600,
      proteinGrams: 48,
    },
    {
      id: 'm_snack',
      name: 'وجبة خفيفة (سناك)',
      items: 'حبة فاكهة (تفاح أو موز) + 15 حبة لوز أو مكسرات نيئة غير مملحة',
      alternatives: [
        'كوب زبادي يوناني أو قليل الدسم + ملعقة بذور شيا',
        'قهوة سادة أو شاي أخضر + مكعبين شوكولاتة داكنة (70%+)',
      ],
      calories: 220,
      proteinGrams: 10,
    },
    {
      id: 'm_dinner',
      name: 'وجبة العشاء',
      items: 'زبادي قليل الدسم + عصرة ليمون + طبق سلطة خضراء',
      alternatives: [
        'بيضتان مسلوقتان مع طبق خضار ورقي وخيار',
        '100 جم جبن قريش مع طماطم وخيار',
      ],
      calories: 280,
      proteinGrams: 22,
    },
  ],
  checklist: [
    { id: 'c_morning_water', label: 'شرب 500 مل ماء فور الاستيقاظ' },
    { id: 'c_veggies', label: 'تناول حصة خضار طازج أو ورقي مع الوجبات' },
    { id: 'c_no_sugar', label: 'الامتناع عن السكريات المضافة والمشروبات الغازية' },
    { id: 'c_steps', label: 'المشي من 8,000 إلى 10,000 خطوة يومياً' },
    { id: 'c_early_dinner', label: 'التوقف عن تناول الطعام قبل النوم بـ 2-3 ساعات' },
  ],
  supplements: [
    { id: 's_multivitamin', name: 'فيتامينات متعددة (بعد الإفطار)', time: 'صباحاً' },
    { id: 's_omega3', name: 'أوميجا 3 (مع وجبة الغداء)', time: 'ظهراً' },
    { id: 's_magnesium', name: 'مغنيسيوم (قبل النوم)', time: 'مساءً' },
    { id: 's_vit_d', name: 'فيتامين د3', time: 'صباحاً' },
  ],
  tips: [
    'احرص على شرب كوب ماء قبل كل وجبة بربع ساعة للمساعدة في الشعور بالامتلاء.',
    'ابدأ الوجبة بالسلطة والخضار ثم مصدر البروتين قبل الكربوهيدرات لضبط مستويات السكر في الدم.',
    'في حال الشعور برغبة مفاجئة في تناول الطعام، اشرب الماء أولاً للتأكد من عدم وجود جفاف.',
    'النوم المنتظم من 7 إلى 8 ساعات يومياً يعزز معدلات الأيض ويقلل من هرمونات التوتر والشهية.',
  ],
  symptomsList: [
    { id: 'sy_fatigue', label: 'إرهاق وخمول' },
    { id: 'sy_headache', label: 'صداع خفيف' },
    { id: 'sy_bloating', label: 'انتفاخ وغازات' },
    { id: 'sy_constipation', label: 'إمساك' },
    { id: 'sy_extreme_hunger', label: 'جوع شديد غير معتاد' },
    { id: 'sy_sugar_cravings', label: 'اشتهاء حلويات وسكريات' },
    { id: 'sy_mood_swings', label: 'عصبية أو تقلب مزاج' },
    { id: 'sy_insomnia', label: 'أرق وصعوبة نوم' },
    { id: 'sy_muscle_cramps', label: 'شد عضلي' },
    { id: 'sy_dizziness', label: 'دوخة أو هبوط ضغط' },
  ],
};

const PLAN_KEY = StorageKeys.plan();
const DAY_PREFIX = StorageKeys.dayPrefix();
const ACTIVE_FASTING_KEY = StorageKeys.activeFasting();

/**
 * Parses YYYY-MM-DD into a pure local Date (midnight local time)
 * avoiding UTC offset shifts across midnight.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
}

/**
 * Returns YYYY-MM-DD in the user's local timezone.
 * Accepts Date object, number timestamp, or date string.
 */
export function getTodayDateString(d?: Date | string | number): string {
  let dateObj: Date;
  if (!d) {
    dateObj = new Date();
  } else if (typeof d === 'string' && d.includes('-') && d.length === 10) {
    return d;
  } else if (d instanceof Date) {
    dateObj = d;
  } else {
    dateObj = new Date(d);
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retrieves the currently active fasting session if one is in progress across days.
 */
export function getActiveFastingSession(): ActiveFastingSession {
  try {
    const raw = localStorage.getItem(ACTIVE_FASTING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isActive && parsed.startTime) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to get active fasting session', e);
  }
  return {
    isActive: false,
    startTime: null,
  };
}

/**
 * Persists an active fasting session across midnight and page reloads.
 */
export function saveActiveFastingSession(session: ActiveFastingSession): void {
  try {
    if (session.isActive && session.startTime) {
      localStorage.setItem(ACTIVE_FASTING_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(ACTIVE_FASTING_KEY);
    }
  } catch (e) {
    console.error('Failed to save active fasting session', e);
  }
}

/**
 * Clears any active fasting session from storage.
 */
export function clearActiveFastingSession(): void {
  try {
    localStorage.removeItem(ACTIVE_FASTING_KEY);
  } catch (e) {}
}

export function createEmptyDayLog(): DayLog {
  return {
    water: 0,
    waterLogs: 0,
    sleep: '',
    wake: '',
    sleepHours: null,
    quality: '',
    meals: {},
    checks: {},
    supps: {},
    medications: {},
    notes: '',
    weight: null,
    meas: {
      waist: null,
      chest: null,
      hips: null,
      arm: null,
      thigh: null,
      neck: null,
    },
    symptoms: {},
    symNotes: '',
    mood: null,
    exercise: 0,
    isFreeze: false,
    consumedCalories: 0,
    consumedProtein: 0,
    consumedCarbs: 0,
    consumedFats: 0,
    isFasting: false,
    fastingStartTime: null,
    fastingEndTime: null,
    completedFastingHours: null,
  };
}

export function loadPlanFromStorage(): PlanConfig {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // PIN لم يعد مصدر دخول: امسح القيم القديمة المعروفة إن وُجدت
      if (parsed.adminPin === '1234' || parsed.adminPin === '32184') {
        parsed.adminPin = '';
        try {
          localStorage.setItem(PLAN_KEY, JSON.stringify({ ...DEFAULT_PLAN, ...parsed }));
        } catch (e) {}
      }
      return { ...DEFAULT_PLAN, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load plan', e);
  }
  return DEFAULT_PLAN;
}

export function savePlanToStorage(plan: PlanConfig): boolean {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    return true;
  } catch (e) {
    console.error('Failed to save plan', e);
    return false;
  }
}

export function loadDayLog(dateStr: string): DayLog {
  try {
    const raw = localStorage.getItem(DAY_PREFIX + dateStr);
    if (raw) {
      const parsed = JSON.parse(raw);
      const empty = createEmptyDayLog();
      return {
        ...empty,
        ...parsed,
        meas: { ...empty.meas, ...(parsed.meas || {}) },
        meals: parsed.meals || {},
        checks: parsed.checks || {},
        supps: parsed.supps || {},
        medications: parsed.medications || {},
        symptoms: parsed.symptoms || {},
      };
    }
  } catch (e) {
    console.error('Failed to load day log', e);
  }
  return createEmptyDayLog();
}

export function saveDayLog(dateStr: string, day: DayLog): boolean {
  try {
    localStorage.setItem(DAY_PREFIX + dateStr, JSON.stringify(day));
    return true;
  } catch (e) {
    console.error('Failed to save day log', e);
    return false;
  }
}

export function getAllStoredDayLogs(): Record<string, DayLog> {
  const result: Record<string, DayLog> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DAY_PREFIX)) {
      const dateStr = key.slice(DAY_PREFIX.length);
      try {
        result[dateStr] = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {
        // skip corrupted
      }
    }
  }
  return result;
}

export function exportFullBackupJSON(): string {
  const plan = loadPlanFromStorage();
  const dailyLogs = getAllStoredDayLogs();
  const activeFastingSession = getActiveFastingSession();
  let notificationSettings = null;
  try {
    const rawNotifs = localStorage.getItem(StorageKeys.notificationSettings());
    if (rawNotifs) notificationSettings = JSON.parse(rawNotifs);
  } catch (e) {}

  const backup = {
    app: 'NutritionTracker_Egypt_Pro',
    version: '7.0-PWA',
    releaseName: 'إصدار PWA التنبيهات الذكية وحاسبة الماكروز والصيام',
    exportedAt: new Date().toISOString(),
    plan,
    dailyLogs,
    activeFastingSession,
    notificationSettings,
  };
  return JSON.stringify(backup, null, 2);
}

export function importFullBackupJSON(jsonString: string): boolean {
  try {
    // SDV2-DATA-002: التحقق من البنية قبل الكتابة — لا نجاح على بيانات فارغة.
    if (!jsonString || jsonString.length > 50 * 1024 * 1024) {
      console.error('Backup file empty or too large');
      return false;
    }
    const data = JSON.parse(jsonString);
    // يجب أن يحتوي على قسم واحد على الأقل من أقسام النسخة المعروفة
    const hasContent = data.plan || data.dailyLogs || data.notificationSettings ||
      data.activeFastingSession || data.medications || data.bodyLogs;
    if (!hasContent) {
      console.error('Backup file has no recognized data sections');
      return false;
    }
    if (data.plan) {
      savePlanToStorage(data.plan);
    }
    if (data.notificationSettings) {
      localStorage.setItem(StorageKeys.notificationSettings(), JSON.stringify(data.notificationSettings));
    }
    if (data.activeFastingSession && typeof data.activeFastingSession === 'object') {
      saveActiveFastingSession(data.activeFastingSession);
    }
    if (data.dailyLogs && typeof data.dailyLogs === 'object') {
      Object.entries(data.dailyLogs).forEach(([dateStr, log]) => {
        localStorage.setItem(DAY_PREFIX + dateStr, JSON.stringify(log));
      });
    }
    return true;
  } catch (e) {
    console.error('Failed to import backup', e);
    return false;
  }
}

export function downloadJsonFile(filename: string, jsonString: string): void {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getBackupSummary(): { dayCount: number; clientName: string; exportedAt: string } {
  const plan = loadPlanFromStorage();
  const dailyLogs = getAllStoredDayLogs();
  return {
    dayCount: Object.keys(dailyLogs).length,
    clientName: plan.clientName || 'المتدرب',
    exportedAt: new Date().toLocaleDateString('ar-EG', { dateStyle: 'medium' }),
  };
}
