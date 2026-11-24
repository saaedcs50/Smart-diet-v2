import { ConditionItem, MedicationItem, PlanConfig } from '../types';
import { StorageKeys } from './storageKeys';

/**
 * Batch 2.5 — استبيان العميل الجديد (Intake): تحويل نقي إجابات → مسودة خطة.
 *
 * حدّ صارم: المسودة تُحفظ في مفتاح intakeDraft مستقل ولا تلمس الخطة النشطة
 * بأي شكل. لا تصبح خطة إلا باستيرادها في لوحة الأخصائية ومراجعتها وحفظها
 * بمسار الحفظ القائم نفسه.
 */

export interface IntakeAnswers {
  clientName: string;
  heightCm: number | null;
  startWeight: number | null;
  targetWeight: number | null;
  targetWaist?: number | null;
  conditions: ConditionItem[];
  allergies: string[];
  /** أدوية حالية: سطر لكل دواء، بصيغة «الاسم - الجرعة» أو الاسم فقط */
  medicationsText: string;
  sleepHours?: number | null;
  activityLevel?: 'low' | 'moderate' | 'high' | '';
  fastingType?: 'none' | 'islamic' | 'christian' | 'intermittent' | '';
  goal?: string;
  notes?: string;
}

export interface IntakeDraftRecord {
  draft: PlanConfig;
  createdAt: string;
  source: 'intake';
}

const DIABETES_CONDITION_IDS = ['t2dm', 't1dm', 'insulin_resistance'];

/** تحويل الأدوية المكتوبة إلى مسودة غير مكتملة؛ لا نفترض جرعة أو تكرارًا أو توقيتًا. */
export function parseIntakeMedications(text: string): MedicationItem[] {
  return String(text || '')
    .split(/\n|؛|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [namePart, ...doseParts] = line.split(/\s[-–—]\s/);
      const name = (namePart || line).trim();
      const dose = doseParts.join(' - ').trim();
      return {
        id: `intake_med_${idx + 1}`,
        name,
        dose,
        timesPerDay: 0,
        timings: [],
        active: true,
        coachNotes: 'من استبيان المريض — لم تُذكر مرات التناول أو مواعيده؛ أدخلها بعد مراجعة الوصفة',
      };
    })
    .filter((m) => m.name.length > 0);
}

/**
 * يبني مسودة PlanConfig من الإجابات فوق الخطة الأساسية (كقالب للوجبات
 * والبنود الافتراضية المحافظة). لا يعدّل الخطة المُمرَّرة نفسها.
 */
export function buildIntakeDraftPlan(answers: IntakeAnswers, basePlan: PlanConfig): PlanConfig {
  const draft: PlanConfig = JSON.parse(JSON.stringify(basePlan)) as PlanConfig;

  draft.clientName = answers.clientName?.trim() || draft.clientName;
  if (answers.heightCm) draft.heightCm = answers.heightCm;
  if (answers.startWeight) draft.startWeight = answers.startWeight;
  if (answers.targetWeight) draft.targetWeight = answers.targetWeight;
  if (answers.targetWaist) draft.targetWaist = answers.targetWaist;

  draft.medicalConditions = {
    conditions: answers.conditions || [],
    allergies: answers.allergies || [],
    showToClient: true,
    customConditionNotes: [answers.goal?.trim(), answers.notes?.trim()].filter(Boolean).join(' — ') || undefined,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: 'coach',
  };

  const medications = parseIntakeMedications(answers.medicationsText || '');
  if (medications.length > 0) {
    draft.medicationPlan = {
      showToClient: true,
      items: medications,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: 'coach',
    };
  }

  // انعكاس الحالات الطبية في الأقسام المقترحة
  const conditionIds = new Set((answers.conditions || []).map((c) => c.id));
  const visible = { ...(draft.visibleSections || {}) };

  if ([...conditionIds].some((id) => DIABETES_CONDITION_IDS.includes(id))) {
    // سكري: تتبّع التحاليل (سكر صائم) + الماكروز لضبط الكربوهيدرات
    visible.labTracker = true;
    visible.macrosTracker = true;
    draft.enableMacrosTracker = true;
    if (!draft.labTracking) {
      draft.labTracking = { showToClient: true, allowClientAdd: false, entries: [] };
    }
  }
  if (conditionIds.has('pcos')) {
    draft.cycleTracking = {
      enabled: true,
      showPhaseToClient: true,
      regularity: 'unknown',
      typicalCycleLength: 28,
      typicalPeriodLength: 5,
      clinicalFlags: ['pcos'],
    };
    visible.cycleTracker = true;
  }
  if (conditionIds.has('hypertension') || conditionIds.has('hyperlipidemia')) {
    visible.labTracker = true;
    if (!draft.labTracking) {
      draft.labTracking = { showToClient: true, allowClientAdd: false, entries: [] };
    }
  }
  draft.visibleSections = visible;

  if (answers.fastingType && answers.fastingType !== 'none') {
    draft.fastingPlan = {
      enabled: true,
      type: answers.fastingType,
      notes: 'من استبيان العميل — راجِع التفاصيل قبل الاعتماد',
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: 'coach',
    };
  }

  return draft;
}

// ── تخزين المسودة (مستقل عن الخطة النشطة) ────────────────────────────────

export function saveIntakeDraft(draft: PlanConfig): void {
  try {
    const record: IntakeDraftRecord = { draft, createdAt: new Date().toISOString(), source: 'intake' };
    localStorage.setItem(StorageKeys.intakeDraft(), JSON.stringify(record));
  } catch {
    // تجاهل أخطاء المساحة/الوضع الخاص
  }
}

export function loadIntakeDraft(): IntakeDraftRecord | null {
  try {
    const raw = localStorage.getItem(StorageKeys.intakeDraft());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntakeDraftRecord;
    if (!parsed || !parsed.draft || typeof parsed.draft !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearIntakeDraft(): void {
  try {
    localStorage.removeItem(StorageKeys.intakeDraft());
  } catch {
    // تجاهل
  }
}
