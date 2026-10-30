import React, { useState } from 'react';
import {
 Stethoscope,
 Check,
 Plus,
 Trash2,
 AlertTriangle,
 Circle,
 Info,
 Sliders,
 ShieldCheck,
 ChevronDown,
 ChevronUp,
 Tag,
 ArrowRightLeft,
 Flame,
 Droplets,
 HeartPulse,
 Eye,
 EyeOff,
 CheckCircle2
} from 'lucide-react';
import { PlanConfig, ConditionItem, MedicalConditionsConfig } from '../types';
import {
 SUPPORTED_CONDITIONS,
 MedicalConditionMeta,
 calculateClinicalMacrosSuggestion,
 SuggestedMacrosResult,
} from '../utils/medicalConditions';

interface MedicalConditionsEditorProps {
 draft: PlanConfig;
 onUpdateDraft: (updated: PlanConfig) => void;
 onNotify: (msg: string) => void;
}

const COMMON_ALLERGIES = [
 'حساسية الجلوتين (Gluten)',
 'عدم تحمل اللاكتوز (Lactose)',
 'حساسية المكسرات (Nuts)',
 'حساسية البيض (Eggs)',
 'حساسية القشريات والأسماك',
 'حساسية فول الصويا (Soy)',
 'حساسية السمسم',
 'حساسية الفراولة / الموز',
];

export const MedicalConditionsEditor: React.FC<MedicalConditionsEditorProps> = ({
 draft,
 onUpdateDraft,
 onNotify,
}) => {
 const currentMedical: MedicalConditionsConfig = draft.medicalConditions || {
 conditions: [],
 allergies: [],
 showToClient: true,
 };

 const [activeCategory, setActiveCategory] = useState<string>('all');
 const [showMacroSuggestionModal, setShowMacroSuggestionModal] = useState(false);
 const [suggestedResult, setSuggestedResult] = useState<SuggestedMacrosResult | null>(null);
 const [customAllergyInput, setCustomAllergyInput] = useState('');
 const [expandedConditionId, setExpandedConditionId] = useState<string | null>(null);

 const activeConditionsMap = new Map<string, ConditionItem>(
 (currentMedical.conditions || []).map((c) => [c.id, c])
 );

 const handleToggleCondition = (meta: MedicalConditionMeta) => {
 const existing = activeConditionsMap.get(meta.id);
 let updatedConditions: ConditionItem[];

 if (existing) {
 // Remove
 updatedConditions = (currentMedical.conditions || []).filter((c) => c.id!== meta.id);
 if (expandedConditionId === meta.id) setExpandedConditionId(null);
 } else {
 // Add
 const newItem: ConditionItem = {
 id: meta.id,
 label: meta.label,
 notes: '',
 severity: 'moderate',
 };
 updatedConditions = [...(currentMedical.conditions || []), newItem];
 setExpandedConditionId(meta.id);
 }

 const updatedMedical: MedicalConditionsConfig = {
...currentMedical,
 conditions: updatedConditions,
 lastUpdatedAt: new Date().toISOString(),
 lastUpdatedBy: 'coach',
 };

 onUpdateDraft({
...draft,
 medicalConditions: updatedMedical,
 });
 };

 const handleUpdateConditionItem = (id: string, updates: Partial<ConditionItem>) => {
 const updatedConditions = (currentMedical.conditions || []).map((item) => {
 if (item.id === id) {
 return {...item,...updates };
 }
 return item;
 });

 onUpdateDraft({
...draft,
 medicalConditions: {
...currentMedical,
 conditions: updatedConditions,
 lastUpdatedAt: new Date().toISOString(),
 },
 });
 };

 const handleToggleShowToClient = () => {
 const nextVal =!currentMedical.showToClient;
 onUpdateDraft({
...draft,
 medicalConditions: {
...currentMedical,
 showToClient: nextVal,
 },
 });
 onNotify(nextVal? 'سيظهر ملخص الحالات للعميل في ملفه الصحي ': 'تم إخفاء بطاقة الحالات عن العميل ');
 };

 const handleToggleAllergy = (allergy: string) => {
 const current = currentMedical.allergies || [];
 const exists = current.includes(allergy);
 const updated = exists? current.filter((a) => a!== allergy): [...current, allergy];

 onUpdateDraft({
...draft,
 medicalConditions: {
...currentMedical,
 allergies: updated,
 },
 });
 };

 const handleAddCustomAllergy = (e: React.FormEvent) => {
 e.preventDefault();
 const val = customAllergyInput.trim();
 if (!val) return;
 const current = currentMedical.allergies || [];
 if (!current.includes(val)) {
 onUpdateDraft({
...draft,
 medicalConditions: {
...currentMedical,
 allergies: [...current, val],
 },
 });
 }
 setCustomAllergyInput('');
 };

 const handleCalculateSuggestions = () => {
 if (!currentMedical.conditions || currentMedical.conditions.length === 0) {
 alert('يرجى اختيار حالة مرضية واحدة على الأقل لتوليد الاقتراحات السريرية.');
 return;
 }
 const result = calculateClinicalMacrosSuggestion(currentMedical.conditions, draft);
 setSuggestedResult(result);
 setShowMacroSuggestionModal(true);
 };

 const handleApplySuggestedMacros = () => {
 if (!suggestedResult) return;

 onUpdateDraft({
...draft,
 targetCalories: suggestedResult.suggestedCalories,
 targetProtein: suggestedResult.suggestedProtein,
 targetCarbs: suggestedResult.suggestedCarbs,
 targetFats: suggestedResult.suggestedFats,
 dailyWaterGoalMl: suggestedResult.suggestedWaterMl,
 enableMacrosTracker: true,
 });

 setShowMacroSuggestionModal(false);
 onNotify('تم تطبيق أهداف الماكروز والسعرات المقترحة سريرياً على الخطة بنجاح ');
 };

 const categories = [
 { id: 'all', label: 'جميع الحالات' },
 { id: 'metabolic', label: 'الأيض والسكري' },
 { id: 'endocrine', label: 'الهرمونات والغدد' },
 { id: 'digestive', label: 'الجهاز الهضمي' },
 { id: 'cardiorenal', label: 'القلب والكلى والنقرس' },
 { id: 'allergies_other', label: 'الدم والحساسية' },
 ];

 const filteredConditions = SUPPORTED_CONDITIONS.filter((c) => {
 if (activeCategory === 'all') return true;
 return c.category === activeCategory;
 });

 const activeCount = currentMedical.conditions?.length || 0;
 const allergiesCount = currentMedical.allergies?.length || 0;

 return (
 <div className="space-y-4">
 {/* 1. Header Banner & Quick Actions */}
 <div className="p-4 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-ink/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl text-white flex items-center justify-center font-bold shrink-0">
 <Stethoscope className="w-5 h-5" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">
 ملفات الحالات المرضية والتشخيصات
 </h4>
 <span className="px-2 py-0.5 rounded-full text-[12px] font-black bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light border border-peacock-teal-light dark:border-peacock-indigo">
 {activeCount} {activeCount === 1? 'حالة مسجلة': activeCount === 2? 'حالتان مسجلتان': 'حالات مسجلة'}
 </span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
 سجل التشخيصات ليقترح النظام تلقائياً توزيع الماكروز والسعرات وإرشادات العلاج الغذائي.
 </p>
 </div>
 </div>

 {/* Client Visibility Toggle */}
 <button
 type="button"
 onClick={handleToggleShowToClient}
 className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
 currentMedical.showToClient
? 'bg-peacock-mist dark:bg-peacock-ink-deep/40 text-peacock-indigo-dark dark:text-peacock-teal-light border-peacock-teal-light dark:border-peacock-indigo-deep'
: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
 }`}
 title="تحديد هل تظهر بطاقة الحالة الصحية للعميل في تبويب الجسم أم لا"
 >
 {currentMedical.showToClient? <Eye className="w-3.5 h-3.5 text-peacock-indigo" />: <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
 <span>{currentMedical.showToClient? 'ظاهر للمتدرب': 'مخفي عن المتدرب'}</span>
 </button>
 </div>

 {/* 2. Main Macro Suggestions Trigger Button */}
 <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
 <div className="flex items-center gap-2">
 <Circle className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal shrink-0" />
 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
 {activeCount > 0
? `جاهز لاقتراح وتعديل الماكروز بناءً على (${activeCount}) حالات مسجلة`
: 'حدد الحالات المرضية بالأسفل لتفعيل اقتراحات الماكروز العلاجية'}
 </span>
 </div>
 <button
 type="button"
 disabled={activeCount === 0}
 onClick={handleCalculateSuggestions}
 className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black bg-peacock-indigo hover:bg-peacock-indigo-dark disabled:opacity-40 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Sliders className="w-3.5 h-3.5" />
 <span>تطبيق اقتراحات الماكروز حسب الحالات </span>
 </button>
 </div>

 {/* 3. Category Filter Tabs */}
 <div className="flex gap-1.5 overflow-x-auto pb-1">
 {categories.map((cat) => {
 const isSel = activeCategory === cat.id;
 return (
 <button
 key={cat.id}
 type="button"
 onClick={() => setActiveCategory(cat.id)}
 className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
 isSel
? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
 }`}
 >
 {cat.label}
 </button>
 );
 })}
 </div>

 {/* 4. Grouped Conditions List */}
 <div className="space-y-2.5">
 {filteredConditions.map((meta) => {
 const isActive = activeConditionsMap.has(meta.id);
 const activeItem = activeConditionsMap.get(meta.id);
 const isExpanded = expandedConditionId === meta.id || isActive;

 return (
 <div
 key={meta.id}
 className={`rounded-2xl border transition-all ${
 isActive
? 'bg-peacock-mist/40 dark:bg-peacock-ink-deep/20 border-peacock-teal-light/80 dark:border-peacock-indigo-deep/80'
: 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
 }`}
 >
 {/* Main Selection Row */}
 <div
 onClick={() => handleToggleCondition(meta)}
 className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
 >
 <div className="flex items-center gap-3 min-w-0">
 <div
 className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
 isActive
? 'bg-peacock-indigo border-peacock-indigo text-white'
: 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
 }`}
 >
 {isActive && <Check className="w-3.5 h-3.5" />}
 </div>
 <span className="text-xl shrink-0">{meta.icon}</span>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <h5 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">
 {meta.label}
 </h5>
 <span className="text-[12px] text-slate-400 font-medium hidden sm:inline">
 ({meta.categoryLabel})
 </span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
 {meta.shortDescription}
 </p>
 </div>
 </div>

 {/* Macro guidance badge */}
 <div className="shrink-0 text-left">
 <span
 className={`text-[12px] font-bold px-2 py-0.5 rounded-lg border ${
 isActive
? 'bg-peacock-pale dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-sage border-peacock-teal-light dark:border-peacock-indigo-dark'
: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
 }`}
 >
 {isActive? 'مُفعّلة': 'غير مسجلة'}
 </span>
 </div>
 </div>

 {/* Extended Details / Notes (When condition is active) */}
 {isActive && (
 <div className="px-3.5 pb-3.5 pt-1 border-t border-peacock-sage/60 dark:border-peacock-ink/40 space-y-2.5 animate-in slide-in-from-top duration-150">
 {/* Clinical Guideline Hint */}
 <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-peacock-sage/60 dark:border-peacock-indigo-deep/40 text-[12px] text-peacock-ink dark:text-peacock-sage flex items-start gap-1.5">
 <Info className="w-3.5 h-3.5 text-peacock-indigo shrink-0 mt-0.5" />
 <span>
 <strong>الإرشاد السريري:</strong> {meta.macroRuleSummary}
 </span>
 </div>

 {/* Inputs: Severity & Diagnosis Date */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 <div>
 <label className="block text-[12px] font-bold text-slate-600 dark:text-slate-400 mb-1">
 درجة الحالة (Severity):
 </label>
 <div className="grid grid-cols-3 gap-1">
 {[
 { id: 'mild', label: 'خفيفة' },
 { id: 'moderate', label: 'متوسطة' },
 { id: 'severe', label: 'متقدمة / شديدة' },
 ].map((sev) => (
 <button
 key={sev.id}
 type="button"
 onClick={() => handleUpdateConditionItem(meta.id, { severity: sev.id as any })}
 className={`py-1 px-1 rounded-lg text-[12px] font-bold border transition-colors cursor-pointer ${
 activeItem?.severity === sev.id
? 'bg-peacock-indigo text-white border-peacock-indigo'
: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
 }`}
 >
 {sev.label}
 </button>
 ))}
 </div>
 </div>

 <div>
 <label className="block text-[12px] font-bold text-slate-600 dark:text-slate-400 mb-1">
 تاريخ التشخيص التقريبي (اختياري):
 </label>
 <input
 type="text"
 placeholder="مثال: منذ سنتين، أو 2024"
 value={activeItem?.diagnosedAt || ''}
 onChange={(e) => handleUpdateConditionItem(meta.id, { diagnosedAt: e.target.value })}
 className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
 />
 </div>
 </div>

 {/* Specific notes for this condition */}
 <div>
 <label className="block text-[12px] font-bold text-slate-600 dark:text-slate-400 mb-1">
 ملاحظات الأخصائي السريرية أو الأدوية المرتبطة بهذه الحالة:
 </label>
 <textarea
 rows={2}
 placeholder="مثال: يتناول جلوكوفاج 500 بعد الغداء، تجنب السكريات المكررة تماماً..."
 value={activeItem?.notes || ''}
 onChange={(e) => handleUpdateConditionItem(meta.id, { notes: e.target.value })}
 className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-peacock-blue resize-none"
 />
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* 5. Allergies and Food Intolerances Section */}
 <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Tag className="w-4 h-4 text-amber-500" />
 <h5 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
 حساسية وعدم تحمل الأطعمة (Allergies & Intolerances)
 </h5>
 </div>
 {allergiesCount > 0 && (
 <span className="text-[12px] font-bold text-amber-700 dark:text-amber-300">
 {allergiesCount} محددة
 </span>
 )}
 </div>

 {/* Common Allergies Quick Chips */}
 <div className="flex flex-wrap gap-1.5">
 {COMMON_ALLERGIES.map((allergy) => {
 const isSelected = (currentMedical.allergies || []).includes(allergy);
 return (
 <button
 key={allergy}
 type="button"
 onClick={() => handleToggleAllergy(allergy)}
 className={`py-1 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
 isSelected
? 'bg-amber-500 text-white border-amber-600'
: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
 }`}
 >
 {isSelected && ' '}
 {allergy}
 </button>
 );
 })}
 </div>

 {/* Custom Allergy Adder */}
 <form onSubmit={handleAddCustomAllergy} className="flex gap-2 pt-1">
 <input
 type="text"
 placeholder="إضافة حساسية أو مكون آخر غير مذكور..."
 value={customAllergyInput}
 onChange={(e) => setCustomAllergyInput(e.target.value)}
 className="flex-1 text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
 />
 <button
 type="submit"
 className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1 cursor-pointer"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>إضافة</span>
 </button>
 </form>
 </div>

 {/* 6. Overall General Clinical Notes for Plan */}
 <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
 توجيهات طبية عامة وتنبيهات الأخصائي للمتدرب:
 </label>
 <textarea
 rows={3}
 placeholder="مثال: يرجى إجراء تحليل صورة دم ومقاومة إنسولين كل 3 أشهر، شرب السوائل بانتظام، إبلاغ الطبيب عند أي هبوط..."
 value={currentMedical.customConditionNotes || ''}
 onChange={(e) =>
 onUpdateDraft({
...draft,
 medicalConditions: {
...currentMedical,
 customConditionNotes: e.target.value,
 },
 })
 }
 className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-peacock-blue resize-none leading-relaxed"
 />
 </div>

 {/* ================= MODAL: SUGGESTED MACROS COMPARISON SHEET ================= */}
 {showMacroSuggestionModal && suggestedResult && (
 <div className="fixed inset-0 z-60 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in zoom-in-95 duration-150">
 <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 app-overlay-shadow max-h-[90vh] flex flex-col overflow-hidden">
 {/* Modal Header */}
 <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-peacock-mist/50 dark:bg-peacock-ink-deep/40">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-white flex items-center justify-center font-bold">
 <Circle className="w-5 h-5" />
 </div>
 <div>
 <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">
 اقتراحات الماكروز والسعرات العلاجية
 </h4>
 <p className="text-[12px] text-slate-500 dark:text-slate-400">
 بناءً على ({suggestedResult.appliedConditionsCount}) حالات طبية مسجلة
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setShowMacroSuggestionModal(false)}
 className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
 >
 
 </button>
 </div>

 {/* Modal Body */}
 <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
 {/* Clinical Warnings if any (e.g. Kidney) */}
 {suggestedResult.clinicalCautions.length > 0 && (
 <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1.5">
 <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-200">
 <AlertTriangle className="w-4 h-4 text-rose-600" />
 <span>تنبيهات سريرية هامة:</span>
 </div>
 {suggestedResult.clinicalCautions.map((c, idx) => (
 <p key={idx} className="text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
 {c}
 </p>
 ))}
 </div>
 )}

 {/* Side-by-Side Comparison: Current vs Suggested */}
 <div className="space-y-2">
 <h5 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <ArrowRightLeft className="w-4 h-4 text-peacock-indigo" />
 <span>مقارنة الأهداف الحالية مقابل المقترحة سريرياً:</span>
 </h5>

 <div className="grid grid-cols-2 gap-2.5">
 {/* Current */}
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
 <span className="text-[12px] font-bold text-slate-500 block text-center">
 الأهداف الحالية في الخطة
 </span>
 <div className="space-y-1.5 font-bold text-slate-700 dark:text-slate-200">
 <div className="flex justify-between">
 <span className="text-slate-400">السعرات:</span>
 <span>{draft.targetCalories || '--'} kcal</span>
 </div>
 <div className="flex justify-between">
 <span className="text-peacock-indigo">البروتين:</span>
 <span>{draft.targetProtein || '--'}g</span>
 </div>
 <div className="flex justify-between">
 <span className="text-blue-600">الكاربوهيدرات:</span>
 <span>{draft.targetCarbs || '--'}g</span>
 </div>
 <div className="flex justify-between">
 <span className="text-amber-600">الدهون:</span>
 <span>{draft.targetFats || '--'}g</span>
 </div>
 <div className="flex justify-between">
 <span className="text-cyan-600">الماء اليومي:</span>
 <span>{(draft.dailyWaterGoalMl || 3000) / 1000}L</span>
 </div>
 </div>
 </div>

 {/* Suggested */}
 <div className="p-3 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-teal-light dark:border-peacock-indigo-dark space-y-2">
 <span className="text-[12px] font-black text-peacock-indigo-deep dark:text-peacock-teal-light block text-center">
 القيم المقترحة للحالات 
 </span>
 <div className="space-y-1.5 font-black text-slate-800 dark:text-slate-100">
 <div className="flex justify-between">
 <span className="text-peacock-indigo-dark dark:text-peacock-teal">السعرات:</span>
 <span>{suggestedResult.suggestedCalories} kcal</span>
 </div>
 <div className="flex justify-between">
 <span className="text-peacock-indigo">البروتين:</span>
 <span>{suggestedResult.suggestedProtein}g</span>
 </div>
 <div className="flex justify-between">
 <span className="text-blue-600">الكاربوهيدرات:</span>
 <span>{suggestedResult.suggestedCarbs}g</span>
 </div>
 <div className="flex justify-between">
 <span className="text-amber-600">الدهون:</span>
 <span>{suggestedResult.suggestedFats}g</span>
 </div>
 <div className="flex justify-between">
 <span className="text-cyan-600">الماء اليومي:</span>
 <span>{suggestedResult.suggestedWaterMl / 1000}L</span>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Rationale Points */}
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
 <span className="font-bold text-slate-800 dark:text-slate-200 block">
 الأساس العلمي والإرشادي للتعديل:
 </span>
 <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
 {suggestedResult.rationalePoints.map((pt, idx) => (
 <li key={idx} className="flex items-start gap-1.5">
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
 <span>{pt}</span>
 </li>
 ))}
 </ul>
 </div>

 {/* Medical Disclaimer */}
 <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[12px] text-amber-900 dark:text-amber-200 leading-relaxed">
 <strong>تنويه سريري:</strong> هذه الاقتراحات إرشادية عامة مبنية على المراجع التغذوية المعتمدة، ولا تلغي التقييم الفردي من قِبل الأخصائي وفق نتائج الفحوصات الدورية للمتدرب.
 </div>
 </div>

 {/* Modal Footer Actions */}
 <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
 <button
 type="button"
 onClick={() => setShowMacroSuggestionModal(false)}
 className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
 >
 إلغاء
 </button>
 <button
 type="button"
 onClick={handleApplySuggestedMacros}
 className="px-5 py-2 rounded-xl text-xs font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-all cursor-pointer flex items-center gap-1.5"
 >
 <Check className="w-4 h-4" />
 <span>اعتماد وتطبيق الماكروز المقترحة</span>
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
