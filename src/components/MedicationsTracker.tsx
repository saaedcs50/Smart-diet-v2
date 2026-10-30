import React, { useState } from 'react';
import {
 Pill,
 Check,
 X,
 Clock,
 ChevronDown,
 ChevronUp,
 AlertCircle,
 Circle,
 Info,
 Calendar,
 CheckCircle2,
 XCircle,
 HelpCircle,
 MessageSquare
} from 'lucide-react';
import { PlanConfig, DayLog, DoseStatus, DoseLogEntry } from '../types';
import {
 getAllScheduledDoses,
 calculateDailyMedicationAdherence,
 WITH_FOOD_LABELS,
 MedicationDoseSlotInstance,
} from '../utils/medications';

interface MedicationsTrackerProps {
 plan: PlanConfig;
 day: DayLog;
 onUpdateDay: (updated: DayLog) => void;
}

export const MedicationsTracker: React.FC<MedicationsTrackerProps> = ({
 plan,
 day,
 onUpdateDay,
}) => {
 const medPlan = plan.medicationPlan;

 // Hooks أولًا دائمًا — قبل أي إرجاع مبكر (قواعد Hooks)
 const [expandedNotesKey, setExpandedNotesKey] = useState<string | null>(null);
 const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
 const [tempNoteText, setTempNoteText] = useState('');
 // If no medications configured or coach hidden them, don't show card
 if (!medPlan || medPlan.showToClient === false ||!medPlan.items || medPlan.items.length === 0) {
 return null;
 }

 const activeItems = (medPlan.items || []).filter((m) => m.active!== false);
 if (activeItems.length === 0) return null;

 const scheduledDoses = getAllScheduledDoses(activeItems);
 const adherence = calculateDailyMedicationAdherence(activeItems, day);
 const currentLogs = day.medications || {};

 const handleSetDoseStatus = (doseKey: string, status: DoseStatus) => {
 const currentEntry = currentLogs[doseKey];
 
 // Toggle off if clicking the same status
 if (currentEntry?.status === status) {
 const nextLogs = {...currentLogs };
 delete nextLogs[doseKey];
 onUpdateDay({
...day,
 medications: nextLogs,
 });
 return;
 }

 const now = new Date();
 const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

 const newEntry: DoseLogEntry = {
...(currentEntry || {}),
 status,
 time: currentEntry?.time || timeStr,
 loggedAt: Date.now(),
 };

 onUpdateDay({
...day,
 medications: {
...currentLogs,
 [doseKey]: newEntry,
 },
 });
 };

 const handleSaveDoseNote = (doseKey: string) => {
 const currentEntry = currentLogs[doseKey] || { status: 'taken' };
 onUpdateDay({
...day,
 medications: {
...currentLogs,
 [doseKey]: {
...currentEntry,
 note: tempNoteText.trim(),
 },
 },
 });
 setEditingNoteKey(null);
 setTempNoteText('');
 };

 const handleOpenNoteEditor = (doseKey: string, existingNote?: string) => {
 setEditingNoteKey(doseKey);
 setTempNoteText(existingNote || '');
 };

 return (
 <div className="bg-[var(--app-card)] border border-[var(--app-border)]/80 rounded-3xl p-4 sm:p-5 transition-colors space-y-4">
 {/* Header with Title and Independent Adherence Score */}
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-[var(--app-secondary)] dark:text-[var(--app-secondary)] flex items-center justify-center font-bold">
 <Pill className="w-5 h-5" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-bold text-[var(--app-text-primary)] text-sm sm:text-base">
 أدوية اليوم والالتزام الدوائي 
 </h3>
 <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[var(--app-secondary)]/10 dark:bg-[var(--app-secondary)]/20 text-[var(--app-secondary)] dark:text-[var(--app-secondary)] border border-[var(--app-secondary)]/20">
 مستقل عن نقاط الدايت
 </span>
 </div>
 <p className="text-[12px] text-[var(--app-text-secondary)]">
 سجّل جرعاتك اليومية في مواعيدها لتثبيت الالتزام مع الأخصائي
 </p>
 </div>
 </div>

 {/* Adherence Mini Badge */}
 {adherence.totalScheduledNonPRN > 0 && (
 <div className="text-left shrink-0">
 <div className="flex items-center gap-1 font-bold text-xs text-[var(--app-secondary)] dark:text-[var(--app-secondary)] justify-end">
 <span>{adherence.totalTaken}/{adherence.totalScheduledNonPRN}</span>
 <span className="text-[12px] text-[var(--app-text-secondary)]">جرعة</span>
 </div>
 <div className="w-18 bg-[var(--app-card-muted)] rounded-full h-1.5 mt-1 overflow-hidden">
 <div
 className={`h-full transition-all duration-150 ${
 adherence.adherencePercentage === 100
? 'bg-[#4D52B4]'
: adherence.adherencePercentage >= 50
? 'bg-[var(--app-secondary)]'
: 'bg-[#E0922D]'
 }`}
 style={{ width: `${adherence.adherencePercentage}%` }}
 />
 </div>
 </div>
 )}
 </div>

 {/* Doses List */}
 <div className="space-y-2.5">
 {scheduledDoses.map((dose) => {
 const entry = currentLogs[dose.key];
 const status = entry?.status;
 const isTaken = status === 'taken';
 const isSkipped = status === 'skipped';
 const isPostponed = status === 'postponed';
 const withFoodInfo = dose.withFood? WITH_FOOD_LABELS[dose.withFood]: null;
 const showNotes = expandedNotesKey === dose.key;

 return (
 <div
 key={dose.key}
 className={`rounded-2xl border transition-all ${
 isTaken
? 'bg-[#4D52B4]/10 dark:bg-[#4D52B4]/15 border-[#4D52B4]/30 dark:border-[#4D52B4]/30'
: isSkipped
? 'bg-[var(--app-hero)]/10 dark:bg-[var(--app-hero)]/15 border-[var(--app-hero)]/30 dark:border-[var(--app-hero)]/30'
: isPostponed
? 'bg-[#E0922D]/10 dark:bg-[#E0922D]/15 border-[#E0922D]/30 dark:border-[#E0922D]/30'
: 'bg-[var(--app-card-muted)] border-[var(--app-border)]/60 hover:border-[var(--app-secondary)]/30'
 }`}
 >
 {/* Main Dose Row */}
 <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 {/* Info side */}
 <div className="space-y-1 min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-bold text-[var(--app-text-primary)] text-xs sm:text-sm">
 {dose.medicationName}
 </span>
 <span className="px-2 py-0.5 rounded-lg text-[12px] font-bold bg-[var(--app-secondary)]/10 dark:bg-[var(--app-secondary)]/20 text-[var(--app-secondary)] dark:text-[var(--app-secondary)]">
 {dose.dose}
 </span>
 {dose.isPRN && (
 <span className="px-1.5 py-0.5 rounded-md text-[12px] font-bold bg-[var(--app-hero)]/10 dark:bg-[var(--app-hero)]/20 text-[var(--app-hero)] dark:text-[var(--app-hero-hover)]">
 عند اللزوم
 </span>
 )}
 </div>

 {/* Slot & Food hint */}
 <div className="flex items-center gap-2 flex-wrap text-[12px] text-[var(--app-text-secondary)] font-medium">
 <span className="flex items-center gap-1 text-[var(--app-text-primary)] font-bold">
 <Clock className="w-3 h-3 text-[var(--app-secondary)] dark:text-[var(--app-secondary)]" />
 {dose.slotLabel}
 </span>

 {withFoodInfo && withFoodInfo.hint && (
 <span className="text-[var(--app-border)]">•</span>
 )}

 {withFoodInfo && withFoodInfo.hint && (
 <span className={`px-1.5 py-0.5 rounded text-[12px] font-bold ${withFoodInfo.badgeColor}`}>
 {withFoodInfo.label}
 </span>
 )}
 </div>
 </div>

 {/* Interactive Status Buttons */}
 <div className="flex items-center gap-1.5 shrink-0">
 {/* Taken button */}
 <button
 type="button"
 onClick={() => handleSetDoseStatus(dose.key, 'taken')}
 className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
 isTaken
? 'bg-[#4D52B4] text-white scale-102'
: 'bg-[var(--app-card)] text-[var(--app-text-primary)] border border-[var(--app-border)]/70 hover:bg-[#4D52B4]/10'
 }`}
 >
 <Check className="w-3.5 h-3.5" />
 <span>أخذت الجرعة</span>
 </button>

 {/* Skipped button */}
 <button
 type="button"
 onClick={() => handleSetDoseStatus(dose.key, 'skipped')}
 className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
 isSkipped
? 'bg-[var(--app-hero)] text-white'
: 'bg-[var(--app-card)] text-[var(--app-text-secondary)] border border-[var(--app-border)]/70 hover:bg-[var(--app-hero)]/10'
 }`}
 title="لم آخذ الجرعة"
 >
 <X className="w-3.5 h-3.5" />
 <span>لم آخذ</span>
 </button>

 {/* Postponed button */}
 <button
 type="button"
 onClick={() => handleSetDoseStatus(dose.key, 'postponed')}
 className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
 isPostponed
? 'bg-[#E0922D] text-white'
: 'bg-[var(--app-card)] text-[var(--app-text-secondary)] border border-[var(--app-border)]/70 hover:bg-[#E0922D]/10'
 }`}
 title="تأجيل الجرعة لوقت لاحق"
 >
 <Clock className="w-3.5 h-3.5" />
 <span>تأجيل</span>
 </button>
 </div>
 </div>

 {/* Bottom Expandable Bar: Interactions / Notes */}
 <div className="px-3.5 py-2 border-t border-[var(--app-border)]/50 flex items-center justify-between text-[12px]">
 <div className="flex items-center gap-2 text-[var(--app-text-secondary)] min-w-0">
 {entry?.time && (
 <span className="font-bold text-[var(--app-text-primary)]">
 سُجلت {entry.time}
 </span>
 )}
 {entry?.note && (
 <span className="text-[var(--app-secondary)] dark:text-[var(--app-secondary)] truncate max-w-[200px]">
 {entry.note}
 </span>
 )}
 </div>

 <div className="flex items-center gap-2 shrink-0">
 {/* Note adder */}
 <button
 type="button"
 onClick={() => handleOpenNoteEditor(dose.key, entry?.note)}
 className="text-[12px] font-bold text-[var(--app-text-secondary)] hover:text-[var(--app-secondary)] flex items-center gap-0.5 cursor-pointer"
 >
 <MessageSquare className="w-3 h-3" />
 <span>{entry?.note? 'تعديل الملاحظة': 'إضافة ملاحظة'}</span>
 </button>

 {/* Details Toggle */}
 {(dose.foodInteractionNote || dose.coachNotes || (withFoodInfo && withFoodInfo.hint)) && (
 <button
 type="button"
 onClick={() => setExpandedNotesKey(showNotes? null: dose.key)}
 className="text-[12px] font-bold text-[var(--app-secondary)] dark:text-[var(--app-secondary)] flex items-center gap-0.5 cursor-pointer"
 >
 <span>{showNotes? 'طي التفاصيل': 'عرض التنبيهات'}</span>
 {showNotes? <ChevronUp className="w-3 h-3" />: <ChevronDown className="w-3 h-3" />}
 </button>
 )}
 </div>
 </div>

 {/* Note Editor inline */}
 {editingNoteKey === dose.key && (
 <div className="p-3 bg-[var(--app-card)] border-t border-[var(--app-border)]/70 space-y-2 animate-in fade-in duration-100">
 <input
 type="text"
 placeholder="اكتب ملاحظتك (مثال: شعرت بغثيان خفيف، أو تأخرت ساعة...)"
 value={tempNoteText}
 onChange={(e) => setTempNoteText(e.target.value)}
 className="w-full text-xs p-2 rounded-xl border border-[var(--app-border)]/70 bg-[var(--app-card-muted)] text-[var(--app-text-primary)] outline-none focus:ring-2 focus:ring-[var(--app-secondary)]"
 />
 <div className="flex justify-end gap-2">
 <button
 type="button"
 onClick={() => setEditingNoteKey(null)}
 className="px-3 py-1 rounded-lg text-xs font-bold text-[var(--app-text-secondary)] hover:bg-[var(--app-card-muted)] cursor-pointer"
 >
 إلغاء
 </button>
 <button
 type="button"
 onClick={() => handleSaveDoseNote(dose.key)}
 className="px-4 py-1 rounded-lg text-xs font-bold bg-[var(--app-secondary)] text-white hover:bg-[#4A1D6B] cursor-pointer"
 >
 حفظ الملاحظة
 </button>
 </div>
 </div>
 )}

 {/* Expanded Card Details */}
 {showNotes && (
 <div className="p-3 rounded-b-2xl bg-[var(--app-secondary)]/10 dark:bg-[var(--app-card-muted)] border-t border-[var(--app-border)]/50 space-y-2 text-xs animate-in fade-in duration-150">
 {withFoodInfo && withFoodInfo.hint && (
 <div className="text-[12px] text-[var(--app-text-primary)] flex items-start gap-1.5 font-medium">
 <Info className="w-3.5 h-3.5 text-[var(--app-secondary)] dark:text-[var(--app-secondary)] shrink-0 mt-0.5" />
 <span>
 <strong>طريقة التناول:</strong> {withFoodInfo.hint}
 </span>
 </div>
 )}

 {dose.foodInteractionNote && (
 <div className="p-2 rounded-xl bg-[#E0922D]/10 dark:bg-[#E0922D]/20 border border-[#E0922D]/30 text-[12px] text-[#E0922D] dark:text-[#F2C66D] flex items-start gap-1.5 font-medium">
 <AlertCircle className="w-3.5 h-3.5 text-[#E0922D] shrink-0 mt-0.5" />
 <span>
 <strong>تنبيه تفاعل الطعام:</strong> {dose.foodInteractionNote}
 </span>
 </div>
 )}

 {dose.coachNotes && (
 <p className="text-[12px] text-[var(--app-text-secondary)] font-medium">
 <strong>توجيه الأخصائي:</strong> {dose.coachNotes}
 </p>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
};
