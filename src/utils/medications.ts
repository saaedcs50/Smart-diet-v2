import { MedicationSlot, WithFoodOption, AppetiteEffect, WeightEffect, MedicationItem, DayLog } from '../types';

export interface SlotOptionMeta {
 slot: MedicationSlot;
 label: string;
 category: 'breakfast' | 'lunch' | 'dinner' | 'general';
 icon: string;
}

export const MEDICATION_SLOT_OPTIONS: SlotOptionMeta[] = [
 // وجبة الإفطار
 { slot: 'before_breakfast', label: 'قبل الإفطار بـ 30-60 دقيقة', category: 'breakfast', icon: '' },
 { slot: 'with_breakfast', label: 'مع الإفطار', category: 'breakfast', icon: '' },
 { slot: 'after_breakfast', label: 'بعد الإفطار', category: 'breakfast', icon: '' },

 // وجبة الغداء
 { slot: 'before_lunch', label: 'قبل الغداء', category: 'lunch', icon: '' },
 { slot: 'with_lunch', label: 'مع الغداء', category: 'lunch', icon: '' },
 { slot: 'after_lunch', label: 'بعد الغداء', category: 'lunch', icon: '' },

 // وجبة العشاء
 { slot: 'before_dinner', label: 'قبل العشاء', category: 'dinner', icon: '' },
 { slot: 'with_dinner', label: 'مع العشاء', category: 'dinner', icon: '' },
 { slot: 'after_dinner', label: 'بعد العشاء', category: 'dinner', icon: '' },

 // عام / بدون ربط وجبة
 { slot: 'morning', label: 'صباحاً (بدون ربط وجبة)', category: 'general', icon: '' },
 { slot: 'evening', label: 'مساءً (بدون ربط وجبة)', category: 'general', icon: '' },
 { slot: 'before_sleep', label: 'قبل النوم', category: 'general', icon: '' },
 { slot: 'prn', label: 'حسب الحاجة (PRN)', category: 'general', icon: '' },
];

export const WITH_FOOD_LABELS: Record<WithFoodOption, { label: string; hint: string; badgeColor: string }> = {
 required: { label: 'مع الأكل / الوجبة حتماً', hint: 'يؤخذ أثناء أو مباشرة بعد الوجبة لحماية المعدة وزيادة الامتصاص', badgeColor: 'bg-peacock-pale text-peacock-indigo-deep border-peacock-teal-light dark:bg-peacock-ink-deep dark:text-peacock-teal-light' },
 empty_stomach: { label: 'على معدة فارغة', hint: 'يؤخذ على الريق أو قبل الأكل بساعة أو بعده بساعتين', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300' },
 optional: { label: 'مع أو بدون الأكل (اختياري)', hint: 'لا يتأثر بوجود الطعام', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300' },
 unspecified: { label: 'غير محدد', hint: '', badgeColor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400' },
};

export const APPETITE_EFFECT_LABELS: Record<AppetiteEffect, { label: string; icon: string; color: string }> = {
 decrease: { label: 'يقلل الشهية / يساعد على الشبع', icon: '', color: 'text-peacock-indigo dark:text-peacock-teal' },
 increase: { label: 'قد يزيد الشهية / يسبب جوعاً', icon: '', color: 'text-amber-600 dark:text-amber-400' },
 none: { label: 'لا تأثير معروف على الشهية', icon: '', color: 'text-slate-500' },
 unknown: { label: 'غير محدد', icon: '', color: 'text-slate-400' },
};

export const WEIGHT_EFFECT_LABELS: Record<WeightEffect, { label: string; icon: string; color: string }> = {
 loss: { label: 'قد يساهم في نزول الوزن', icon: '', color: 'text-peacock-indigo dark:text-peacock-teal' },
 gain: { label: 'قد يسبب زيادة وزن أو احتباس سوائل', icon: '', color: 'text-rose-600 dark:text-rose-400' },
 none: { label: 'محايد على الوزن', icon: '', color: 'text-slate-500' },
 unknown: { label: 'غير محدد', icon: '', color: 'text-slate-400' },
};

export interface MedicationDoseSlotInstance {
 key: string; // unique dose key: `${med.id}__${timing.slot}`
 medicationId: string;
 medicationName: string;
 dose: string;
 slot: MedicationSlot;
 slotLabel: string;
 withFood?: WithFoodOption;
 appetiteEffect?: AppetiteEffect;
 weightEffect?: WeightEffect;
 foodInteractionNote?: string;
 coachNotes?: string;
 isPRN: boolean;
}

/**
 * Extracts all scheduled dose instances for a day from active medications
 */
export function getAllScheduledDoses(medications: MedicationItem[] = []): MedicationDoseSlotInstance[] {
 const doses: MedicationDoseSlotInstance[] = [];
 const activeMeds = medications.filter((m) => m.active!== false);

 activeMeds.forEach((med) => {
 (med.timings || []).forEach((t) => {
 doses.push({
 key: `${med.id}__${t.slot}`,
 medicationId: med.id,
 medicationName: med.name,
 dose: med.dose,
 slot: t.slot,
 slotLabel: t.label || t.slot,
 withFood: med.withFood,
 appetiteEffect: med.appetiteEffect,
 weightEffect: med.weightEffect,
 foodInteractionNote: med.foodInteractionNote,
 coachNotes: med.coachNotes,
 isPRN: t.slot === 'prn',
 });
 });
 });

 return doses;
}

/**
 * Calculates medication adherence rate for a single day log
 * Rate = (Taken non-PRN doses / Scheduled non-PRN doses) * 100
 */
export function calculateDailyMedicationAdherence(
 medications: MedicationItem[] = [],
 day: DayLog
): {
 totalScheduledNonPRN: number;
 totalTaken: number;
 totalSkipped: number;
 totalPostponed: number;
 adherencePercentage: number;
 hasMedications: boolean;
} {
 const scheduled = getAllScheduledDoses(medications);
 const nonPRN = scheduled.filter((d) =>!d.isPRN);

 if (nonPRN.length === 0) {
 return {
 totalScheduledNonPRN: 0,
 totalTaken: 0,
 totalSkipped: 0,
 totalPostponed: 0,
 adherencePercentage: 100,
 hasMedications: scheduled.length > 0,
 };
 }

 const logs = day.medications || {};
 let taken = 0;
 let skipped = 0;
 let postponed = 0;

 nonPRN.forEach((dose) => {
 const entry = logs[dose.key];
 if (entry) {
 if (entry.status === 'taken') taken++;
 else if (entry.status === 'skipped') skipped++;
 else if (entry.status === 'postponed') postponed++;
 }
 });

 const adherencePercentage = Math.round((taken / nonPRN.length) * 100);

 return {
 totalScheduledNonPRN: nonPRN.length,
 totalTaken: taken,
 totalSkipped: skipped,
 totalPostponed: postponed,
 adherencePercentage,
 hasMedications: true,
 };
}
