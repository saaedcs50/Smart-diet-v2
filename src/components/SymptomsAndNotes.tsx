import React from 'react';
import { Stethoscope, MessageSquare, AlertTriangle, Send } from 'lucide-react';
import { PlanConfig, DayLog } from '../types';
import { BRAND } from '../config/brand';
import { isSectionVisible } from '../utils/storage';
import { HelpButton } from './FeatureHelpModal';

interface SymptomsAndNotesProps {
 plan: PlanConfig;
 day: DayLog;
 onUpdateDay: (updated: DayLog) => void;
}

export const SymptomsAndNotes: React.FC<SymptomsAndNotesProps> = ({ plan, day, onUpdateDay }) => {
 const showSymptoms = isSectionVisible(plan, 'symptomsTracker') && plan.symptomsList && plan.symptomsList.length > 0;
 const showDoctorNotes = isSectionVisible(plan, 'doctorNotes');

 if (!showSymptoms &&!showDoctorNotes) {
 return null;
 }

 const toggleSymptom = (id: string) => {
 onUpdateDay({
...day,
 symptoms: {
...day.symptoms,
 [id]:!day.symptoms[id],
 },
 });
 };

 return (
 <div className="bg-[var(--app-card)] border border-[var(--app-border)]/80 rounded-3xl p-5 transition-colors space-y-4">
 {/* Symptoms section */}
 {showSymptoms && (
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl text-[var(--app-hero)] dark:text-[var(--app-hero-hover)] flex items-center justify-center font-bold text-sm">
 <Stethoscope className="w-4 h-4" />
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <h3 className="font-bold text-[var(--app-text-primary)] text-sm">
 الأعراض أو الملاحظات الجسدية 
 </h3>
 <HelpButton featureId="symptomsAndNotes" size="sm" />
 </div>
 <span className="text-[12px] text-[var(--app-text-secondary)]">
 حدد أي عَرَض شعرت به لمتابعة الخطة وتعديلها إذا لزم الأمر
 </span>
 </div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {plan.symptomsList.map((sym) => {
 const isSelected =!!day.symptoms[sym.id];
 return (
 <button
 key={sym.id}
 onClick={() => toggleSymptom(sym.id)}
 className={`p-2.5 rounded-2xl border text-xs font-semibold transition-all text-center cursor-pointer ${
 isSelected
? 'bg-[var(--app-hero)]/10 dark:bg-[var(--app-hero)]/20 text-[var(--app-hero)] dark:text-[var(--app-hero-hover)] border-[var(--app-hero)]/30'
: 'bg-[var(--app-card-muted)] text-[var(--app-text-primary)] border-[var(--app-border)]/60 hover:bg-[var(--app-card-muted)]'
 }`}
 >
 {isSelected? ' ': ''}
 {sym.label}
 </button>
 );
 })}
 </div>

 <textarea
 rows={2}
 value={day.symNotes || ''}
 onChange={(e) => onUpdateDay({...day, symNotes: e.target.value })}
 placeholder="تفاصيل إضافية حول الأعراض..."
 className="w-full text-xs p-3 rounded-2xl border border-[var(--app-border)]/70 bg-[var(--app-card-muted)] text-[var(--app-text-primary)] outline-none focus:ring-2 focus:ring-[var(--app-hero)] resize-none"
 />
 </div>
 )}

 {/* Direct Doctor Notes */}
 {showDoctorNotes && (
 <div className={`${showSymptoms? 'pt-3 border-t border-[var(--app-border)]/50': ''} space-y-2`}>
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl text-[#4D52B4] dark:text-[#70D6C5] flex items-center justify-center font-bold text-sm">
 <MessageSquare className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-[var(--app-text-primary)] text-xs">
 ملاحظات واستفسارات لـ {BRAND.doctorName} 
 </h4>
 <span className="text-[12px] text-[var(--app-text-secondary)]">
 تُرفق تلقائياً مع تقرير المتابعة اليومي
 </span>
 </div>
 </div>

 <textarea
 rows={3}
 value={day.notes || ''}
 onChange={(e) => onUpdateDay({...day, notes: e.target.value })}
 placeholder={`أدخل أي استفسار أو تفاصيل ترغب بمشاركتها مع ${BRAND.doctorName}...`}
 className="w-full text-xs p-3 rounded-2xl border border-[var(--app-border)]/70 bg-[var(--app-card-muted)] text-[var(--app-text-primary)] outline-none focus:ring-2 focus:ring-[#4D52B4] resize-none leading-relaxed"
 />
 </div>
 )}
 </div>
 );
};
